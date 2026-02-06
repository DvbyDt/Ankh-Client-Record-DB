import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Required headers (canonical, case-insensitive)
const REQUIRED_HEADERS = [
  'customer id',
  'customer name',
  'initial symptom',
  'lesson id',
  'lesson date',
  'instructor name',
  'lesson type',
  'customer symptoms',
  'customer improvements',
  'lesson content'
]

// Aliases to support different upload templates (lowercase keys)
const HEADER_ALIASES: Record<string, string> = {
  'customer_id': 'customer id',
  'customer name': 'customer name',
  'customer_name': 'customer name',
  'client_name': 'customer name',
  'initial symptom': 'initial symptom',
  'client_condition_before_after': 'customer improvements',
  'customer improvements': 'customer improvements',
  'customer symptoms': 'customer symptoms',
  'client_notes': 'customer symptoms',
  'lesson id': 'lesson id',
  'lesson_id': 'lesson id',
  'lesson date': 'lesson date',
  'lesson_date': 'lesson date',
  'timestamp': 'lesson date',
  'instructor name': 'instructor name',
  'instructor_name': 'instructor name',
  'lesson type': 'lesson type',
  'lesson_type': 'lesson type',
  'care_program': 'lesson type',
  'location': 'location name',
  'location name': 'location name',
  'location_name': 'location name',
  'lesson content': 'lesson content',
  'lesson_content': 'lesson content',
  'lesson details': 'lesson content',
  'lesson_details': 'lesson content',
  'owner_feedback': 'lesson content'
}

const normalizeHeader = (header: string) =>
  header
    .replace(/\u00a0/g, ' ') // normalize non-breaking spaces
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const canonicalHeader = (header: string) => {
  const normalized = normalizeHeader(header)
  return HEADER_ALIASES[normalized] ?? normalized
}

const ensureLocation = async (
  tx: Prisma.TransactionClient,
  name?: string | null
): Promise<string> => {
  const targetName = name?.trim() || 'Default Location'

  const location = await tx.location.upsert({
    where: { name: targetName },
    update: {},
    create: { name: targetName }
  })

  return location.id
}

