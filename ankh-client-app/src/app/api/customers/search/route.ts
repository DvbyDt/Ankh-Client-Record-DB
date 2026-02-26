import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    console.log('Received search parameter:', name);

    if (!name) {
      return NextResponse.json(
        { error: 'Name parameter is required' },
        { status: 400 }
      );
    }

    // Search for customers by name (first name, last name, or email)
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
          { email: { contains: name, mode: 'insensitive' } }
        ],
        deletedAt: null
      },
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
      ]
    });

    console.log('Search results:', customers);
    
    // Log lesson counts for debugging
    customers.forEach((customer) => {
      console.log(`Customer ${customer.firstName} ${customer.lastName}: ${customer.lessonParticipants.length} lessons`);
    });

    if (customers.length === 0) {
      return NextResponse.json({
        message: 'No customers found',
        customers: []
      });
    }

    return NextResponse.json({
      message: 'Customers found',
      customers
    });

  } catch (error) {
    console.error('Customer search error:', error);
    return NextResponse.json(
      { error: 'Internal server error during customer search' },
      { status: 500 }
    );
  }
}
