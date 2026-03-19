import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export interface ImportRow {
  customerId: string
  customerName: string
  lessonId: string
  lessonDate: string
  instructorName: string
  lessonType?: string
  locationName?: string
  lessonContent?: string
  customerSymptoms?: string
  courseCompletionStatus?: string
}

async function setProgress(jobId: string, progress: number, message: string, status = 'processing') {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { progress, message, status, updatedAt: new Date() },
  })
}

export const processImport = inngest.createFunction(
  {
    id: 'process-excel-import',
    retries: 2,
    timeouts: { finish: '30m' },
  },
  async ({ event, step }: { event: { data: { jobId: string } }; step: any }) => {
    const { jobId } = event.data  // ← only jobId comes from the event now

    // ── Step 1: Load rows from DB + validate ─────────────────────────────────
    const validRows = await step.run('load-and-validate', async () => {
      await setProgress(jobId, 5, 'Loading data…')

      // Read the rows we stored in the DB (avoids Inngest 256KB limit)
      const job = await prisma.importJob.findUnique({
        where: { id: jobId },
        select: { rowsJson: true, totalRows: true },
      })

      if (!job?.rowsJson) throw new Error('Job rows not found in database')

      const rows: ImportRow[] = JSON.parse(job.rowsJson as string)

      const valid: ImportRow[] = []
      const errors: string[] = []

      for (const row of rows) {
        if (!row.customerId || !row.customerName || !row.lessonId || !row.lessonDate || !row.instructorName) {
          errors.push(`Skipped: missing required fields for "${row.customerName || row.customerId || 'unknown'}"`)
          continue
        }
        if (isNaN(new Date(row.lessonDate).getTime())) {
          errors.push(`Skipped: invalid date "${row.lessonDate}" for customer "${row.customerName}"`)
          continue
        }
        valid.push(row)
      }

      await setProgress(jobId, 15, `Validated — ${valid.length} valid, ${errors.length} skipped`)
      return { valid, errors }
    })

    // ── Step 2: Upsert locations ─────────────────────────────────────────────
    await step.run('upsert-locations', async () => {
      await setProgress(jobId, 25, 'Setting up locations…')

      const names = [...new Set(validRows.valid.map((r: ImportRow) => typeof r.locationName === 'string' ? r.locationName.trim() : 'Default Location'))]
      await prisma.$transaction(
        (names as string[]).map((name: string) => prisma.location.upsert({ where: { name }, update: {}, create: { name } }))
      )
    })

    // ── Step 3: Upsert instructors ───────────────────────────────────────────
    const instructorIdByEmail = await step.run('upsert-instructors', async () => {
      await setProgress(jobId, 38, 'Setting up instructors…')

      const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
      const uniqueInstructors = new Map<string, string>()

      for (const row of validRows.valid as ImportRow[]) {
        const email = `${row.instructorName.replace(/\s+/g, '.').toLowerCase()}@instructor.local`
        uniqueInstructors.set(email, typeof row.instructorName === 'string' ? row.instructorName.trim() : '')
      }

      await prisma.$transaction(
        [...uniqueInstructors.entries()].map(([email, name]) => {
          const parts = name.split(/\s+/)
          return prisma.user.upsert({
            where: { email },
            update: {},
            create: {
              username: email,
              password: hashedPw,
              role: 'INSTRUCTOR',
              firstName: parts[0] || name,
              lastName: parts.slice(1).join(' ') || '',
              email,
            },
          })
        })
      )

      const records = await prisma.user.findMany({
        where: { email: { in: [...uniqueInstructors.keys()] } },
        select: { id: true, email: true },
      })
      return Object.fromEntries(records.map(u => [u.email, u.id]))
    })

    // ── Step 4: Upsert customers ─────────────────────────────────────────────
    await step.run('upsert-customers', async () => {
      await setProgress(jobId, 52, 'Importing customers…')

      const uniqueCustomers = new Map<string, { firstName: string; lastName: string; email: string }>()
      for (const row of validRows.valid) {
        if (!uniqueCustomers.has(row.customerId)) {
          const parts = row.customerName.trim().split(/\s+/)
          uniqueCustomers.set(row.customerId, {
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
            email: `${row.customerId}@imported.local`,
          })
        }
      }

      await prisma.$transaction(
        [...uniqueCustomers.entries()].map(([id, c]) =>
          prisma.customer.upsert({
            where: { id },
            update: { firstName: c.firstName, lastName: c.lastName },
            create: { id, ...c },
          })
        )
      )
    })

    // ── Step 5: Fetch location IDs ───────────────────────────────────────────
    const locationIdByName = await step.run('fetch-location-ids', async () => {
      const names = [...new Set(validRows.valid.map((r: ImportRow) => typeof r.locationName === 'string' ? r.locationName.trim() : 'Default Location'))] as string[];
      const records = await prisma.location.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true },
      })
      return Object.fromEntries(records.map(l => [l.name, l.id]))
    })

    // ── Step 6: Upsert lessons ───────────────────────────────────────────────
    await step.run('upsert-lessons', async () => {
      await setProgress(jobId, 68, 'Importing lessons…')

      const uniqueLessons = new Map<string, {
        instructorEmail: string; locationName: string
        lessonType: string; lessonContent: string | null; lessonDate: Date
      }>()

      for (const row of validRows.valid as ImportRow[]) {
        if (!uniqueLessons.has(row.lessonId)) {
          uniqueLessons.set(row.lessonId, {
            instructorEmail: `${row.instructorName.replace(/\s+/g, '.').toLowerCase()}@instructor.local`,
            locationName: typeof row.locationName === 'string' ? row.locationName.trim() : 'Default Location',
            lessonType: typeof row.lessonType === 'string' ? row.lessonType.trim() : 'Group',
            lessonContent: typeof row.lessonContent === 'string' ? row.lessonContent.trim() : null,
            lessonDate: new Date(row.lessonDate),
          })
        }
      }

      const upserts = [...uniqueLessons.entries()].flatMap(([id, lesson]) => {
        const instructorId = instructorIdByEmail[lesson.instructorEmail]
        const locationId = locationIdByName[lesson.locationName]
        if (!instructorId || !locationId) return []
        return [prisma.lesson.upsert({
          where: { id },
          update: {
            lessonType: lesson.lessonType,
            lessonContent: lesson.lessonContent,
            createdAt: lesson.lessonDate,
            instructorId,
            locationId,
          },
          create: {
            id,
            lessonType: lesson.lessonType,
            lessonContent: lesson.lessonContent,
            instructorId,
            locationId,
            createdAt: lesson.lessonDate,
          },
        })]
      })

      if (upserts.length > 0) await prisma.$transaction(upserts)
    })

    // ── Step 7: Upsert participants ──────────────────────────────────────────
    const processedCount = await step.run('upsert-participants', async () => {
      await setProgress(jobId, 82, 'Linking customers to lessons…')

      const upserts = (validRows.valid as ImportRow[]).map((row: ImportRow) =>
        prisma.lessonParticipant.upsert({
          where: { customerId_lessonId: { customerId: row.customerId, lessonId: row.lessonId } },
          update: {
            customerSymptoms: row.customerSymptoms || null,
            customerImprovements: row.courseCompletionStatus || null,
          },
          create: {
            customerId: row.customerId,
            lessonId: row.lessonId,
            customerSymptoms: row.customerSymptoms || null,
            customerImprovements: row.courseCompletionStatus || null,
            status: 'attended',
          },
        })
      )

      await prisma.$transaction(upserts)
      return upserts.length
    })

    // ── Step 8: Clean up + mark complete ─────────────────────────────────────
    await step.run('mark-complete', async () => {
      const errorSummary = validRows.errors.length > 0
        ? ` (${validRows.errors.length} rows skipped)`
        : ''

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'complete',
          progress: 100,
          message: `Successfully imported ${processedCount} records${errorSummary}`,
          rowErrors: validRows.errors,
          rowsJson: null,  // ← clear the raw data once done, saves DB space
          updatedAt: new Date(),
        },
      })
    })

    return { processedCount, skipped: validRows.errors.length }
  }
)