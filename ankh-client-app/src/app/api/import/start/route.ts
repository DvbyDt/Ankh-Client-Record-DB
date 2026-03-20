import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Client } from '@upstash/qstash'
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

    // ── Parse file ──────────────────────────────────────────────────────────
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // ── Normalize rows ──────────────────────────────────────────────────────
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

    // ── Save job + rows to DB ───────────────────────────────────────────────
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

    // ── Publish to QStash using official SDK ────────────────────────────────
    // The SDK reads QSTASH_URL and QSTASH_TOKEN from env automatically
    const qstash = new Client({
      baseUrl: process.env.QSTASH_URL!,
      token: process.env.QSTASH_TOKEN!,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    await qstash.publishJSON({
      url: `${appUrl}/api/import/process`,
      body: { jobId: job.id, chunkIndex: 0 },
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