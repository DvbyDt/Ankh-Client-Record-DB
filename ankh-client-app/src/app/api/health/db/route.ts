import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL
    let connectionInfo: {
      host?: string
      port?: string
      database?: string
      usesPooler?: boolean
    } = {}

    if (databaseUrl) {
      try {
        const url = new URL(databaseUrl)
        connectionInfo = {
          host: url.hostname,
          port: url.port,
          database: url.pathname.replace('/', '') || undefined,
          usesPooler: url.searchParams.get('pgbouncer') === 'true'
        }
      } catch {
        connectionInfo = { host: 'invalid-url' }
      }
    }

    // Simple query to confirm DB connectivity
    const usersCount = await prisma.user.count()
    return NextResponse.json({ ok: true, usersCount, connectionInfo })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
