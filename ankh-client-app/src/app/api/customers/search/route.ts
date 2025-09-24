import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json(
        { error: 'Name parameter is required' },
        { status: 400 }
      )
    }

    // Search for customers by name (first name or last name)
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
          { email: { contains: name, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
        lessonParticipants: {
          select: {
            lesson: {
              select: {
                id: true,
                title: true,
                startTime: true,
                instructor: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: {
            lesson: {
              startTime: 'desc'
            }
          },
          take: 5 // Limit to last 5 lessons
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ],
      take: 10 // Limit results
    })

    if (customers.length === 0) {
      return NextResponse.json({
        message: 'No customers found',
        customers: []
      })
    }

    return NextResponse.json({
      message: 'Customers found',
      customers
    })

  } catch (error) {
    console.error('Customer search error:', error)
    return NextResponse.json(
      { error: 'Internal server error during customer search' },
      { status: 500 }
    )
  }
}
