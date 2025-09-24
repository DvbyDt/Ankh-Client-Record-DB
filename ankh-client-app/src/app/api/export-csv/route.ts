import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Fetch all lesson participants with related data for customer progress tracking
    const lessonParticipants = await prisma.lessonParticipant.findMany({
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        lesson: {
          include: {
            instructor: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            },
            location: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        lesson: {
          startTime: 'desc'
        }
      }
    })

    if (lessonParticipants.length === 0) {
      return NextResponse.json({
        message: 'No lesson records found',
        csv: 'Customer ID,Customer Name,Initial Symptom,Lesson ID,Lesson Date,Instructor Name,Lesson Type,Lesson Content,Customer Symptoms,Customer Improvements,Course Completion Status\n'
      })
    }

    // Generate CSV content
    const csvHeaders = [
      'Customer ID',
      'Customer Name',
      'Initial Symptom',
      'Lesson ID',
      'Lesson Date',
      'Instructor Name',
      'Lesson Type',
      'Lesson Content',
      'Customer Symptoms',
      'Customer Improvements',
      'Course Completion Status'
    ].join(',')

    const csvRows = lessonParticipants.map(participant => [
      participant.customer.id,
      `${participant.customer.firstName} ${participant.customer.lastName}`,
      '', // Initial Symptom - not stored in current schema
      participant.lesson.id,
      new Date(participant.lesson.startTime).toLocaleDateString('en-US'),
      `${participant.lesson.instructor.firstName} ${participant.lesson.instructor.lastName}`,
      participant.lesson.lessonType || 'Group',
      participant.lesson.title || 'Lesson',
      participant.customerSymptoms || '',
      participant.customerImprovements || '',
      participant.lesson.courseCompletionStatus || 'In Progress'
    ].join(','))

    const csvContent = [csvHeaders, ...csvRows].join('\n')

    // Set response headers for file download
    const response = new NextResponse(csvContent)
    response.headers.set('Content-Type', 'text/csv')
    response.headers.set('Content-Disposition', 'attachment; filename="customer_records.csv"')

    return response

  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json(
      { error: 'Internal server error during CSV export' },
      { status: 500 }
    )
  }
}
