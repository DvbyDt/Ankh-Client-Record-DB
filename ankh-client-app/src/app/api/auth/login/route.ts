import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // Return user data (excluding password)
    const { password: _, ...userData } = user
    
    return NextResponse.json({
      message: 'Login successful',
      user: userData
    }, { status: 200 })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    )
  }
}
