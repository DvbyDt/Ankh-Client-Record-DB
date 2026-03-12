import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const take = parseInt(searchParams.get('take') || '20', 10); // default 20
    const skip = parseInt(searchParams.get('skip') || '0', 10); // default 0

    if (!name) {
      return NextResponse.json(
        { error: 'Name parameter is required' },
        { status: 400 }
      );
    }

    // Build where clause once, using correct Prisma QueryMode type
    const where = {
      OR: [
        { firstName: { contains: name, mode: 'insensitive' as const } },
        { lastName: { contains: name, mode: 'insensitive' as const } },
        { email: { contains: name, mode: 'insensitive' as const } }
      ],
      deletedAt: null
    };

    // Get total count for pagination
    const total = await prisma.customer.count({ where });

    // Search for customers by name (first name, last name, or email) with pagination
    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
        deletedAt: true,
        lessonParticipants: {
          select: {
            id: true,
            lesson: {
              select: {
                id: true,
                lessonType: true,
                lessonContent: true,
                createdAt: true,
                instructor: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            customerSymptoms: true,
            customerImprovements: true,
            status: true
          },
          orderBy: {
            lesson: {
              createdAt: 'desc'
            }
          }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ],
      take,
      skip
    });

    return NextResponse.json({
      message: customers.length === 0 ? 'No customers found' : 'Customers found',
      customers,
      total
    });
  } catch (error) {
    console.error('Customer search error:', error);
    return NextResponse.json(
      { error: 'Internal server error during customer search' },
      { status: 500 }
    );
  }
}
