import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [customerCount, lessonCount, instructorCount] = await Promise.all([
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.lesson.count(),
      prisma.user.count({ where: { role: 'INSTRUCTOR', isActive: true } }),
    ])
    return NextResponse.json({ customerCount, lessonCount, instructorCount }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ customerCount: 0, lessonCount: 0, instructorCount: 0 })
  }
}
