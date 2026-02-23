import { NextRequest, NextResponse } from 'next/server'
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
  'lesson content',
  'course completion status'
]

// Aliases to support different upload templates (lowercase keys)
const HEADER_ALIASES: Record<string, string> = {
  'customer_id': 'customer id',
  'customer name': 'customer name',
  'customer_name': 'customer name',
  'client_name': 'customer name',
  'initial symptom': 'initial symptom',
  'client_condition_before_after': 'course completion status',
  'customer improvements': 'course completion status',
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
  'owner_feedback': 'lesson content',
  'course completion status': 'course completion status',
  'course_completion_status': 'course completion status',
  'customer feedback': 'course completion status',
  'customer feedback/specifics': 'course completion status',
  'customer feedback specifics': 'course completion status'
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

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

const buildInstructorEmail = (name: string) =>
  `${name.replace(/\s+/g, '')}@imported.local`

const buildInstructorUsername = (name: string) => {
  const compact = name.replace(/\s+/g, '') || 'instructor'
  return `${compact}_${hashString(name)}`
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
    const validRows: Array<{
      customerId: string
      customerName: string
      lessonId: string
      lessonDate: string
      parsedLessonDate: Date
      instructorName: string
      lessonType: string
      locationName: string
      customerSymptoms: string
      customerImprovements: string
      lessonContent: string
      courseCompletionStatus: string
    }> = []

    for (let i = 0; i < data.length; i++) {
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
      const courseCompletionStatus = row['course completion status']

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

      validRows.push({
        customerId,
        customerName,
        lessonId,
        lessonDate,
        parsedLessonDate: parsedDate,
        instructorName,
        lessonType,
        locationName,
        customerSymptoms,
        customerImprovements,
        lessonContent,
        courseCompletionStatus
      })
    }

    if (validRows.length > 0) {
      const batchSize = 50

      const customers = new Map<string, { id: string; name: string }>()
      const instructors = new Map<string, { email: string; name: string }>()
      const locations = new Set<string>()
      const lessons = new Map<string, {
        id: string
        instructorEmail: string
        locationName: string
        lessonType: string
        lessonContent: string
        lessonDate: Date
      }>()

      validRows.forEach(row => {
        customers.set(row.customerId, { id: row.customerId, name: row.customerName })

        const instructorEmail = buildInstructorEmail(row.instructorName)
        instructors.set(instructorEmail, { email: instructorEmail, name: row.instructorName })

        const normalizedLocation = row.locationName?.trim() || 'Default Location'
        locations.add(normalizedLocation)

        if (!lessons.has(row.lessonId)) {
          lessons.set(row.lessonId, {
            id: row.lessonId,
            instructorEmail,
            locationName: normalizedLocation,
            lessonType: row.lessonType || 'Group',
            lessonContent: row.lessonContent || '',
            lessonDate: row.parsedLessonDate
          })
        } else {
          const existingLesson = lessons.get(row.lessonId)
          if (existingLesson) {
            if (row.parsedLessonDate < existingLesson.lessonDate) {
              existingLesson.lessonDate = row.parsedLessonDate
            }
            if (!existingLesson.lessonContent && row.lessonContent) {
              existingLesson.lessonContent = row.lessonContent
            }
          }
        }
      })

      const locationNames = Array.from(locations)
      for (const chunk of chunkArray(locationNames, batchSize)) {
        await prisma.$transaction(
          chunk.map(name =>
            prisma.location.upsert({
              where: { name },
              update: {},
              create: { name }
            })
          )
        )
      }

      const locationRecords = await prisma.location.findMany({
        where: { name: { in: locationNames } }
      })
      const locationIdByName = new Map(locationRecords.map(loc => [loc.name, loc.id]))

      const instructorRecords = Array.from(instructors.values())
      for (const chunk of chunkArray(instructorRecords, batchSize)) {
        await prisma.$transaction(
          chunk.map(instructor => {
            const [firstName, ...rest] = instructor.name.split(' ')
            return prisma.user.upsert({
              where: { email: instructor.email },
              update: {
                firstName: firstName || '',
                lastName: rest.join(' ') || ''
              },
              create: {
                username: buildInstructorUsername(instructor.name),
                password: 'imported_password_hash',
                role: 'INSTRUCTOR',
                firstName: firstName || '',
                lastName: rest.join(' ') || '',
                email: instructor.email
              }
            })
          })
        )
      }

      const instructorEmails = instructorRecords.map(record => record.email)
      const instructorUsers = await prisma.user.findMany({
        where: { email: { in: instructorEmails } }
      })
      const instructorIdByEmail = new Map(instructorUsers.map(user => [user.email, user.id]))

      const customerRecords = Array.from(customers.values())
      for (const chunk of chunkArray(customerRecords, batchSize)) {
        await prisma.$transaction(
          chunk.map(customer => {
            const [firstName, ...rest] = customer.name.split(' ')
            return prisma.customer.upsert({
              where: { id: customer.id },
              update: {
                firstName: firstName || '',
                lastName: rest.join(' ') || '',
                email: `${customer.id}@imported.local`
              },
              create: {
                id: customer.id,
                firstName: firstName || '',
                lastName: rest.join(' ') || '',
                email: `${customer.id}@imported.local`
              }
            })
          })
        )
      }

      const lessonRecords = Array.from(lessons.values())
      for (const chunk of chunkArray(lessonRecords, batchSize)) {
        await prisma.$transaction(
          chunk.map(lesson => {
            const instructorId = instructorIdByEmail.get(lesson.instructorEmail)
            const locationId = locationIdByName.get(lesson.locationName)

            if (!instructorId || !locationId) {
              throw new Error('Missing instructor or location during lesson import')
            }

            return prisma.lesson.upsert({
              where: { id: lesson.id },
              update: {
                lessonType: lesson.lessonType || 'Group',
                instructorId,
                locationId,
                lessonContent: lesson.lessonContent || null,
                createdAt: lesson.lessonDate
              },
              create: {
                id: lesson.id,
                lessonType: lesson.lessonType || 'Group',
                instructorId,
                locationId,
                lessonContent: lesson.lessonContent || null,
                createdAt: lesson.lessonDate
              }
            })
          })
        )
      }

      for (const chunk of chunkArray(validRows, batchSize)) {
        await prisma.$transaction(
          chunk.map(row =>
            prisma.lessonParticipant.upsert({
              where: {
                customerId_lessonId: {
                  customerId: row.customerId,
                  lessonId: row.lessonId
                }
              },
              update: {
                customerSymptoms: row.customerSymptoms || null,
                customerImprovements: row.courseCompletionStatus || row.customerImprovements || null,
                status: 'attended'
              },
              create: {
                customerId: row.customerId,
                lessonId: row.lessonId,
                customerSymptoms: row.customerSymptoms || null,
                customerImprovements: row.courseCompletionStatus || row.customerImprovements || null,
                status: 'attended'
              }
            })
          )
        )
      }

      processedCount = validRows.length
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
