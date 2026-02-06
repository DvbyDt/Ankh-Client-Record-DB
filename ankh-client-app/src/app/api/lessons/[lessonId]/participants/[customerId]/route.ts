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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string; customerId: string }> }
) {
  try {
    const auth = requireManager(request)
    if ('error' in auth) return auth.error

    const { lessonId, customerId } = await params

    if (!lessonId || !customerId) {
      return NextResponse.json(
        { error: 'Lesson ID and Customer ID are required' },
        { status: 400 }
      )
    }

    const lessonParticipant = await prisma.lessonParticipant.findUnique({
      where: {
        customerId_lessonId: {
          customerId,
          lessonId
        }
      },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!lessonParticipant || lessonParticipant.deletedAt) {
      return NextResponse.json(
        { error: 'Lesson participant not found' },
        { status: 404 }
      )
    }

    await prisma.$transaction([
      prisma.lessonParticipant.update({
        where: {
          customerId_lessonId: {
            customerId,
            lessonId
          }
        },
        data: { deletedAt: new Date() }
      }),
      prisma.auditLog.create({
        data: {
          action: 'SOFT_DELETE',
          entityType: 'LESSON_PARTICIPANT',
          entityId: lessonParticipant.id,
          actorId: auth.userId || null,
          actorRole: 'MANAGER',
          metadata: {
            lessonId,
            customerId,
            email: lessonParticipant.customer.email,
            name: `${lessonParticipant.customer.firstName} ${lessonParticipant.customer.lastName}`
          }
        }
      })
    ])

    return NextResponse.json(
      { message: 'Lesson participant deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Lesson participant deletion error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error during lesson participant deletion' },
      { status: 500 }
    )
  }
}
