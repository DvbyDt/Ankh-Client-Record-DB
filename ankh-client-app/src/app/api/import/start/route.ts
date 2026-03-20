import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const ALIASES: Record<string, string> = {
  'customer id': 'customerId', 'customerid': 'customerId',
  'customer name': 'customerName', 'customername': 'customerName',
  'lesson id': 'lessonId', 'lessonid': 'lessonId',
  'lesson date': 'lessonDate', 'lessondate': 'lessonDate', 'date': 'lessonDate',
  'instructor name': 'instructorName', 'instructorname': 'instructorName', 'instructor': 'instructorName',
  'lesson type': 'lessonType', 'lessontype': 'lessonType',
  'location name': 'locationName', 'locationname': 'locationName', 'location': 'locationName',
  'lesson content': 'lessonContent', 'lessoncontent': 'lessonContent', 'content': 'lessonContent',
  'customer symptoms': 'customerSymptoms', 'customersymptoms': 'customerSymptoms', 'symptoms': 'customerSymptoms',
  'course completion status': 'courseCompletionStatus', 'improvements': 'courseCompletionStatus',
  'customer improvements': 'courseCompletionStatus', 'coursecompletionstatus': 'courseCompletionStatus',
}

function parseLessonDate(value: unknown): string | null {
  if (typeof value === 'number' && value > 30000 && value < 99999) {
    const date = new Date((value - 25569) * 86400 * 1000)
    return isNaN(date.getTime()) ? null : date.toISOString()
  }
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

    // ── Parse file ────────────────────────────────────────────────────────────
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // ── Normalize rows ────────────────────────────────────────────────────────
    const rows = rawRows.map(raw => {
      const norm: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        const key = k.toLowerCase().trim().replace(/\s+/g, ' ')
        const canonical = ALIASES[key] || key
        norm[canonical] = String(v ?? '').trim()
      }
      const dateKey = Object.keys(raw).find(k =>
        k.toLowerCase().includes('date') || k.toLowerCase() === 'lesson date'
      )
      const parsedDate = parseLessonDate(dateKey ? raw[dateKey] : undefined)
      if (parsedDate) norm.lessonDate = parsedDate
      return norm
    }).filter(r => r.customerId && r.lessonId)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found — check column headers' }, { status: 400 })
    }

    // ── Save job + rows to DB ─────────────────────────────────────────────────
    // Rows are stored in DB, never sent to QStash (no size limits this way)
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

    // ── Send jobId to QStash ──────────────────────────────────────────────────
    // QStash will call /api/import/process with { jobId, chunkIndex: 0 }
    // We only send the jobId — QStash never sees the row data
    const qstashToken = process.env.QSTASH_TOKEN
    console.log('QSTASH_TOKEN starts with:', process.env.QSTASH_TOKEN?.slice(0, 15))
    if (!qstashToken) throw new Error('QSTASH_TOKEN env var is not set')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`

    const qstashRes = await fetch(
      `https://qstash-eu-central-1.upstash.io/v2/publish/${appUrl}/api/import/process`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          // Retry up to 3 times if the endpoint fails
          'Upstash-Retries': '3',
          // Wait 2 seconds between retries
          'Upstash-Retry-Delay': '2s',
        },
        body: JSON.stringify({ jobId: job.id, chunkIndex: 0 }),
      }
    )

    if (!qstashRes.ok) {
      const err = await qstashRes.text()
      console.error('QStash publish error:', err)
      // Don't fail the request — job is already created in DB
      // Mark it as failed so the UI shows an error
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: 'failed', message: `Failed to queue job: ${err}` },
      })
      return NextResponse.json({ error: 'Failed to queue import job' }, { status: 500 })
    }

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