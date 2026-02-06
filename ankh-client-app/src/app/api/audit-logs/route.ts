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
    const decoded = jwt.verify(token, JWT_SECRET) as { role?: string }
    if (decoded.role !== 'MANAGER') {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { ok: true }
  } catch {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireManager(request)
    if ('error' in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 100), 200)

    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            role: true
          }
        }
      }
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error while fetching audit logs' },
      { status: 500 }
    )
  }
}
