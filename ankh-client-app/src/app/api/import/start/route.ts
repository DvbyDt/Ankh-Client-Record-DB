import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Client } from '@upstash/qstash'
import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'

const HEADER_MAP: Record<string, string> = {
  'customer id': 'customerId', 'customerid': 'customerId',
  'customer name': 'customerName', 'customername': 'customerName',
  'lesson id': 'lessonId', 'lessonid': 'lessonId',
  'lesson date': 'lessonDate', 'lessondate': 'lessonDate', 'date': 'lessonDate',
  'instructor name': 'instructorName', 'instructorname': 'instructorName', 'instructor': 'instructorName',
  'lesson location': 'locationName', 'lessonlocation': 'locationName',
  'location name': 'locationName', 'locationname': 'locationName', 'location': 'locationName',
  'lesson type': 'lessonType', 'lessontype': 'lessonType',
  'lesson content': 'lessonContent', 'lessoncontent': 'lessonContent', 'content': 'lessonContent',
  'customer symptoms': 'customerSymptoms', 'customersymptoms': 'customerSymptoms', 'symptoms': 'customerSymptoms',
  'initial symptom': 'initialSymptom', 'initialsymptom': 'initialSymptom',
  'customer improvements': 'customerImprovements', 'customerimprovements': 'customerImprovements',
  'course completion status': 'customerFeedback', 'coursecompletionstatus': 'customerFeedback',
  'customer feedback': 'customerFeedback', 'customerfeedback': 'customerFeedback',
}

