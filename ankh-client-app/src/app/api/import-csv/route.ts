import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import bcrypt from 'bcryptjs'

const DEFAULT_PASSWORD = 'Pw@123'

const REQUIRED_HEADERS = [
  'customer id',
  'customer name',
  'initial symptom',
  'lesson id',
  'lesson date',
  'instructor name',
  'lesson type',
  'customer symptoms',
  'lesson content',
  'course completion status'
]

const HEADER_ALIASES: Record<string, string> = {
  'customer_id': 'customer id',
  'customer_name': 'customer name',
  'client_name': 'customer name',
  'customer improvements': 'course completion status',
  'customer feedback': 'course completion status',
  'feedback': 'course completion status',
  'symptoms': 'customer symptoms',
  'lesson_id': 'lesson id',
  'lesson_date': 'lesson date',
  'date': 'lesson date',
  'instructor': 'instructor name',
  'lesson_type': 'lesson type',
  'type': 'lesson type',
  'location': 'location name',
  'lesson_content': 'lesson content',
  'content': 'lesson content',
  'course_completion_status': 'course completion status'
}

const normalizeHeader = (header: string) =>
  header.replace(/\u00a0/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ')

const canonicalHeader = (header: string) =>
  HEADER_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header)

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const buildInstructorEmail = (name: string) =>
  `${name.replace(/\s+/g, '')}@abc.com`

const buildInstructorUsername = (name: string) =>
  `${name.replace(/\s+/g, '')}_${Math.random().toString(36).slice(2, 8)}`

const parseLessonDate = (value: string): Date | null => {
  const num = Number(value)
  if (!Number.isNaN(num)) {
    return new Date((num - 25569) * 86400 * 1000)
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = new Uint8Array(await file.arrayBuffer())

    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[]

    if (!rawData.length) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }

    const headers = Object.keys(rawData[0]).map(canonicalHeader)
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))

    if (missing.length) {
      return NextResponse.json({ error: 'Missing headers', missing }, { status: 400 })
    }

    const customers = new Map()
    const instructors = new Map()
    const lessons = new Map()
    const locations = new Set()

    const validRows: any[] = []
    const errors: string[] = []

    rawData.forEach((raw, i) => {
      const row: any = {}
      Object.entries(raw).forEach(([k, v]) => {
        row[canonicalHeader(k)] = (v ?? '').toString().trim()
      })

      const date = parseLessonDate(row['lesson date'])

      if (!row['customer id'] || !row['lesson id'] || !date) {
        errors.push(`Row ${i + 2} invalid`)
        return
      }

      validRows.push({ ...row, parsedDate: date })

      customers.set(row['customer id'], row['customer name'])

      const email = buildInstructorEmail(row['instructor name'])
      instructors.set(email, row['instructor name'])

      const loc = row['location name'] || 'Default Location'
      locations.add(loc)

      if (!lessons.has(row['lesson id'])) {
        lessons.set(row['lesson id'], {
          id: row['lesson id'],
          instructorEmail: email,
          locationName: loc,
          lessonType: row['lesson type'],
          lessonContent: row['lesson content'],
          lessonDate: date
        })
      }
    })

    const BATCH = 500

    // Locations
    for (const chunk of chunkArray([...locations], BATCH)) {
      await prisma.location.createMany({
        data: chunk.map(name => ({ name: typeof name === 'string' ? name : String(name) })),
        skipDuplicates: true
      })
    }

    const dbLocations = await prisma.location.findMany()
    const locMap = new Map(dbLocations.map(l => [l.name, l.id]))

    // Instructors
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: [...instructors.keys()] } }
    })

    const existingEmails = new Set(existingUsers.map(u => u.email))
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10)

    for (const chunk of chunkArray([...instructors.entries()], BATCH)) {
      await prisma.user.createMany({
        data: chunk
          .filter(([email]) => !existingEmails.has(email))
          .map(([email, name]) => ({
            email,
            username: buildInstructorUsername(name),
            password: hashed,
            role: 'INSTRUCTOR',
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' ')
          })),
        skipDuplicates: true
      })
    }

    const allUsers = await prisma.user.findMany()
    const userMap = new Map(allUsers.map(u => [u.email, u.id]))

    // Customers
    for (const chunk of chunkArray([...customers.entries()], BATCH)) {
      await prisma.customer.createMany({
        data: chunk.map(([id, name]) => ({
          id,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' '),
          email: `${id}@abc.com`
        })),
        skipDuplicates: true
      })
    }

    // Lessons (FAST now 🚀)
    for (const chunk of chunkArray([...lessons.values()], BATCH)) {
      await prisma.lesson.createMany({
        data: chunk
          .map(l => ({
            id: l.id,
            lessonType: l.lessonType || 'Group',
            instructorId: typeof userMap.get(l.instructorEmail) === 'string' ? userMap.get(l.instructorEmail)! : '',
            locationId: typeof locMap.get(l.locationName) === 'string' ? locMap.get(l.locationName)! : '',
            lessonContent: l.lessonContent,
            createdAt: l.lessonDate,
          }))
          .filter(l => l.instructorId && l.locationId),
        skipDuplicates: true
      })
    }

    // Participants
    for (const chunk of chunkArray(validRows, BATCH)) {
      await prisma.lessonParticipant.createMany({
        data: chunk.map(r => ({
          customerId: r['customer id'],
          lessonId: r['lesson id'],
          customerSymptoms: r['customer symptoms'],
          customerImprovements: r['course completion status'],
          status: 'attended'
        })),
        skipDuplicates: true
      })
    }

    return NextResponse.json({
      message: 'Import successful',
      processed: validRows.length,
      errors: errors.slice(0, 10)
    })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}