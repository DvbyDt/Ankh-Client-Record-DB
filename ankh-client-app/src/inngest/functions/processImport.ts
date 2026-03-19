import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Helper: update job progress in DB ────────────────────────────────────────
async function setProgress(jobId: string, progress: number, message: string, status = 'processing') {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { progress, message, status, updatedAt: new Date() },
  })
}

// ── The Inngest function ───────────────────────────────────────────────────────
// Each step.run() block is independently retried on failure.
// The whole job can be resumed from the last successful step if Vercel restarts.
export const processImport = inngest.createFunction(
  {
    id: 'process-excel-import',
    retries: 2,
    timeouts: { finish: '30m' },
  },
  async ({ event, step }: { event: { data: { jobId: string; rows: ImportRow[] } }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { jobId, rows }: { jobId: string; rows: ImportRow[] } = event.data

    // ── Step 1: Validate ─────────────────────────────────────────────────────
    const validRows = await step.run('validate-rows', async () => {
      await setProgress(jobId, 5, `Validating ${rows.length} rows…`)

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

      const names: string[] = [...new Set(validRows.valid.map(r => typeof r.locationName === 'string' ? r.locationName.trim() : 'Default Location'))]
      await prisma.$transaction(
        names.map(name => prisma.location.upsert({ where: { name }, update: {}, create: { name } }))
      )
    })

    // ── Step 3: Upsert instructors ───────────────────────────────────────────
    const instructorIdByEmail = await step.run('upsert-instructors', async () => {
      await setProgress(jobId, 38, 'Setting up instructors…')

      const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
      const uniqueInstructors: Map<string, string> = new Map()

      for (const row of validRows.valid) {
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
      return Object.fromEntries(records.map(u => [u.email, u.id])) as Record<string, string>
    })

    // ── Step 4: Upsert customers ─────────────────────────────────────────────
    await step.run('upsert-customers', async () => {
      await setProgress(jobId, 52, 'Importing customers…')

      const uniqueCustomers: Map<string, { firstName: string; lastName: string; email: string }> = new Map()
      for (const row of validRows.valid) {
        if (!uniqueCustomers.has(row.customerId)) {
          const parts = typeof row.customerName === 'string' ? row.customerName.trim().split(/\s+/) : ['']
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

    // ── Step 5: Upsert lessons ───────────────────────────────────────────────
    const locationIdByName = await step.run('fetch-location-ids', async () => {
      const names: string[] = [...new Set(validRows.valid.map(r => typeof r.locationName === 'string' ? r.locationName.trim() : 'Default Location'))]
      const records = await prisma.location.findMany({ where: { name: { in: names } }, select: { id: true, name: true } })
      return Object.fromEntries(records.map(l => [l.name, l.id]))
    })

    await step.run('upsert-lessons', async () => {
      await setProgress(jobId, 68, 'Importing lessons…')

      const uniqueLessons: Map<string, {
        instructorEmail: string; locationName: string
        lessonType: string; lessonContent: string | null; lessonDate: Date
      }> = new Map()

      for (const row of validRows.valid) {
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
          update: { lessonType: lesson.lessonType, lessonContent: lesson.lessonContent, createdAt: lesson.lessonDate, instructorId, locationId },
          create: { id, lessonType: lesson.lessonType, lessonContent: lesson.lessonContent, instructorId, locationId, createdAt: lesson.lessonDate },
        })]
      }) as Array<ReturnType<typeof prisma.lesson.upsert>>

      if (upserts.length > 0) await prisma.$transaction(upserts)
    })

    // ── Step 6: Upsert participants ──────────────────────────────────────────
    const processedCount = await step.run('upsert-participants', async () => {
      await setProgress(jobId, 82, 'Linking customers to lessons…')

      const upserts = validRows.valid.map(row =>
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

    // ── Step 7: Mark complete ────────────────────────────────────────────────
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
          updatedAt: new Date(),
        },
      })
    })

    return { processedCount, skipped: validRows.errors.length }
  }
)