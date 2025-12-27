import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '../../../generated/prisma'

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('request search URL:', request.url);
    const { searchParams } = new URL(request.url);
    const nameFilter = searchParams.get('search');
    console.log('Received name filter:', nameFilter);

    const locations = await prisma.location.findMany({
      where: nameFilter ? { name: { contains: nameFilter, mode: 'insensitive' } } : {},
      select: {
        id: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('Fetched locations:', locations);

    return NextResponse.json({ locations });

  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching locations' },
      { status: 500 }
    );
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
