import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const countOnly = searchParams.get('countOnly') === 'true'

    if (countOnly) {
      const count = await prisma.customer.count({
        where: { deletedAt: null }
      })
      return NextResponse.json({ count })
    }

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ],
            deletedAt: null
          }
        : { deletedAt: null },
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
            lesson: {
              select: {
                createdAt: true
              }
            }
          },
          orderBy: {
            lesson: {
              createdAt: 'desc'
            }
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Internal server error while fetching customers' },
      { status: 500 }
    )
  }
}
