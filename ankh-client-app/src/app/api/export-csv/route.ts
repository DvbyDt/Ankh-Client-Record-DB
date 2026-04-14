import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const csvEscape = (value: unknown) => {
  const s = (value ?? '').toString()
  // Escape if contains comma, quote, or newline
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(_request: NextRequest) {
  try {
    const lessonParticipants = await prisma.lessonParticipant.findMany({
      where: { customer: { deletedAt: null } },
      orderBy: { lesson: { createdAt: 'desc' } },
      select: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        lesson: {
          select: {
            id: true,
            lessonType: true,
            lessonContent: true,
            createdAt: true,
            instructor: { select: { firstName: true, lastName: true } },
            location: { select: { name: true } }
          }
        },
        customerSymptoms: true,
        customerImprovements: true
      }
    })

    const headers = [
      'Customer ID',
      'Customer Name',
      'Initial Symptom',
      'Lesson ID',
      'Lesson Date',
      'Instructor Name',
      'Lesson Type',
      'Location Name',
      'Customer Symptoms',
      'Lesson Content',
      'Course Completion Status'
    ]

    const rows = lessonParticipants.map(p => {
      const customerName = `${p.customer.firstName} ${p.customer.lastName}`.trim()
      const instructorName = p.lesson.instructor
        ? `${p.lesson.instructor.firstName} ${p.lesson.instructor.lastName}`.trim()
        : ''
      const lessonDate = p.lesson.createdAt
        ? new Date(p.lesson.createdAt).toISOString().slice(0, 10)
        : ''

      return [
        p.customer.id,
        customerName,
        '', // Initial Symptom is not stored in current schema
        p.lesson.id,
        lessonDate,
        instructorName,
        p.lesson.lessonType || '',
        p.lesson.location?.name || '',
        p.customerSymptoms || '',
        p.lesson.lessonContent || '',
        p.customerImprovements || ''
      ].map(csvEscape).join(',')
    })

    // UTF-8 BOM (\uFEFF) ensures Excel opens Korean characters correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')

    const response = new NextResponse(csvContent)
    response.headers.set('Content-Type', 'text/csv; charset=utf-8')
    response.headers.set(
      'Content-Disposition',
      'attachment; filename="customer_records.csv"'
    )
    return response

  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json(
      { error: 'Internal server error during CSV export' },
      { status: 500 }
    )
  }
}