function safeDate(val: unknown): Date | undefined {
  if (!val) return undefined
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val
  if (typeof val === 'number' && val > 30000 && val < 99999) {
    const d = new Date((val - 25569) * 86400 * 1000)
    return isNaN(d.getTime()) ? undefined : d
  }
  if (typeof val === 'string' && val.trim()) {
    const d = new Date(val.trim())
    return isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json({ error: 'File must be CSV, XLSX, or XLS' }, { status: 400 })
    }

    // ── 1. Parse file ─────────────────────────────────────────────────────────
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })

    if (rawRows.length === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })

    // ── 2. Normalize rows ─────────────────────────────────────────────────────
    type NRow = {
      customerId: string; customerName: string; lessonId: string
      lessonDate: Date | undefined; instructorName: string; lessonType: string
      locationName: string; lessonContent: string | null
      customerSymptoms: string | null; initialSymptom: string | null
      customerImprovements: string | null; customerFeedback: string | null
    }

    const rows: NRow[] = []
    for (const raw of rawRows) {
      const norm: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) {
        const key = k.toLowerCase().trim().replace(/\s+/g, ' ')
        const canonical = HEADER_MAP[key]
        if (canonical) norm[canonical] = v
      }
      if (!norm.customerId || !norm.lessonId) continue
      rows.push({
        customerId: String(norm.customerId).trim(),
        customerName: String(norm.customerName || '').trim(),
        lessonId: String(norm.lessonId).trim(),
        lessonDate: safeDate(norm.lessonDate),
        instructorName: String(norm.instructorName || '').trim(),
        lessonType: String(norm.lessonType || 'Group').trim(),
        locationName: String(norm.locationName || 'Default Location').trim(),
        lessonContent: norm.lessonContent ? String(norm.lessonContent).trim() : null,
        customerSymptoms: norm.customerSymptoms ? String(norm.customerSymptoms).trim() : null,
        initialSymptom: norm.initialSymptom ? String(norm.initialSymptom).trim() : null,
        customerImprovements: norm.customerImprovements ? String(norm.customerImprovements).trim() : null,
        customerFeedback: norm.customerFeedback ? String(norm.customerFeedback).trim() : null,
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found — check column headers' }, { status: 400 })
    }

    // ── 3. Create job record ──────────────────────────────────────────────────
    const job = await prisma.importJob.create({
      data: {
        status: 'processing',
        progress: 5,
        message: `Uploading ${rows.length} rows…`,
        totalRows: rows.length,
        rowErrors: [],
        rowsJson: null, // We do NOT store rows in DB anymore
      },
    })

    // ── 4. Do refs synchronously here — fast, <5 seconds ─────────────────────
    await prisma.importJob.update({ where: { id: job.id }, data: { progress: 8, message: 'Setting up locations…' } })

    const locationNames = [...new Set(rows.map(r => r.locationName))]
    await prisma.location.createMany({
      data: locationNames.map(name => ({ name })),
      skipDuplicates: true,
    })

    await prisma.importJob.update({ where: { id: job.id }, data: { progress: 16, message: 'Setting up instructors…' } })

    const hashedPw = await bcrypt.hash('DefaultPass123!', 10)
    const uniqueInstructors = new Map<string, string>()
    for (const row of rows) {
      if (!row.instructorName) continue
      const email = `${row.instructorName.replace(/\s+/g, '.').toLowerCase()}@instructor.local`
      uniqueInstructors.set(email, row.instructorName)
    }
    await prisma.user.createMany({
      data: [...uniqueInstructors.entries()].map(([email, name]) => {
        const parts = name.split(/\s+/)
        return { username: email, password: hashedPw, role: 'INSTRUCTOR' as const, firstName: parts[0] || name, lastName: parts.slice(1).join(' ') || '', email }
      }),
      skipDuplicates: true,
    })

    await prisma.importJob.update({ where: { id: job.id }, data: { progress: 24, message: 'Importing customers…' } })

    const uniqueCustomers = new Map<string, { firstName: string; lastName: string; email: string }>()
    for (const row of rows) {
      if (!row.customerId || uniqueCustomers.has(row.customerId)) continue
      const parts = row.customerName.split(/\s+/)
      uniqueCustomers.set(row.customerId, {
        firstName: parts[0] || 'Unknown',
        lastName: parts.slice(1).join(' ') || '',
        email: `customer_${row.customerId}@imported.local`,
      })
    }
    await prisma.customer.createMany({
      data: [...uniqueCustomers.entries()].map(([id, c]) => ({ id, ...c })),
      skipDuplicates: true,
    })

    // ── 5. Fetch IDs and build lesson + participant data ───────────────────────
    const [instructorRecords, locationRecords] = await Promise.all([
      prisma.user.findMany({ where: { email: { in: [...uniqueInstructors.keys()] } }, select: { id: true, email: true } }),
      prisma.location.findMany({ where: { name: { in: locationNames } }, select: { id: true, name: true } }),
    ])
    const instructorIdByEmail = Object.fromEntries(instructorRecords.map(u => [u.email, u.id]))
    const locationIdByName = Object.fromEntries(locationRecords.map(l => [l.name, l.id]))

    // Build minimal lesson rows (only what DB needs, no text content)
    type LessonRow = { id: string; lessonType: string; lessonContent: string | null; instructorId: string; locationId: string; createdAt?: Date }
    type ParticipantRow = { customerId: string; lessonId: string; customerSymptoms: string | null; customerImprovements: string | null; status: string }

    const lessonRows: LessonRow[] = []
    const seenLessons = new Set<string>()
    const participantRows: ParticipantRow[] = []

    for (const row of rows) {
      const email = `${row.instructorName.replace(/\s+/g, '.').toLowerCase()}@instructor.local`
      const instructorId = instructorIdByEmail[email]
      const locationId = locationIdByName[row.locationName]
      if (!instructorId || !locationId) continue

      if (!seenLessons.has(row.lessonId)) {
        seenLessons.add(row.lessonId)
        const lessonRow: LessonRow = {
          id: row.lessonId,
          lessonType: row.lessonType,
          lessonContent: row.lessonContent,
          instructorId,
          locationId,
        }
        if (row.lessonDate) lessonRow.createdAt = row.lessonDate
        lessonRows.push(lessonRow)
      }

      participantRows.push({
        customerId: row.customerId,
        lessonId: row.lessonId,
        customerSymptoms: row.customerSymptoms || row.initialSymptom,
        customerImprovements: row.customerImprovements,
        status: row.customerFeedback || 'attended',
      })
    }

    // ── 6. Store ONLY lesson + participant data in DB (much smaller) ──────────
    // lessonRows: ~200 bytes each vs 907 bytes for full rows
    // participantRows: ~150 bytes each
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        progress: 30,
        message: `References done — importing ${lessonRows.length} lessons…`,
        rowsJson: JSON.stringify({ lessons: lessonRows, participants: participantRows }),
      },
    })

    // ── 7. Queue first lesson chunk ───────────────────────────────────────────
    const qstash = new Client({ baseUrl: process.env.QSTASH_URL!, token: process.env.QSTASH_TOKEN! })
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL!}/api/import/process`,
      body: { jobId: job.id, phase: 'lessons', chunkIndex: 0 },
      retries: 2,
    })

    return NextResponse.json({ jobId: job.id, totalRows: rows.length, message: 'Import started' })

  } catch (error) {
    console.error('Import start error:', error)
    return NextResponse.json({ error: 'Failed to start import', detail: String(error) }, { status: 500 })
  }
}