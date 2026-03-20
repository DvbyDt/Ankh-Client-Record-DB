import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { Client } from '@upstash/qstash'
import bcrypt from 'bcryptjs'

// 200 rows per chunk — each call takes ~10-15s, well within Vercel's 60s limit
const CHUNK_SIZE = 200

type Phase = 'refs' | 'lessons' | 'participants'

interface ProcessPayload {
  jobId: string
  phase: Phase
  chunkIndex?: number
}

interface ImportRow {
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
    data: { progress, message, status },
  })
}

function safeDate(val: string | undefined | null): Date | null {
  if (!val || val.trim() === '') return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

async function queueNext(payload: ProcessPayload) {
  const qstash = new Client({
    baseUrl: process.env.QSTASH_URL!,
    token: process.env.QSTASH_TOKEN!,
  })
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL!}/api/import/process`,
    body: payload,
    retries: 2,
  })
}

// ── PHASE 1: refs ─────────────────────────────────────────────────────────────
// Upsert locations, instructors, customers — all small sets, done in <10s
async function runRefs(jobId: string, allRows: ImportRow[]) {
  await setProgress(jobId, 8, 'Setting up locations…')

  const locationNames = [...new Set(allRows.map(r => r.locationName?.trim() || 'Default Location'))]
  await prisma.$transaction(
    locationNames.map(name => prisma.location.upsert({ where: { name }, update: {}, create: { name } }))
  )

  await setProgress(jobId, 14, 'Setting up instructors…')

  const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
  const uniqueInstructors = new Map<string, string>()
  for (const row of allRows) {
    if (!row.instructorName?.trim()) continue
    const email = `${row.instructorName.trim().replace(/\s+/g, '.').toLowerCase()}@instructor.local`
    uniqueInstructors.set(email, row.instructorName.trim())
  }
  await prisma.$transaction(
    [...uniqueInstructors.entries()].map(([email, name]) => {
      const parts = name.split(/\s+/)
      return prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          username: email, password: hashedPw, role: 'INSTRUCTOR',
          firstName: parts[0] || name, lastName: parts.slice(1).join(' ') || '', email,
        },
      })
    })
  )

  await setProgress(jobId, 20, 'Importing customers…')

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
  await prisma.$transaction(
    [...uniqueCustomers.entries()].map(([id, c]) =>
      prisma.customer.upsert({
        where: { id },
        update: { firstName: c.firstName, lastName: c.lastName },
        create: { id, ...c },
      })
    )
  )

  await prisma.importJob.update({
    where: { id: jobId },
    data: { progress: 25, message: 'References done — importing lessons…' },
  })
}

// ── PHASE 2: lessons ──────────────────────────────────────────────────────────
// 3741 unique lessons split into chunks of 200 — ~19 QStash calls
async function runLessonsChunk(jobId: string, allRows: ImportRow[], chunkIndex: number) {
  const uniqueLessons = [...new Map(
    allRows.map(row => [row.lessonId, row])
  ).entries()]

  const totalChunks = Math.ceil(uniqueLessons.length / CHUNK_SIZE)
  const chunk = uniqueLessons.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)

  const pct = 25 + Math.floor(((chunkIndex + 1) / totalChunks) * 30)
  await setProgress(
    jobId, Math.min(pct, 54),
    `Importing lessons… (${Math.min((chunkIndex + 1) * CHUNK_SIZE, uniqueLessons.length)} / ${uniqueLessons.length})`
  )

  // Fetch instructor + location IDs needed for this chunk
  const instructorEmails = [...new Set(chunk.map(([, row]) =>
    `${(row.instructorName || '').trim().replace(/\s+/g, '.').toLowerCase()}@instructor.local`
  ))]
  const locationNames = [...new Set(chunk.map(([, row]) => row.locationName?.trim() || 'Default Location'))]

  const [instructorRecords, locationRecords] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: instructorEmails } }, select: { id: true, email: true } }),
    prisma.location.findMany({ where: { name: { in: locationNames } }, select: { id: true, name: true } }),
  ])

  const instructorIdByEmail = Object.fromEntries(instructorRecords.map(u => [u.email, u.id]))
  const locationIdByName = Object.fromEntries(locationRecords.map(l => [l.name, l.id]))

  const errors: string[] = []

  await prisma.$transaction(
    chunk.flatMap(([id, row]) => {
      const instructorEmail = `${(row.instructorName || '').trim().replace(/\s+/g, '.').toLowerCase()}@instructor.local`
      const locationName = row.locationName?.trim() || 'Default Location'
      const instructorId = instructorIdByEmail[instructorEmail]
      const locationId = locationIdByName[locationName]

      if (!instructorId || !locationId) {
        errors.push(`Skipped lesson ${id}: instructor or location not found`)
        return []
      }

      const lessonDate = safeDate(row.lessonDate)
      const dateField = lessonDate ? { createdAt: lessonDate } : {}

      return [prisma.lesson.upsert({
        where: { id },
        update: {
          lessonType: row.lessonType?.trim() || 'Group',
          lessonContent: row.lessonContent?.trim() || null,
          instructorId, locationId, ...dateField,
        },
        create: {
          id,
          lessonType: row.lessonType?.trim() || 'Group',
          lessonContent: row.lessonContent?.trim() || null,
          instructorId, locationId, ...dateField,
        },
      })]
    })
  )

  // Save errors and queue next
  const existingJob = await prisma.importJob.findUnique({ where: { id: jobId }, select: { rowErrors: true } })
  const allErrors = [...(Array.isArray(existingJob?.rowErrors) ? existingJob!.rowErrors as string[] : []), ...errors]
  await prisma.importJob.update({ where: { id: jobId }, data: { rowErrors: allErrors } })

  const isLastChunk = chunkIndex + 1 >= totalChunks
  if (isLastChunk) {
    await queueNext({ jobId, phase: 'participants', chunkIndex: 0 })
  } else {
    await queueNext({ jobId, phase: 'lessons', chunkIndex: chunkIndex + 1 })
  }
}

// ── PHASE 3: participants ─────────────────────────────────────────────────────
// 3741 participant rows split into chunks of 200 — ~19 QStash calls
async function runParticipantsChunk(jobId: string, allRows: ImportRow[], chunkIndex: number) {
  const totalChunks = Math.ceil(allRows.length / CHUNK_SIZE)
  const chunk = allRows.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)

  const pct = 55 + Math.floor(((chunkIndex + 1) / totalChunks) * 43)
  await setProgress(
    jobId, Math.min(pct, 98),
    `Linking customers to lessons… (${Math.min((chunkIndex + 1) * CHUNK_SIZE, allRows.length)} / ${allRows.length})`
  )

  const existingJob = await prisma.importJob.findUnique({ where: { id: jobId }, select: { rowErrors: true } })
  const errors: string[] = Array.isArray(existingJob?.rowErrors) ? existingJob!.rowErrors as string[] : []

  const validChunk = chunk.filter(row => {
    if (!row.customerId || !row.lessonId) {
      errors.push(`Skipped: missing customerId or lessonId`)
      return false
    }
    return true
  })

  if (validChunk.length > 0) {
    await prisma.$transaction(
      validChunk.map(row =>
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
    )
  }

  await prisma.importJob.update({ where: { id: jobId }, data: { rowErrors: errors } })

  const isLastChunk = chunkIndex + 1 >= totalChunks
  if (isLastChunk) {
    const errorNote = errors.length > 0 ? ` (${errors.length} rows skipped)` : ''
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'complete',
        progress: 100,
        message: `Successfully imported ${allRows.length - errors.length} records${errorNote}`,
        rowErrors: errors,
        rowsJson: null,
      },
    })
  } else {
    await queueNext({ jobId, phase: 'participants', chunkIndex: chunkIndex + 1 })
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function handler(request: NextRequest) {
  let payload: ProcessPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { jobId, phase, chunkIndex = 0 } = payload
  if (!jobId || !phase) {
    return NextResponse.json({ error: 'Missing jobId or phase' }, { status: 400 })
  }

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      select: { rowsJson: true, status: true },
    })

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status === 'failed') return NextResponse.json({ ok: true, skipped: 'already failed' })
    if (job.status === 'complete') return NextResponse.json({ ok: true, skipped: 'already complete' })

    const allRows: ImportRow[] = JSON.parse(job.rowsJson as string || '[]')

    if (phase === 'refs') {
      await runRefs(jobId, allRows)
      await queueNext({ jobId, phase: 'lessons', chunkIndex: 0 })
    } else if (phase === 'lessons') {
      await runLessonsChunk(jobId, allRows, chunkIndex)
    } else if (phase === 'participants') {
      await runParticipantsChunk(jobId, allRows, chunkIndex)
    } else {
      return NextResponse.json({ error: `Unknown phase: ${phase}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, phase, chunkIndex })

  } catch (error) {
    console.error(`Import failed [${phase} chunk ${chunkIndex}]:`, error)
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        message: `Import failed at ${phase} (chunk ${chunkIndex}): ${String(error)}`,
      },
    }).catch(() => {})
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = verifySignatureAppRouter(handler)