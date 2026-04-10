import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const instructors = await prisma.user.findMany({
      where: { role: { in: ['INSTRUCTOR', 'MANAGER'] }, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    })

    return NextResponse.json(
      { results: instructors },
      {
        headers: {
          // Instructor list is stable — serve from cache for 60s,
          // then stale-while-revalidate for up to 5 minutes.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching instructors:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to fetch instructors', details: errorMessage, results: [] },
      { status: 500 }
    )
  }
}