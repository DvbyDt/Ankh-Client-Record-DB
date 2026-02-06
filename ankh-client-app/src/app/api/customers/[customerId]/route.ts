import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_for_dev_only'

const requireManager = (request: NextRequest) => {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role?: string; userId?: string }
    if (decoded.role !== 'MANAGER') {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { ok: true, userId: decoded.userId, role: decoded.role }
  } catch {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = requireManager(request)
    if ('error' in auth) return auth.error

    const { customerId } = await params

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
        lessonParticipants: {
          where: { deletedAt: null },
          select: {
            customerSymptoms: true,
            customerImprovements: true,
            lesson: {
              select: {
                id: true,
                lessonType: true,
                createdAt: true,
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
              createdAt: 'desc'
            }
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = requireManager(request);
    if ('error' in auth) return auth.error;

    const { customerId } = await params;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: { deletedAt: new Date() }
      }),
      prisma.lessonParticipant.updateMany({
        where: { customerId },
        data: { deletedAt: new Date() }
      }),
      prisma.auditLog.create({
        data: {
          action: 'SOFT_DELETE',
          entityType: 'CUSTOMER',
          entityId: customerId,
          actorId: auth.userId || null,
          actorRole: 'MANAGER',
          metadata: {
            email: customer.email,
            name: `${customer.firstName} ${customer.lastName}`
          }
        }
      })
    ])

    return NextResponse.json(
      { message: 'Customer deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
