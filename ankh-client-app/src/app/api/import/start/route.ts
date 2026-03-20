import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Client } from '@upstash/qstash'
import * as XLSX from 'xlsx'

// ── Exact header mapping for this file ───────────────────────────────────────
// Maps every known header variant → our internal field name
const HEADER_MAP: Record<string, string> = {
  // Customer ID
  'customer id': 'customerId',
  'customerid': 'customerId',

  // Customer Name
  'customer name': 'customerName',
  'customername': 'customerName',

  // Lesson ID
  'lesson id': 'lessonId',
  'lessonid': 'lessonId',

  // Lesson Date
  'lesson date': 'lessonDate',
  'lessondate': 'lessonDate',
  'date': 'lessonDate',
  'timestamp': 'lessonDate',

  // Instructor
  'instructor name': 'instructorName',
  'instructorname': 'instructorName',
  'instructor': 'instructorName',

  // Location — the file uses "Lesson Location" not "Location Name"
  'lesson location': 'locationName',
  'lessonlocation': 'locationName',
  'location name': 'locationName',
  'locationname': 'locationName',
  'location': 'locationName',

  // Lesson Type
  'lesson type': 'lessonType',
  'lessontype': 'lessonType',
  'type': 'lessonType',

  // Lesson Content
  'lesson content': 'lessonContent',
  'lessoncontent': 'lessonContent',
  'content': 'lessonContent',

  // Symptoms
  'customer symptoms': 'customerSymptoms',
  'customersymptoms': 'customerSymptoms',
  'symptoms': 'customerSymptoms',
  'initial symptom': 'customerSymptoms',
  'initialsymptom': 'customerSymptoms',

  // Improvements / feedback
  'customer improvements': 'courseCompletionStatus',
  'customerimprovements': 'courseCompletionStatus',
  'improvements': 'courseCompletionStatus',
  'course completion status': 'courseCompletionStatus',
  'coursecompletionstatus': 'courseCompletionStatus',
  'customer feedback': 'courseCompletionStatus',
  'customerfeedback': 'courseCompletionStatus',
  'feedback': 'courseCompletionStatus',
}

function normalizeKey(k: string): string {
  return k.toLowerCase().trim().replace(/\s+/g, ' ')
}

function parseLessonDate(value: unknown): string | null {
  if (!value) return null

  // Already a JS Date (openpyxl-style, or XLSX with cellDates:true)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString()
  }

  // Excel serial number
  if (typeof value === 'number' && value > 30000 && value < 99999) {
    const date = new Date((value - 25569) * 86400 * 1000)
    return isNaN(date.getTime()) ? null : date.toISOString()
  }

  // String
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value.trim())
    return isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
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

    // ── Parse file ──────────────────────────────────────────────────────────
    const buffer = await file.arrayBuffer()
    // Use cellDates:true so XLSX returns proper Date objects instead of serials
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // ── Normalize rows using HEADER_MAP ─────────────────────────────────────
    const rows: Record<string, string>[] = []

    for (const raw of rawRows) {
      const norm: Record<string, string> = {}

      for (const [k, v] of Object.entries(raw)) {
        const normalized = normalizeKey(k)
        const canonical = HEADER_MAP[normalized]
        if (canonical) {
          // For dates, handle specially
          if (canonical === 'lessonDate') {
            const parsed = parseLessonDate(v)
            norm[canonical] = parsed ?? ''
          } else {
            norm[canonical] = String(v ?? '').trim()
          }
        }
      }

      // Must have customerId and lessonId to be valid
      if (norm.customerId && norm.lessonId) {
        rows.push(norm)
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        error: `No valid rows found. File has ${rawRows.length} rows but none matched required columns. Headers found: ${Object.keys(rawRows[0]).join(', ')}`
      }, { status: 400 })
    }

    // ── Save job to DB ──────────────────────────────────────────────────────
    const job = await prisma.importJob.create({
      data: {
        status: 'queued',
        progress: 5,
        message: `File received — ${rows.length} rows ready to process`,
        totalRows: rows.length,
        rowErrors: [],
        rowsJson: JSON.stringify(rows),
      },
    })

    // ── Publish to QStash ───────────────────────────────────────────────────
    const qstash = new Client({
      baseUrl: process.env.QSTASH_URL!,
      token: process.env.QSTASH_TOKEN!,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    await qstash.publishJSON({
      url: `${appUrl}/api/import/process`,
      body: { jobId: job.id, phase: "refs" },
      retries: 3,
    })

    return NextResponse.json({
      jobId: job.id,
      totalRows: rows.length,
      message: 'Import queued successfully',
    })

  } catch (error) {
    console.error('Import start error:', error)
    return NextResponse.json({ error: 'Failed to start import', detail: String(error) }, { status: 500 })
  }
}