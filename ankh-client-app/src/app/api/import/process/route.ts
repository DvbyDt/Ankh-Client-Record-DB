import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { Client } from '@upstash/qstash'
import bcrypt from 'bcryptjs'

const CHUNK_SIZE = 300

interface ProcessPayload {
  jobId: string
  chunkIndex: number
}

interface ImportRow {
  customerId: string
  customerName: string
  lessonId: string
  lessonDate: string        // ISO string or empty
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
    data: { progress, message, status },
  })
}

function safeDate(val: string | undefined | null): Date | null {
  if (!val || val.trim() === '') return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

async function handler(request: NextRequest) {
  let payload: ProcessPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { jobId, chunkIndex } = payload
  if (!jobId || chunkIndex === undefined) {
    return NextResponse.json({ error: 'Missing jobId or chunkIndex' }, { status: 400 })
  }

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      select: { rowsJson: true, totalRows: true, status: true, rowErrors: true },
    })

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status === 'failed') return NextResponse.json({ ok: true, skipped: 'already failed' })
    if (job.status === 'complete') return NextResponse.json({ ok: true, skipped: 'already complete' })

    const allRows: ImportRow[] = JSON.parse(job.rowsJson as string || '[]')
    const totalRows = allRows.length
    const totalChunks = Math.ceil(totalRows / CHUNK_SIZE)
    const chunk = allRows.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)
    const errors: string[] = Array.isArray(job.rowErrors) ? job.rowErrors as string[] : []

    // ── First chunk only: set up all reference data ─────────────────────────
    if (chunkIndex === 0) {
      // 1. Locations
      await setProgress(jobId, 10, 'Setting up locations…')
      const locationNames = [...new Set(
        allRows.map(r => r.locationName?.trim() || 'Default Location')
      )]
      for (const name of locationNames) {
        await prisma.location.upsert({ where: { name }, update: {}, create: { name } })
      }

      // 2. Instructors
      await setProgress(jobId, 20, 'Setting up instructors…')
      const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
      const uniqueInstructors = new Map<string, string>() // email → name
      for (const row of allRows) {
        if (!row.instructorName?.trim()) continue
        const email = `${row.instructorName.trim().replace(/\s+/g, '.').toLowerCase()}@instructor.local`
        uniqueInstructors.set(email, row.instructorName.trim())
      }
      for (const [email, name] of uniqueInstructors) {
        const parts = name.split(/\s+/)
        await prisma.user.upsert({
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
      }

      // 3. Customers
      await setProgress(jobId, 35, 'Importing customers…')
      const uniqueCustomers = new Map<string, { firstName: string; lastName: string; email: string }>()
      for (const row of allRows) {
        if (!row.customerId || uniqueCustomers.has(row.customerId)) continue
        const parts = (row.customerName || '').trim().split(/\s+/)
        uniqueCustomers.set(row.customerId, {
          firstName: parts[0] || 'Unknown',
          lastName: parts.slice(1).join(' ') || '',
          email: `customer_${row.customerId}@imported.local`,
        })
      }
      for (const [id, c] of uniqueCustomers) {
        await prisma.customer.upsert({
          where: { id },
          update: { firstName: c.firstName, lastName: c.lastName },
          create: { id, ...c },
        })
      }

      // 4. Fetch IDs for lessons
      await setProgress(jobId, 50, 'Importing lessons…')
      const locationRecords = await prisma.location.findMany({
        where: { name: { in: locationNames } },
        select: { id: true, name: true },
      })
      const locationIdByName = Object.fromEntries(locationRecords.map(l => [l.name, l.id]))

      const instructorRecords = await prisma.user.findMany({
        where: { email: { in: [...uniqueInstructors.keys()] } },
        select: { id: true, email: true },
      })
      const instructorIdByEmail = Object.fromEntries(instructorRecords.map(u => [u.email, u.id]))

      // 5. Lessons — deduplicated
      const uniqueLessons = new Map<string, {
        instructorEmail: string
        locationName: string
        lessonType: string
        lessonContent: string | null
        lessonDate: Date | null
      }>()
      for (const row of allRows) {
        if (uniqueLessons.has(row.lessonId)) continue
        uniqueLessons.set(row.lessonId, {
          instructorEmail: `${(row.instructorName || '').trim().replace(/\s+/g, '.').toLowerCase()}@instructor.local`,
          locationName: row.locationName?.trim() || 'Default Location',
          lessonType: row.lessonType?.trim() || 'Group',
          lessonContent: row.lessonContent?.trim() || null,
          lessonDate: safeDate(row.lessonDate),  // null if invalid — no crash
        })
      }

      for (const [id, lesson] of uniqueLessons) {
        const instructorId = instructorIdByEmail[lesson.instructorEmail]
        const locationId = locationIdByName[lesson.locationName]
        if (!instructorId || !locationId) {
          errors.push(`Skipped lesson ${id}: instructor or location not found`)
          continue
        }

        // Only include createdAt if we have a valid date
        const dateField = lesson.lessonDate ? { createdAt: lesson.lessonDate } : {}

        await prisma.lesson.upsert({
          where: { id },
          update: {
            lessonType: lesson.lessonType,
            lessonContent: lesson.lessonContent,
            instructorId,
            locationId,
            ...dateField,
          },
          create: {
            id,
            lessonType: lesson.lessonType,
            lessonContent: lesson.lessonContent,
            instructorId,
            locationId,
            ...dateField,
          },
        })
      }
    }

    // ── Process this chunk's participants ────────────────────────────────────
    const pct = chunkIndex === 0
      ? 60
      : Math.min(55 + Math.floor(((chunkIndex + 1) / totalChunks) * 40), 95)

    await setProgress(
      jobId, pct,
      `Processing rows ${chunkIndex * CHUNK_SIZE + 1}–${Math.min((chunkIndex + 1) * CHUNK_SIZE, totalRows)} of ${totalRows}…`
    )

    const validChunk = chunk.filter(row => {
      if (!row.customerId || !row.lessonId) {
        errors.push(`Skipped row: missing customerId or lessonId`)
        return false
      }
      return true
    })

    if (validChunk.length > 0) {
      await prisma.$transaction(
        validChunk.map(row =>
          prisma.lessonParticipant.upsert({
            where: {
              customerId_lessonId: {
                customerId: row.customerId,
                lessonId: row.lessonId,
              },
            },
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
      )
    }

    // ── Queue next chunk OR mark complete ────────────────────────────────────
    const isLastChunk = chunkIndex + 1 >= totalChunks

    if (isLastChunk) {
      const errorNote = errors.length > 0 ? ` (${errors.length} rows skipped)` : ''
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'complete',
          progress: 100,
          message: `Successfully imported ${totalRows - errors.length} records${errorNote}`,
          rowErrors: errors,
          rowsJson: null,
        },
      })
    } else {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { rowErrors: errors },
      })

      const qstash = new Client({
        baseUrl: process.env.QSTASH_URL!,
        token: process.env.QSTASH_TOKEN!,
      })
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL!}/api/import/process`,
        body: { jobId, chunkIndex: chunkIndex + 1 },
        retries: 3,
      })
    }

    return NextResponse.json({ ok: true, chunkIndex, isLastChunk, totalChunks })

  } catch (error) {
    console.error(`Import failed at chunk ${chunkIndex}:`, error)
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        message: `Import failed at chunk ${chunkIndex}: ${String(error)}`,
      },
    }).catch(() => {})
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = verifySignatureAppRouter(handler)