// Parse dates from either ISO-like strings or Excel serial numbers
const parseLessonDate = (value: string): Date | null => {
  const trimmed = value?.toString().trim()
  if (!trimmed) return null

  // Excel serial dates are numbers (days since 1899-12-31, with 1900 leap bug)
  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric) && numeric > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const millis = numeric * 24 * 60 * 60 * 1000
    return new Date(excelEpoch.getTime() + millis)
  }

  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

    if (!isCSV && !isExcel) {
      return NextResponse.json(
        { error: 'File must be CSV (.csv) or Excel (.xlsx, .xls) format' },
        { status: 400 }
      )
    }

    const fileBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(fileBuffer)

    let data: Record<string, any>[] = []

    if (isExcel) {
      const workbook = XLSX.read(uint8Array, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]
    } else {
      const fileContent = await file.text()
      const lines = fileContent.split(/\r?\n/).filter(line => line.trim())

      if (lines.length < 2) {
        return NextResponse.json(
          { error: 'File must have headers and at least one data row' },
          { status: 400 }
        )
      }

      const headers = lines[0].split(',').map(h => h.trim())
      data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    const firstRow = data[0]
    const actualHeaders = Object.keys(firstRow).map(canonicalHeader)
    const actualHeaderSet = new Set(actualHeaders)
    const missingHeaders = REQUIRED_HEADERS.filter(header => !actualHeaderSet.has(header))

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: 'Import file is missing required headers',
          missingHeaders,
          expectedHeaders: REQUIRED_HEADERS
        },
        { status: 400 }
      )
    }

    let processedCount = 0
    let errorCount = 0
    const rowErrors: string[] = []

    for (let i = 0; i < data.length; i++) {
      try {
        const rowNumber = i + 2 // +2 because CSV is 1-indexed and we have headers

        const rawRow = data[i] as Record<string, any>
        const row: Record<string, string> = {}
        Object.entries(rawRow).forEach(([key, value]) => {
          const canonical = canonicalHeader(key)
          row[canonical] = (value ?? '').toString().trim()
        })

        const customerId = row['customer id']
        const customerName = row['customer name']
        const lessonId = row['lesson id']
        const lessonDate = row['lesson date']
        const instructorName = row['instructor name']
        const lessonType = row['lesson type']
        const locationName = row['location name']
        const customerSymptoms = row['customer symptoms']
        const customerImprovements = row['customer improvements']
        const lessonContent = row['lesson content']

        if (!customerId || !customerName || !lessonId || !lessonDate || !instructorName) {
          rowErrors.push(`Row ${rowNumber}: Missing required fields`)
          errorCount++
          continue
        }

        const parsedDate = parseLessonDate(lessonDate)
        if (!parsedDate) {
          rowErrors.push(`Row ${rowNumber}: Invalid lesson date format`)
          errorCount++
          continue
        }

        await prisma.$transaction(async (tx) => {
          const customer = await tx.customer.upsert({
            where: { id: customerId },
            update: {
              firstName: customerName.split(' ')[0] || '',
              lastName: customerName.split(' ').slice(1).join(' ') || '',
              email: `${customerId}@imported.local`,
              deletedAt: null,
            },
            create: {
              id: customerId,
              firstName: customerName.split(' ')[0] || '',
              lastName: customerName.split(' ').slice(1).join(' ') || '',
              email: `${customerId}@imported.local`,
            }
          })

          const instructor = await tx.user.upsert({
            where: { email: `${instructorName.replace(/\s+/g, '')}@imported.local` },
            update: {
              firstName: instructorName.split(' ')[0] || '',
              lastName: instructorName.split(' ').slice(1).join(' ') || '',
              deletedAt: null,
            },
            create: {
              username: `${instructorName.replace(/\s+/g, '')}_${Date.now()}`,
              password: 'imported_password_hash', // This should be properly hashed
              role: 'INSTRUCTOR',
              firstName: instructorName.split(' ')[0] || '',
              lastName: instructorName.split(' ').slice(1).join(' ') || '',
              email: `${instructorName.replace(/\s+/g, '')}@imported.local`,
            }
          })

          const locationId = await ensureLocation(tx, locationName)

          const lesson = await tx.lesson.upsert({
            where: { id: lessonId },
            update: {
              lessonType: lessonType || 'Group',
              instructorId: instructor.id,
              locationId,
              deletedAt: null
            },
            create: {
              id: lessonId,
              lessonType: lessonType || 'Group',
              instructorId: instructor.id,
              locationId
            }
          })

          await tx.lessonParticipant.upsert({
            where: {
              customerId_lessonId: {
                customerId: customer.id,
                lessonId: lesson.id
              }
            },
            update: {
              customerSymptoms: customerSymptoms || null,
              customerImprovements: customerImprovements || null,
              status: 'attended',
              deletedAt: null
            },
            create: {
              customerId: customer.id,
              lessonId: lesson.id,
              customerSymptoms: customerSymptoms || null,
              customerImprovements: customerImprovements || null,
              status: 'attended'
            }
          })
        }, {
          maxWait: 10000, // Wait up to 10 seconds to start transaction
          timeout: 30000, // Transaction timeout of 30 seconds
        })

        processedCount++
      } catch (rowError) {
        rowErrors.push(`Row ${i + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`)
        errorCount++
      }
    }

    if (errorCount > 0) {
      return NextResponse.json({
        message: `Import completed with ${errorCount} errors`,
        processedCount,
        errorCount,
        errors: rowErrors.slice(0, 10)
      }, { status: 207 })
    }

    return NextResponse.json({
      message: 'CSV import completed successfully',
      processedCount,
      errorCount: 0
    }, { status: 200 })

  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: 'Internal server error during CSV import' },
      { status: 500 }
    )
  }
}
