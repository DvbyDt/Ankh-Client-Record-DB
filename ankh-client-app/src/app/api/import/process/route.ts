import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import bcrypt from 'bcryptjs'

const CHUNK_SIZE = 300 // rows per chunk — safely fits in 60s Vercel limit

interface ProcessPayload {
  jobId: string
  chunkIndex: number
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

// ── Main handler (verified by QStash signature) ───────────────────────────────
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
    // ── Load job from DB ────────────────────────────────────────────────────
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      select: { rowsJson: true, totalRows: true, status: true, rowErrors: true },
    })

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status === 'failed') return NextResponse.json({ ok: true, skipped: 'job already failed' })
    if (job.status === 'complete') return NextResponse.json({ ok: true, skipped: 'job already complete' })

    const allRows: ImportRow[] = JSON.parse(job.rowsJson as string || '[]')
    const totalRows = allRows.length
    const totalChunks = Math.ceil(totalRows / CHUNK_SIZE)
    const chunk = allRows.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)

    // ── Progress calculation ────────────────────────────────────────────────
    // First chunk: also do locations + instructors + customers setup
    // Subsequent chunks: just participants
    const baseProgress = chunkIndex === 0 ? 5 : Math.floor((chunkIndex / totalChunks) * 85) + 10

    // ── First chunk only: upsert locations, instructors, customers ──────────
    if (chunkIndex === 0) {
      await setProgress(jobId, 10, 'Setting up locations…')

      const locationNames = [...new Set(allRows.map(r => r.locationName?.trim() || 'Default Location'))]
      await prisma.$transaction(
        locationNames.map(name => prisma.location.upsert({ where: { name }, update: {}, create: { name } }))
      )

      await setProgress(jobId, 20, 'Setting up instructors…')

      const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
      const uniqueInstructors = new Map<string, string>()
      for (const row of allRows) {
        const email = `${row.instructorName.replace(/\s+/g, '.').toLowerCase()}@instructor.local`
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

      await setProgress(jobId, 35, 'Importing customers…')

      const uniqueCustomers = new Map<string, { firstName: string; lastName: string; email: string }>()
      for (const row of allRows) {
        if (!uniqueCustomers.has(row.customerId)) {
          const parts = row.customerName.trim().split(/\s+/)
          uniqueCustomers.set(row.customerId, {
            firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '',
            email: `${row.customerId}@imported.local`,
          })
        }
      }
      for (const [id, c] of uniqueCustomers) {
        await prisma.customer.upsert({
          where: { id },
          update: { firstName: c.firstName, lastName: c.lastName },
          create: { id, ...c },
        })
      }

      await setProgress(jobId, 50, 'Importing lessons…')

      // Fetch IDs
      const locationRecords = await prisma.location.findMany({
        where: { name: { in: locationNames } }, select: { id: true, name: true },
      })
      const locationIdByName = Object.fromEntries(locationRecords.map(l => [l.name, l.id]))

      const instructorEmails = [...uniqueInstructors.keys()]
      const instructorRecords = await prisma.user.findMany({
        where: { email: { in: instructorEmails } }, select: { id: true, email: true },
      })
      const instructorIdByEmail = Object.fromEntries(instructorRecords.map(u => [u.email, u.id]))

      const uniqueLessons = new Map<string, {
        instructorEmail: string; locationName: string
        lessonType: string; lessonContent: string | null; lessonDate: Date
      }>()
      for (const row of allRows) {
        if (!uniqueLessons.has(row.lessonId)) {
          uniqueLessons.set(row.lessonId, {
            instructorEmail: `${row.instructorName.replace(/\s+/g, '.').toLowerCase()}@instructor.local`,
            locationName: row.locationName?.trim() || 'Default Location',
            lessonType: row.lessonType?.trim() || 'Group',
            lessonContent: row.lessonContent?.trim() || null,
            lessonDate: new Date(row.lessonDate),
          })
        }
      }
      for (const [id, lesson] of uniqueLessons) {
        const instructorId = instructorIdByEmail[lesson.instructorEmail]
        const locationId = locationIdByName[lesson.locationName]
        if (!instructorId || !locationId) continue
        await prisma.lesson.upsert({
          where: { id },
          update: { lessonType: lesson.lessonType, lessonContent: lesson.lessonContent, createdAt: lesson.lessonDate, instructorId, locationId },
          create: { id, lessonType: lesson.lessonType, lessonContent: lesson.lessonContent, instructorId, locationId, createdAt: lesson.lessonDate },
        })
      }
    }

    // ── Process this chunk's participants ───────────────────────────────────
    const chunkProgress = Math.floor(((chunkIndex + 1) / totalChunks) * 40) + 55
    await setProgress(jobId, Math.min(chunkProgress, 95),
      `Processing rows ${chunkIndex * CHUNK_SIZE + 1}–${Math.min((chunkIndex + 1) * CHUNK_SIZE, totalRows)} of ${totalRows}…`
    )

    const errors: string[] = Array.isArray(job.rowErrors) ? job.rowErrors as string[] : []

    await prisma.$transaction(
      chunk
        .filter(row => {
          if (!row.customerId || !row.lessonId || !row.lessonDate || !row.instructorName) {
            errors.push(`Skipped: missing fields for "${row.customerName || row.customerId}"`)
            return false
          }
          return true
        })
        .map(row =>
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

    // ── Queue next chunk OR mark complete ───────────────────────────────────
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
          rowsJson: null, // clear raw data — no longer needed
        },
      })
    } else {
      // Update errors so far and queue next chunk
      await prisma.importJob.update({ where: { id: jobId }, data: { rowErrors: errors } })

      const qstashToken = process.env.QSTASH_TOKEN!
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`

      await fetch(`https://qstash.upstash.io/v2/publish/${appUrl}/api/import/process`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '3',
          'Upstash-Retry-Delay': '2s',
        },
        body: JSON.stringify({ jobId, chunkIndex: chunkIndex + 1 }),
      })
    }

    return NextResponse.json({ ok: true, chunkIndex, isLastChunk })

  } catch (error) {
    console.error('Process chunk error:', error)
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'failed', message: `Import failed at chunk ${chunkIndex}: ${String(error)}` },
    }).catch(() => {})
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// Wrap with QStash signature verification — rejects any request not from QStash
export const POST = verifySignatureAppRouter(handler)