import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { Client } from '@upstash/qstash'
import bcrypt from 'bcryptjs'

const CHUNK_SIZE = 200 // smaller chunks = safer within 60s limit

interface ProcessPayload {
  jobId: string
  // phase 'setup' runs first (locations, instructors, customers, lessons)
  // phase 'participants' runs for each chunk of participants
  phase: 'setup' | 'participants'
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

function getQStash() {
  return new Client({
    baseUrl: process.env.QSTASH_URL!,
    token: process.env.QSTASH_TOKEN!,
  })
}

async function queueNext(payload: ProcessPayload) {
  await getQStash().publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL!}/api/import/process`,
    body: payload,
    retries: 2,
  })
}

// ── PHASE 1: Setup — locations, instructors, customers, lessons ──────────────
// Runs once. Should complete well within 60s for 3741 rows.
async function runSetup(jobId: string, allRows: ImportRow[]) {
  const errors: string[] = []

  // 1. Locations (fast — usually <10 unique)
  await setProgress(jobId, 10, 'Setting up locations…')
  const locationNames = [...new Set(allRows.map(r => r.locationName?.trim() || 'Default Location'))]
  for (const name of locationNames) {
    await prisma.location.upsert({ where: { name }, update: {}, create: { name } })
  }

  // 2. Instructors (fast — usually <20 unique)
  await setProgress(jobId, 18, 'Setting up instructors…')
  const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
  const uniqueInstructors = new Map<string, string>()
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
        username: email, password: hashedPw, role: 'INSTRUCTOR',
        firstName: parts[0] || name, lastName: parts.slice(1).join(' ') || '', email,
      },
    })
  }

  // 3. Customers — batch upsert in groups of 100
  await setProgress(jobId, 28, 'Importing customers…')
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
  const customerEntries = [...uniqueCustomers.entries()]
  for (let i = 0; i < customerEntries.length; i += 100) {
    const batch = customerEntries.slice(i, i + 100)
    await prisma.$transaction(
      batch.map(([id, c]) =>
        prisma.customer.upsert({
          where: { id },
          update: { firstName: c.firstName, lastName: c.lastName },
          create: { id, ...c },
        })
      )
    )
  }

  // 4. Fetch location + instructor IDs
  await setProgress(jobId, 40, 'Importing lessons…')
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

  // 5. Lessons — batch upsert in groups of 100
  const uniqueLessons = new Map<string, {
    instructorEmail: string; locationName: string
    lessonType: string; lessonContent: string | null; lessonDate: Date | null
  }>()
  for (const row of allRows) {
    if (uniqueLessons.has(row.lessonId)) continue
    uniqueLessons.set(row.lessonId, {
      instructorEmail: `${(row.instructorName || '').trim().replace(/\s+/g, '.').toLowerCase()}@instructor.local`,
      locationName: row.locationName?.trim() || 'Default Location',
      lessonType: row.lessonType?.trim() || 'Group',
      lessonContent: row.lessonContent?.trim() || null,
      lessonDate: safeDate(row.lessonDate),
    })
  }

  const lessonEntries = [...uniqueLessons.entries()]
  for (let i = 0; i < lessonEntries.length; i += 100) {
    const batch = lessonEntries.slice(i, i + 100)
    await prisma.$transaction(
      batch.flatMap(([id, lesson]) => {
        const instructorId = instructorIdByEmail[lesson.instructorEmail]
        const locationId = locationIdByName[lesson.locationName]
        if (!instructorId || !locationId) {
          errors.push(`Skipped lesson ${id}: instructor or location not found`)
          return []
        }
        const dateField = lesson.lessonDate ? { createdAt: lesson.lessonDate } : {}
        return [prisma.lesson.upsert({
          where: { id },
          update: { lessonType: lesson.lessonType, lessonContent: lesson.lessonContent, instructorId, locationId, ...dateField },
          create: { id, lessonType: lesson.lessonType, lessonContent: lesson.lessonContent, instructorId, locationId, ...dateField },
        })]
      })
    )
  }

  // Save errors and queue first participant chunk
  await prisma.importJob.update({ where: { id: jobId }, data: { rowErrors: errors, progress: 50, message: 'Setup complete — processing participants…' } })
}

// ── PHASE 2: Participants — one chunk at a time ──────────────────────────────
async function runParticipantsChunk(jobId: string, allRows: ImportRow[], chunkIndex: number) {
  const totalChunks = Math.ceil(allRows.length / CHUNK_SIZE)
  const chunk = allRows.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)

  const pct = 50 + Math.floor(((chunkIndex + 1) / totalChunks) * 48)
  await setProgress(
    jobId, Math.min(pct, 98),
    `Linking customers to lessons… (${Math.min((chunkIndex + 1) * CHUNK_SIZE, allRows.length)} / ${allRows.length})`
  )

  const job = await prisma.importJob.findUnique({ where: { id: jobId }, select: { rowErrors: true } })
  const errors: string[] = Array.isArray(job?.rowErrors) ? job!.rowErrors as string[] : []

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

  const isLastChunk = chunkIndex + 1 >= totalChunks

  if (isLastChunk) {
    const errorNote = errors.length > 0 ? ` (${errors.length} rows skipped)` : ''
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'complete', progress: 100,
        message: `Successfully imported ${allRows.length - errors.length} records${errorNote}`,
        rowErrors: errors, rowsJson: null,
      },
    })
  } else {
    await prisma.importJob.update({ where: { id: jobId }, data: { rowErrors: errors } })
    await queueNext({ jobId, phase: 'participants', chunkIndex: chunkIndex + 1 })
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
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

    if (phase === 'setup') {
      await runSetup(jobId, allRows)
      // Queue first participant chunk
      await queueNext({ jobId, phase: 'participants', chunkIndex: 0 })
    } else {
      await runParticipantsChunk(jobId, allRows, chunkIndex)
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