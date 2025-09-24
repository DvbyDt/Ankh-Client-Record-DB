import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const locations = await prisma.location.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ locations })

  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Internal server error while fetching locations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      )
    }

    // Check if location already exists
    const existingLocation = await prisma.location.findUnique({
      where: { name: name.trim() }
    })

    if (existingLocation) {
      return NextResponse.json(
        { error: 'Location with this name already exists' },
        { status: 409 }
      )
    }

    // Create location
    const newLocation = await prisma.location.create({
      data: {
        name: name.trim()
      },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      message: 'Location created successfully',
      location: newLocation
    }, { status: 201 })

  } catch (error) {
    console.error('Location creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error during location creation' },
      { status: 500 }
    )
  }
}
