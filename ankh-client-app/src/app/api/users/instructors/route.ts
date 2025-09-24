import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const instructors = await prisma.user.findMany({
      where: {
        role: 'INSTRUCTOR'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    return NextResponse.json({ results: instructors })

  } catch (error) {
    console.error('Error fetching instructors:', error)
    
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch instructors',
        details: errorMessage,
        results: [] // Ensure results array exists even on error
      },
      { status: 500 }
    )
  }
}
