import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')

    if (!location) {
      return NextResponse.json(
        { error: 'Location parameter is required' },
        { status: 400 }
      )
    }

    // Search for lessons by location name
    const lessons = await prisma.lesson.findMany({
      where: {
        location: {
          name: {
            contains: location,
            mode: 'insensitive'
          }
        }
      },
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        },
        lessonParticipants: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    if (lessons.length === 0) {
      return NextResponse.json({
        message: 'No lessons found at this location',
        lessons: []
      })
    }

    return NextResponse.json({
      message: 'Lessons found',
      lessons
    })

  } catch (error) {
    console.error('Lesson search error:', error)
    return NextResponse.json(
      { error: 'Internal server error during lesson search' },
      { status: 500 }
    )
  }
}
