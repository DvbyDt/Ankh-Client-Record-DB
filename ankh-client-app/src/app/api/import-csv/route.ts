import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '../../../generated/prisma'
const prisma = new PrismaClient();

// Expected CSV headers for validation
const EXPECTED_HEADERS = [
  'Customer ID',
  'Customer Name',
  'Initial Symptom',
  'Lesson ID',
  'Lesson Date',
  'Instructor Name',
  'Lesson Type',
  'Customer Symptoms',
  'Customer Improvements'
]

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

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      )
    }

    // Read file content
    const fileContent = await file.text()

    // Parse CSV manually since Papa.parse has TypeScript issues
    const lines = fileContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must have headers and at least one data row' },
        { status: 400 }
      )
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return row
    })

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    // Validate headers
    const firstRow = data[0] as any
    const actualHeaders = Object.keys(firstRow)
    
    const missingHeaders = EXPECTED_HEADERS.filter(header => !actualHeaders.includes(header))
    const extraHeaders = actualHeaders.filter(header => !EXPECTED_HEADERS.includes(header))

    if (missingHeaders.length > 0 || extraHeaders.length > 0) {
      return NextResponse.json(
        { 
          error: 'CSV headers do not match expected format',
          missingHeaders,
          extraHeaders,
          expectedHeaders: EXPECTED_HEADERS,
          actualHeaders
        },
        { status: 400 }
      )
    }

    // Process data and insert into database
    let processedCount = 0
    let errorCount = 0
    const rowErrors: string[] = []

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i] as any
        const rowNumber = i + 2 // +2 because CSV is 1-indexed and we have headers

        // Extract data from row
        const customerId = row['Customer ID']?.trim()
        const customerName = row['Customer Name']?.trim()
        const lessonId = row['Lesson ID']?.trim()
        const lessonDate = row['Lesson Date']?.trim()
        const instructorName = row['Instructor Name']?.trim()
        const lessonType = row['Lesson Type']?.trim()
        const customerSymptoms = row['Customer Symptoms']?.trim()
        const customerImprovements = row['Customer Improvements']?.trim()

        // Validate required fields
        if (!customerId || !customerName || !lessonId || !lessonDate || !instructorName) {
          rowErrors.push(`Row ${rowNumber}: Missing required fields`)
          errorCount++
          continue
        }

        // Parse lesson date
        const parsedDate = new Date(lessonDate)
        if (isNaN(parsedDate.getTime())) {
          rowErrors.push(`Row ${rowNumber}: Invalid lesson date format`)
          errorCount++
          continue
        }

        // Use transaction to ensure data consistency
        await prisma.$transaction(async (tx) => {
          // Create or update customer
          const customer = await tx.customer.upsert({
            where: { id: customerId },
            update: {
              firstName: customerName.split(' ')[0] || '',
              lastName: customerName.split(' ').slice(1).join(' ') || '',
              email: `${customerId}@imported.local`, // Generate email if not exists
            },
            create: {
              id: customerId,
              firstName: customerName.split(' ')[0] || '',
              lastName: customerName.split(' ').slice(1).join(' ') || '',
              email: `${customerId}@imported.local`,
            }
          })

          // Create or update instructor (User with INSTRUCTOR role)
          const instructor = await tx.user.upsert({
            where: { email: `${instructorName.replace(/\s+/g, '')}@imported.local` },
            update: {
              firstName: instructorName.split(' ')[0] || '',
              lastName: instructorName.split(' ').slice(1).join(' ') || '',
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

          // Create or update lesson
          const lesson = await tx.lesson.upsert({
            where: { id: lessonId },
            update: {
              lessonType: lessonType || 'Group',
              instructorId: instructor.id,
              locationId: 'default-location-id', // You might want to handle this differently
            },
            create: {
              id: lessonId,
              lessonType: lessonType || 'Group',
              instructorId: instructor.id,
              locationId: 'default-location-id', // You might want to handle this differently
              // title: `Lesson ${lessonId}`, // Removed as it is not part of LessonCreateInput
              // startTime: new Date().toISOString(), // Provide a default start time
              // endTime: new Date(new Date().getTime() + 3600000).toISOString(), // Provide a default end time (1 hour later)
              // courseCompletionStatus: 'incomplete' // Provide a default course completion status
            }
          })

          // Create or update lesson participant
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
              status: 'attended'
            },
            create: {
              customerId: customer.id,
              lessonId: lesson.id,
              customerSymptoms: customerSymptoms || null,
              customerImprovements: customerImprovements || null,
              status: 'attended'
            }
          })
        })

        processedCount++
      } catch (rowError) {
        rowErrors.push(`Row ${i + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`)
        errorCount++
      }
    }

    // Return results
    if (errorCount > 0) {
      return NextResponse.json({
        message: `Import completed with ${errorCount} errors`,
        processedCount,
        errorCount,
        errors: rowErrors.slice(0, 10) // Limit error messages
      }, { status: 207 }) // 207 Multi-Status
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
