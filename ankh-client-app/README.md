# Ankh Client Record Database

A production-grade, multi-language client management system for healthcare and wellness professionals. Built for studios that need to record sessions, track customer symptoms and improvements over time, manage a team of instructors across multiple locations, and bulk-import years of historical Excel data.

**Live:** https://ankh-client-record-db.vercel.app  
**Repo:** https://github.com/DvbyDt/Ankh-Client-Record-DB

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat-square&logo=postgresql)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Why Each Tool Was Chosen](#2-tech-stack--why-each-tool-was-chosen)
3. [Project Structure](#3-project-structure)
4. [Database Architecture](#4-database-architecture)
5. [API Reference](#5-api-reference)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Internationalization i18n](#8-internationalization-i18n)
9. [The Import Pipeline — A System Design Story](#9-the-import-pipeline--a-system-design-story)
10. [CSV Export](#10-csv-export)
11. [Performance Optimizations](#11-performance-optimizations)
12. [Environment Variables](#12-environment-variables)
13. [Local Development Setup](#13-local-development-setup)
14. [Database Migrations](#14-database-migrations)
15. [Deployment Vercel + Supabase](#15-deployment-vercel--supabase)
16. [Role-Based Access Control](#16-role-based-access-control)
17. [Error Handling Strategy](#17-error-handling-strategy)
18. [Scalability Analysis](#18-scalability-analysis)
19. [Adding New Features](#19-adding-new-features)
20. [Common Issues & Fixes](#20-common-issues--fixes)

---

## 1. Project Overview

### What it does

- **Lesson Recording** — Log individual or group sessions with instructor, location, lesson type, and content notes
- **Health Tracking** — Record customer symptoms and improvements at each session to track progress over time
- **Customer Management** — Search, view, edit, and soft-delete customer profiles with full lesson history
- **User Management** — Managers can create instructor accounts, assign roles, and search/edit users
- **Location Management** — Create and manage training venue records
- **Bulk Import** — Upload Excel or CSV files with thousands of rows via asynchronous background processing with live progress tracking
- **CSV Export** — Download all customer and lesson data as a structured spreadsheet
- **Bilingual UI** — Full English and Korean language support with locale-aware name formatting

### Who uses it

| Role | Permissions |
|------|-------------|
| **MANAGER** | Full access: create/delete customers, users, locations; import/export; view all data |
| **INSTRUCTOR** | Search customers, view lesson history, add new lesson records |

---

## 2. Tech Stack & Why Each Tool Was Chosen

### Next.js 15 (App Router)

Next.js was chosen as the foundation because it provides both the frontend React UI and the backend API routes in one unified project — no separate Express server, no CORS configuration, and a single deployment unit. The App Router (introduced in Next.js 13) allows server components, streaming, and file-based routing for API endpoints. Vercel (the company that created Next.js) provides zero-config deployment.

**What it gives us:**
- `src/app/api/**` folders become API endpoints automatically
- `src/app/[locale]/page.tsx` becomes the main page at `/en` and `/ko`
- Built-in TypeScript support, image optimization, and bundle splitting

### TypeScript

The entire codebase is TypeScript. With a data model involving customers, lessons, participants, users, and locations all referencing each other via foreign keys, type safety prevents entire classes of bugs at compile time — passing a `customerId` where a `lessonId` was expected, for example. Prisma's generated client is also fully typed, so database query results come back with known shapes.

### Prisma ORM

Prisma sits between the application code and PostgreSQL. Instead of writing raw SQL, all queries are written in TypeScript using Prisma's query builder. This provides:

- **Type-safe queries** — Prisma generates TypeScript types from the schema, so every `findMany`, `create`, and `update` call has fully typed inputs and outputs
- **Migration system** — Schema changes are tracked in migration files (`prisma/migrations/`) so the database evolves safely and predictably
- **Relation handling** — Deeply nested includes (customer → lessonParticipants → lesson → instructor) are expressed cleanly without manual JOIN construction
- **`createMany` for bulk ops** — The import pipeline uses `createMany` with `skipDuplicates: true` to bulk-insert thousands of rows in a single SQL statement

The Prisma client is generated into `src/generated/prisma/` and imported via a singleton in `src/lib/prisma.ts` to prevent multiple instances during hot-reload in development:

```typescript
// src/lib/prisma.ts — singleton pattern
import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

The singleton pattern is critical because in Next.js development, hot-module replacement would otherwise create a new `PrismaClient` on every file change, exhausting the database connection pool within minutes.

### PostgreSQL via Supabase

PostgreSQL is the industry-standard relational database for applications with complex relationships. Supabase provides hosted PostgreSQL with two important connection URLs:

- `DATABASE_URL` — A **pooled** connection via PgBouncer on port **6543**. Used for all application queries because Vercel's serverless functions spin up and down rapidly — without a pool they would exhaust PostgreSQL's connection limit (typically 100) within seconds under any real load.
- `DIRECT_URL` — A **direct** connection on port **5432**. Used only by Prisma's migration CLI because PgBouncer does not support the DDL commands that migrations require.

```
DATABASE_URL="postgresql://postgres.[ref]:[password]@pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@supabase.com:5432/postgres"
```

### QStash by Upstash

QStash is an HTTP-based serverless message queue. It is the backbone of the bulk import pipeline — it enables background processing across multiple Vercel function invocations, solving the 60-second serverless timeout constraint. Full explanation in [Section 9](#9-the-import-pipeline--a-system-design-story).

**Key properties:**
- HTTP-based — you call QStash, QStash calls you back. No persistent connection, no sync step
- Automatic retries — if a processing step fails, QStash retries it automatically
- Works on Vercel Hobby plan — unlike other solutions, QStash calls your endpoint directly so Vercel's deployment protection does not interfere
- Regional support — EU, US, and Asia regions available to minimise latency

### Tailwind CSS v4

Tailwind's utility-first approach allows the entire UI to be built without writing a single `.css` file. Every style is expressed as a class directly in JSX, keeping visual logic co-located with component logic. v4 uses a PostCSS-based build pipeline that only includes the CSS classes actually used in the project, resulting in a minimal final stylesheet.

### next-intl

Internationalisation requires more than just translating strings — it requires routing (`/en/`, `/ko/`), server-side message loading, and locale-aware formatting. `next-intl` integrates tightly with Next.js App Router and provides:

- Middleware-based locale detection from URL prefix
- `useTranslations()` hook for type-safe string access in client components
- `getMessages()` for server components to pass translations to `NextIntlClientProvider`
- No runtime locale switching delay — locale is part of the URL so it is server-resolved

### JWT + bcryptjs

Authentication uses stateless JSON Web Tokens rather than database-backed sessions. This works well on serverless infrastructure (Vercel) where there is no persistent in-memory session store. When a user logs in, the server signs a JWT with the user's `id`, `username`, and `role` using a secret key. The token is stored in a browser cookie and sent with every subsequent request. Each API route verifies the token independently with no database lookup required.

Passwords are hashed with `bcryptjs` at 10 salt rounds. bcryptjs is a pure-JavaScript bcrypt implementation with no native bindings — important for Vercel's serverless environment which does not reliably support native Node.js modules.

### XLSX (SheetJS)

The import pipeline must handle both `.xlsx` and `.csv` files because the client's historical data lives in Excel workbooks. SheetJS is the standard library for parsing Excel binary format in Node.js. It reads the file buffer, extracts the first sheet, and converts rows to JSON objects with header-keyed values.

### js-cookie

JWT tokens must persist across page navigations. `js-cookie` provides a simple API for setting, reading, and removing browser cookies without raw `document.cookie` string parsing. The token is stored with a 1-day expiry; the current user profile is cached separately for 7 days to avoid re-reading the JWT on every render.

### Lucide React

Lucide provides a consistent, tree-shakeable icon set. Because the project uses a custom pure-Tailwind UI (not a component library), having a reliable icon library avoids building SVGs by hand. Lucide's icons are React components that accept `className` for Tailwind styling.

---

## 3. Project Structure

```
ankh-client-app/
│
├── src/
│   ├── app/
│   │   ├── [locale]/                        # Locale-prefixed routes (/en, /ko)
│   │   │   ├── layout.tsx                   # Wraps all pages with NextIntlClientProvider
│   │   │   ├── page.tsx                     # Main dashboard (search, customers, toolbar)
│   │   │   ├── globals.css                  # Tailwind base + CSS variables
│   │   │   ├── add-record/
│   │   │   │   └── page.tsx                 # Multi-step form: select customer → fill lesson
│   │   │   └── manage-users/
│   │   │       └── page.tsx                 # Search users and edit inline (managers only)
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── login/route.ts           # POST — validate credentials, return JWT
│   │   │   │
│   │   │   ├── customers/
│   │   │   │   ├── route.ts                 # GET (paginated list)
│   │   │   │   ├── search/route.ts          # GET ?name= — full-text search with pagination
│   │   │   │   └── [customerId]/route.ts    # GET (detail + lessons), PUT (edit), DELETE (soft)
│   │   │   │
│   │   │   ├── lessons/
│   │   │   │   ├── new/route.ts             # POST — create lesson + participants in one call
│   │   │   │   ├── recent/route.ts          # GET — last N lesson participants (dashboard feed)
│   │   │   │   ├── search/route.ts          # GET ?name= — search lessons by customer name
│   │   │   │   └── [lessonId]/
│   │   │   │       └── participants/
│   │   │   │           └── [customerId]/
│   │   │   │               └── route.ts     # DELETE — remove one participant from a lesson
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── route.ts                 # GET (all users), POST (create)
│   │   │   │   ├── [userId]/route.ts        # PUT (edit, re-hashes password), DELETE
│   │   │   │   ├── instructors/route.ts     # GET — only INSTRUCTOR role (for dropdowns)
│   │   │   │   └── search/route.ts          # GET ?name= — search users by name
│   │   │   │
│   │   │   ├── locations/
│   │   │   │   └── route.ts                 # GET (all), POST (create)
│   │   │   │
│   │   │   ├── import/
│   │   │   │   ├── start/route.ts           # POST — parse file, run refs, queue bulk work
│   │   │   │   ├── process/route.ts         # POST — called by QStash, runs one chunk
│   │   │   │   └── status/[jobId]/route.ts  # GET — poll import progress
│   │   │   │
│   │   │   ├── export-csv/route.ts          # GET — build and stream CSV download
│   │   │   └── health/db/route.ts           # GET — database connectivity health check
│   │   │
│   │   ├── page.tsx                         # Root redirect → /en
│   │   └── layout.tsx                       # Root HTML shell (fonts, meta)
│   │
│   ├── components/
│   │   ├── LanguageSwitcher.tsx             # Dropdown: English / 한국어
│   │   ├── UploadModal.tsx                  # Import file picker + live progress bar
│   │   └── ui/                              # shadcn/ui Radix components (add-record only)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       └── textarea.tsx
│   │
│   ├── lib/
│   │   └── prisma.ts                        # Prisma singleton client
│   │
│   ├── generated/
│   │   └── prisma/                          # Auto-generated by prisma generate — do not edit
│   │
│   └── i18n.ts                              # next-intl server config: locale list, message loader
│
├── prisma/
│   ├── schema.prisma                        # Data model — source of truth for DB structure
│   ├── seed.ts                              # Seed script: creates first manager account
│   └── migrations/                          # Migration history — committed to git
│       └── [timestamp]_[name]/
│           └── migration.sql
│
├── messages/
│   ├── en.json                              # English UI strings
│   └── ko.json                              # Korean UI strings
│
├── middleware.ts                            # next-intl locale routing middleware
├── next.config.ts                           # Next.js config with next-intl plugin
├── eslint.config.mjs                        # ESLint rules
├── tsconfig.json                            # TypeScript compiler options
├── postcss.config.mjs                       # PostCSS with @tailwindcss/postcss
├── package.json
└── .env.local                               # Local secrets — never commit
```

---

## 4. Database Architecture

### Entity Relationship Diagram

```
┌──────────────────────┐          ┌──────────────────────┐
│       users          │          │      locations        │
├──────────────────────┤          ├──────────────────────┤
│ id         CUID  PK  │          │ id         CUID  PK  │
│ username   String UQ │          │ name       String UQ │
│ password   String    │          │ createdAt  DateTime  │
│ role       Enum      │          │ updatedAt  DateTime  │
│   MANAGER|INSTRUCTOR │          └──────────┬───────────┘
│ firstName  String    │                     │ 1
│ lastName   String    │                     │
│ email      String UQ │                     │ N
│ createdAt  DateTime  │          ┌──────────▼───────────┐
│ updatedAt  DateTime  │          │       lessons         │
└─────────┬────────────┘          ├──────────────────────┤
          │ 1                     │ id           CUID PK │
          │                       │ lessonType   String  │
          │ N                     │   Group|Individual   │
          └───────────────────────► instructorId FK→User │
                                  │ locationId   FK→Loc  │
                                  │ lessonContent String?│
                                  │ createdAt    DateTime│
                                  │ updatedAt    DateTime│
                                  └──────────┬───────────┘
                                             │ 1
                                             │ N
┌──────────────────────┐          ┌──────────▼───────────┐
│      customers       │          │  lesson_participants  │
├──────────────────────┤          ├──────────────────────┤
│ id         CUID  PK  │◄─────────┤ id           CUID PK │
│ firstName  String    │    N     │ customerId   FK→Cust │
│ lastName   String    │          │ lessonId     FK→Less │
│ email      String UQ │          │ customerSymptoms  ?  │
│ phone      String?   │          │ customerImprovements?│
│ createdAt  DateTime  │          │ status       String  │
│ updatedAt  DateTime  │          │   attended|absent    │
│ deletedAt  DateTime? │          │ createdAt    DateTime│
└──────────────────────┘          │ UNIQUE(customerId,   │
                                  │        lessonId)     │
                                  └──────────────────────┘

┌──────────────────────────────────────────────┐
│              import_jobs                      │
├──────────────────────────────────────────────┤
│ id         CUID  PK                          │
│ status     String   queued|processing|       │
│                     complete|failed          │
│ progress   Int      0–100                    │
│ message    String                            │
│ totalRows  Int                               │
│ rowErrors  Json     skipped row details      │
│ rowsJson   String?  pre-resolved bulk data   │
│                     (cleared after import)   │
│ createdAt  DateTime                          │
│ updatedAt  DateTime                          │
└──────────────────────────────────────────────┘
```

### Why This Schema Design

**CUID primary keys** (`@default(cuid())`) instead of auto-incrementing integers: CUIDs are collision-resistant, URL-safe, and do not expose the total record count. Incrementing IDs like `/customers/1`, `/customers/2` allow anyone to enumerate all records by simply incrementing the number.

**`LessonParticipant` as explicit join table** rather than a direct many-to-many: A lesson can have multiple customers, and a customer can attend many lessons. Crucially, attendance carries its own data — symptoms observed at that specific session, improvements noted, and attendance status. This data cannot live on either the `Customer` or `Lesson` table; it only exists in the context of one customer at one lesson. The join table captures this attendence-specific data cleanly.

**Soft delete on `Customer`** (`deletedAt DateTime?`): When a customer is deleted, we set `deletedAt` to the current timestamp rather than removing the row. This means:
- Historical lesson records remain intact (audit trail)
- The deletion can be undone by a manager
- Analytics on historical session counts remain accurate
- All queries simply filter on `WHERE "deletedAt" IS NULL` to exclude deleted customers from normal views

**`createdAt` doubles as lesson date**: The `Lesson.createdAt` field stores the actual date of the lesson, not just the database insertion timestamp. During import, the parsed lesson date from the spreadsheet is passed as the `createdAt` value. This simplifies the schema (one timestamp instead of two) at the cost of slightly unintuitive naming.

**`@@unique([customerId, lessonId])`** on `LessonParticipant`: This composite unique constraint prevents a customer being added to the same lesson twice. The import pipeline uses `createMany({ skipDuplicates: true })` against this constraint — re-importing the same file is safe, existing records are silently skipped rather than duplicated.

**`ImportJob` table**: Import state must survive across multiple independent serverless function invocations. The database is the only shared persistent state between the start route, the QStash processing calls, and the polling frontend. This is the **Saga Pattern** — a long-running operation split across multiple steps, each step updating shared state so any step can be retried independently.

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled via pgbouncer
  directUrl = env("DIRECT_URL")     // direct (migrations only)
}

enum UserRole { MANAGER  INSTRUCTOR }

model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String
  role      UserRole
  firstName String
  lastName  String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lessons   Lesson[]
  @@map("users")
}

model Location {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lessons   Lesson[]
  @@map("locations")
}

model Customer {
  id                 String              @id @default(cuid())
  email              String              @unique
  firstName          String
  lastName           String
  phone              String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  deletedAt          DateTime?           // soft delete
  lessonParticipants LessonParticipant[]
  @@map("customers")
}

model Lesson {
  id                 String              @id @default(cuid())
  lessonType         String              // "Group" | "Individual"
  lessonContent      String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  instructorId       String
  locationId         String
  instructor         User                @relation(fields: [instructorId], references: [id])
  location           Location            @relation(fields: [locationId], references: [id])
  lessonParticipants LessonParticipant[]
  @@map("lessons")
}

model LessonParticipant {
  id                   String   @id @default(cuid())
  customerId           String
  lessonId             String
  customerSymptoms     String?
  customerImprovements String?
  status               String   @default("attended")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  customer             Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  lesson               Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  @@unique([customerId, lessonId])
  @@map("lesson_participants")
}

model ImportJob {
  id        String   @id @default(cuid())
  status    String   @default("queued")
  progress  Int      @default(0)
  message   String   @default("")
  totalRows Int      @default(0)
  rowErrors Json     @default("[]")
  rowsJson  String?  // stores pre-resolved bulk data; cleared after processing
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("import_jobs")
}
```

### Database Indexes

Prisma auto-creates indexes for `@id`, `@unique`, and foreign key fields. Additional indexes added for search performance:

```sql
-- Run in Supabase SQL Editor after initial migration
CREATE INDEX IF NOT EXISTS "customers_firstName_idx"            ON "customers"("firstName");
CREATE INDEX IF NOT EXISTS "customers_lastName_idx"             ON "customers"("lastName");
CREATE INDEX IF NOT EXISTS "customers_deletedAt_idx"            ON "customers"("deletedAt");
CREATE INDEX IF NOT EXISTS "customers_createdAt_idx"            ON "customers"("createdAt");
CREATE INDEX IF NOT EXISTS "lesson_participants_customerId_idx" ON "lesson_participants"("customerId");
CREATE INDEX IF NOT EXISTS "lesson_participants_lessonId_idx"   ON "lesson_participants"("lessonId");
CREATE INDEX IF NOT EXISTS "lessons_createdAt_idx"              ON "lessons"("createdAt");
CREATE INDEX IF NOT EXISTS "lessons_instructorId_idx"           ON "lessons"("instructorId");
CREATE INDEX IF NOT EXISTS "lessons_locationId_idx"             ON "lessons"("locationId");
CREATE INDEX IF NOT EXISTS "users_firstName_idx"                ON "users"("firstName");
CREATE INDEX IF NOT EXISTS "users_lastName_idx"                 ON "users"("lastName");
```

The `deletedAt` index is particularly important — every customer query includes `WHERE "deletedAt" IS NULL`, and without an index PostgreSQL performs a full table scan on every request.

---

## 5. API Reference

All API routes live under `src/app/api/`. Next.js maps each `route.ts` file to its URL path. Each exported function (`GET`, `POST`, `PUT`, `DELETE`) handles the respective HTTP method.

### Authentication

#### `POST /api/auth/login`

Validates credentials and returns a signed JWT.

**Request body:**
```json
{ "username": "manager1", "password": "secret" }
```

**Response (200):**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": "clx...", "username": "manager1", "role": "MANAGER", "firstName": "Min", "lastName": "Jegal" }
}
```

**How it works:**
1. Fetch user by username from database
2. Compare submitted password against stored bcrypt hash with `bcrypt.compare()`
3. If match, sign a JWT containing `{ userId, username, role }` with `JWT_SECRET`, expiry 24 hours
4. Return token and user info

### Customers

#### `GET /api/customers`

Returns paginated non-deleted customers with their most recent lesson participants. Count and data queries run in parallel with `Promise.all()`.

**Query params:** `?page=1&limit=50` or `?countOnly=true`

**Response:**
```json
{
  "customers": [{ "id": "...", "firstName": "...", "lessonParticipants": [...] }],
  "total": 165,
  "totalPages": 4
}
```

#### `GET /api/customers/search`

Full-text search across `firstName`, `lastName`, and `email` (case-insensitive). Returns up to 5 lesson participants per customer as a preview.

**Query params:** `?name=kim&take=20&skip=0`

**How the query is built:**
```typescript
where: {
  AND: [
    { deletedAt: null },
    { OR: [
      { firstName: { contains: name, mode: 'insensitive' } },
      { lastName:  { contains: name, mode: 'insensitive' } },
      { email:     { contains: name, mode: 'insensitive' } }
    ]}
  ]
}
```

Prisma translates `mode: 'insensitive'` to `ILIKE` in PostgreSQL, which handles Korean characters correctly under Supabase's default `en_US.UTF-8` collation.

#### `GET /api/customers/[customerId]`

Returns a single customer with complete lesson history including instructor and location names. Requires MANAGER role.

#### `PUT /api/customers/[customerId]`

Updates customer fields. Requires MANAGER role.

#### `DELETE /api/customers/[customerId]`

**Soft delete** — sets `deletedAt` to now. Preserves all lesson history. Requires MANAGER role.

### Lessons

#### `POST /api/lessons/new`

Creates a lesson and registers one or more customers as participants.

**Request body:**
```json
{
  "instructorId": "clx...",
  "location": "clx...",
  "lessonType": "Group",
  "lessonContent": "Neck and shoulder work",
  "customers": [
    {
      "id": "clx...",
      "firstName": "Ji-young",
      "lastName": "Kim",
      "email": "jy@example.com",
      "phone": "010-1234-5678",
      "symptoms": "Lower back pain",
      "improvements": "More flexible than last week"
    }
  ]
}
```

**What happens inside:**
1. If a customer has no `id` (new customer), upsert them by email
2. Create the `Lesson` record
3. For each customer, create a `LessonParticipant` record linking them to the lesson with their symptoms and improvements

#### `GET /api/lessons/recent`

Returns the most recent `N` lesson participants ordered by lesson date, for the dashboard feed. Query param: `?limit=8`.

#### `DELETE /api/lessons/[lessonId]/participants/[customerId]`

Removes one customer from one lesson. Hard delete on the join table row. Requires MANAGER role.

### Users

#### `GET /api/users`

Returns all users. Requires auth.

#### `POST /api/users`

Creates a new user. Hashes the password with bcrypt at 10 rounds before storage.

#### `PUT /api/users/[userId]`

Updates user fields. If a `password` field is included, it is re-hashed before storage.

#### `DELETE /api/users/[userId]`

Hard delete. Requires MANAGER role. Prevents deletion of the last remaining MANAGER to avoid lockout.

#### `GET /api/users/instructors`

Returns only users with role `INSTRUCTOR`. Used to populate the instructor dropdown in the Add Record form. Response is edge-cached:

```typescript
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
})
```

`s-maxage=60` means Vercel's edge cache serves this for 60 seconds without hitting the database. `stale-while-revalidate=300` serves stale data while revalidating in the background — users never see a loading state for dropdowns.

#### `GET /api/users/search`

Search users by name for the Manage Users page.

### Locations

#### `GET /api/locations` — All locations. Edge-cached.
#### `POST /api/locations` — Create location. Requires auth.

### Import

#### `POST /api/import/start`

Accepts a `multipart/form-data` upload. Parses the file, runs reference data setup synchronously, stores pre-resolved bulk data in the DB, and queues the first processing chunk via QStash. Returns `{ jobId, totalRows }` immediately. Full pipeline in [Section 9](#9-the-import-pipeline--a-system-design-story).

#### `POST /api/import/process`

Called exclusively by QStash (not the browser). Verifies QStash signature. Processes one chunk of lessons or participants using `createMany`. Queues the next chunk if more remain. Updates `ImportJob.progress` after each chunk.

#### `GET /api/import/status/[jobId]`

Returns the current `ImportJob` record. Polled by the frontend every 2 seconds during import.

### Export

#### `GET /api/export-csv`

Fetches all non-deleted customers with complete lesson history and streams a CSV download. Sets `Content-Disposition: attachment; filename="customer_records.csv"`.

---

## 6. Authentication & Authorization

### Login Flow

```
Browser                          Server                         Database
  │                                │                                │
  │──POST /api/auth/login──────────►│                                │
  │  { username, password }        │──SELECT * FROM users WHERE───►│
  │                                │   username = 'manager1'        │
  │                                │◄──{ id, password_hash, role }──│
  │                                │                                │
  │                                │  bcrypt.compare(pw, hash)      │
  │                                │  → true                        │
  │                                │                                │
  │                                │  jwt.sign({ id, role }, SECRET)│
  │◄──{ token, user }──────────────│                                │
  │                                │                                │
  │  Cookies.set('jwt-token', token, { expires: 1 })                │
  │  Cookies.set('current-user-data', JSON.stringify(user))         │
```

### Token Verification on Protected Routes

Every protected API route calls a `requireManager` (or `requireAuth`) helper at the top:

```typescript
function requireManager(request: NextRequest) {
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

// Usage in any route:
const auth = requireManager(request)
if ('error' in auth) return auth.error
// ... proceed with MANAGER-only logic
```

### JWT Token Structure

```json
{
  "userId": "clx9f2...",
  "username": "manager1",
  "role": "MANAGER",
  "iat": 1748000000,
  "exp": 1748086400
}
```

The token expires after 24 hours. After expiry, all API requests return 401 and the frontend redirects to login.

### Role Matrix

| Action | MANAGER | INSTRUCTOR |
|--------|---------|------------|
| Search customers | ✅ | ✅ |
| View lesson history | ✅ | ✅ |
| Add new lesson record | ✅ | ✅ |
| Export CSV | ✅ | ✅ |
| Edit customer details | ✅ | ❌ |
| Delete customer | ✅ | ❌ |
| View all customers (bulk) | ✅ | ❌ |
| Create/delete users | ✅ | ❌ |
| View all users | ✅ | ❌ |
| Manage users page | ✅ | ❌ |
| Import Excel/CSV | ✅ | ❌ |
| Add locations | ✅ | ❌ |

---

## 7. Frontend Architecture

### Page Structure

| Route | File | Description |
|-------|------|-------------|
| `/en` or `/ko` | `[locale]/page.tsx` | Main dashboard |
| `/en/add-record` | `[locale]/add-record/page.tsx` | Add lesson multi-step form |
| `/en/manage-users` | `[locale]/manage-users/page.tsx` | User search and edit (managers only) |

### Main Dashboard Component Map

```
HomePage
│
├── Header (sticky)
│   ├── Logo + App Name + Customer count badge
│   ├── LanguageSwitcher (en / 한국어)
│   └── User avatar + name + role badge + Logout button
│
├── Toolbar (primary actions)
│   ├── Add New Record → navigate to /add-record
│   ├── Export CSV → direct link to /api/export-csv
│   ├── Import CSV → opens UploadModal with QStash progress
│   └── [MANAGER ONLY]
│       ├── All Customers toggle → AllCustomersPanel
│       ├── All Users toggle → AllUsersPanel
│       ├── Add User → opens AddUserModal
│       ├── Add Location → opens AddLocationModal
│       └── Manage Users → navigate to /manage-users
│
├── RecentLessons panel (auto-loaded, hides if empty)
│   └── Last 8 lesson participants, click to open CustomerDetailModal
│
├── AllUsersPanel (lazy-loaded on first open)
│   └── Role filter tabs: ALL / MANAGER / INSTRUCTOR
│
├── AllCustomersPanel (lazy-loaded, paginated 50/page)
│
├── SearchBox
│   ├── Debounced input (400ms) — triggers on 2+ characters
│   ├── Shimmer skeletons while loading
│   ├── Results (20 per page with pagination controls)
│   └── Each result: expandable lesson preview cards
│
└── Modals
    ├── LoginModal
    ├── CustomerDetailModal (full lesson history)
    ├── EditCustomerModal
    ├── UserInfoModal
    ├── AddUserModal
    ├── AddLocationModal
    ├── UploadModal (file picker + live QStash progress bar)
    └── ConfirmDialog (destructive action confirmation)
```

### State Management

The app uses React's built-in `useState` and `useEffect`. No external state management library (no Redux, Zustand) because:

1. State is naturally scoped — search results belong to the search section, user list belongs to the users panel
2. The app is a single-page dashboard; cross-route state synchronisation is not needed
3. Props and lifted state handle the cross-component communication that does exist

### Debounce Hook

The search input uses a custom `useDebounce` hook to avoid firing an API request on every keystroke:

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)  // clears on every new keystroke
  }, [value, delay])
  return debouncedValue
}

// Only fires a fetch when the user stops typing for 400ms
const debouncedSearch = useDebounce(searchTerm, 400)
useEffect(() => {
  if (debouncedSearch.length >= 2) {
    fetch(`/api/customers/search?name=${encodeURIComponent(debouncedSearch)}`)
  }
}, [debouncedSearch])
```

### Lazy Loading Panels

Panels only fetch on first open — a page load with 500 customers costs the same as one with 10:

```typescript
onClick={() => {
  const next = !showAllCustomers
  setShowAllCustomers(next)
  if (next && allCustomers.length === 0) fetchAllCustomers(1) // first open only
}}
```

### Avatar Component

User and customer avatars display initials derived from first and last name:

```typescript
function Avatar({ firstName, lastName, locale }) {
  const isKorean = /[\uAC00-\uD7AF]/.test(firstName + lastName)
  // Korean: Last[0] + First[0] → 김준
  // English: First[0] + Last[0] → MJ
  const initials = locale === 'ko'
    ? `${lastName?.[0] ?? ''}${firstName?.[0] ?? ''}`
    : `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`
  return (
    <div className={`rounded-full ${isKorean ? 'w-11 text-sm' : 'w-9 text-xs'}`}>
      {initials.toUpperCase()}
    </div>
  )
}
```

Korean syllable blocks (Unicode `AC00–D7AF`) are visually wider than Latin letters, so Korean avatars get slightly more width.

### Why No Radix UI on Main Pages

The main dashboard and manage-users page are built with pure HTML + Tailwind, deliberately avoiding shadcn/Radix UI components. Radix UI uses a portal pattern that inserts DOM nodes directly into `document.body`. Browser extensions — particularly Korean IME input methods, password managers, and translation tools — can modify these portal nodes in ways that React's virtual DOM reconciliation does not expect, causing:

```
NotFoundError: Failed to execute 'removeChild' on 'Node':
  The node to be removed is not a child of this node.
```

The `add-record` page still uses shadcn components (Select dropdowns for instructor/location/lesson type) because it is less exposed to Korean IME interference — a deliberate trade-off.

---

## 8. Internationalization i18n

### How Routing Works

```typescript
// middleware.ts
export default createMiddleware({
  locales: ['en', 'ko'],
  defaultLocale: 'en',
  localeDetection: true  // reads Accept-Language header on first visit
})

export const config = {
  matcher: ['/', '/(ko|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
}
```

A visit to `/` with a Korean browser redirects to `/ko`. Direct visits to `/en/add-record` are served in English. The `matcher` deliberately excludes `/api/**` — API routes are not locale-prefixed.

### How Messages Are Loaded

```typescript
// src/i18n.ts
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !['en', 'ko'].includes(locale)) locale = 'en'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  }
})
```

Messages are lazy-loaded per locale on the server and injected into the React tree via `NextIntlClientProvider` in `[locale]/layout.tsx`. Client components access them via `useTranslations()`.

### Translation File Structure

```json
// messages/en.json (excerpt)
{
  "Common": { "appName": "Ankh Client Records", "save": "Save", "cancel": "Cancel" },
  "Auth": { "login": "Login", "logout": "Logout", "username": "Username" },
  "HomePage": {
    "welcomeTitle": "Welcome to Ankh Client Record Database",
    "addNewRecord": "Add New Record",
    "exportCSV": "Export CSV"
  },
  "CustomerSearch": {
    "lessonDetails": "Lesson Details",
    "symptoms": "Symptoms",
    "improvements": "Customer Improvements"
  }
}
```

### Name Ordering

Korean names are written Last-First (`김준호` = Kim + Jun-ho):

```typescript
const formatName = (firstName: string, lastName: string): string => {
  if (locale === 'ko') return `${lastName} ${firstName}`  // 김 준호
  return `${firstName} ${lastName}`                        // Jun-ho Kim
}
```

This function is used everywhere a name is displayed: search results, lesson cards, user lists, avatar initials, and customer detail modals.

### Adding a New Language

1. Create `messages/[locale].json` with all the same keys as `en.json`
2. Add the locale to `src/i18n.ts`: `export const locales = ['en', 'ko', 'ja'] as const`
3. The middleware and routing handle the rest automatically

---

## 9. The Import Pipeline — A System Design Story

This is the most technically complex part of the project. What started as a simple file upload evolved through several failed attempts into a genuine distributed systems design. Each failure taught a specific lesson.

### The Problem

The business needed to import Excel files containing 3,000–5,000 rows of historical records, growing toward 50,000+ rows. Each row contains a customer, a lesson, an instructor, a location, and health tracking data — all relational.

**Constraints that shaped every decision:**
- Vercel Hobby plan: **60-second maximum function execution time**
- Serverless architecture: **no persistent background threads**
- Real users watching a progress bar: **must show live feedback**
- Cannot block the HTTP response: **must return immediately**

---

### Attempt 1 — Synchronous Processing (Naive)

```
Browser → POST /api/import → parse file → insert all rows → return response
```

**What happened:** The function timed out at 60 seconds for any file over ~200 rows. Users received a 504 gateway error. No data was imported.

**System Design Lesson:**
> Never do unbounded work in a synchronous HTTP handler. If execution time scales with input size, it does not belong in a request-response cycle.

---

### Attempt 2 — Inngest (Failed)

Inngest is a background job platform purpose-built for serverless. The natural next step.

**What happened:** Three hard blockers on Vercel Hobby:

1. **256KB event payload limit** — Sending 3,741 rows of data (3.3MB) in a single Inngest event was rejected with a 400 error. The payload was 13× over the limit.
2. **Deployment Protection conflict** — Inngest needs to reach your `/api/inngest` endpoint to sync function definitions. Vercel's deployment protection blocked all external HTTP requests to preview URLs on the Hobby plan, making the sync step impossible.
3. **405 Method Not Allowed** — The serve route exported incorrect HTTP methods, preventing Inngest from introspecting the endpoint even in development.

**System Design Lesson:**
> Understand your platform constraints before choosing a tool. Always validate the full integration on your actual deployment tier. A tool that works locally may have fundamental incompatibilities with your production environment.

---

### Attempt 3 — QStash (The Right Tool)

[QStash by Upstash](https://upstash.com/docs/qstash) is an HTTP-based message queue. The key architectural difference from Inngest:

- **Inngest:** Inngest calls your endpoint to sync functions, then calls it again when events fire ← requires Inngest to reach your URL
- **QStash:** You publish a message to QStash → QStash calls your URL ← you initiate the relationship

This distinction resolves the deployment protection issue entirely. QStash calls your production domain directly. Vercel's protection does not interfere because the traffic flows inbound to your public URL, not outbound through protected preview infrastructure.

```
Browser → POST /api/import/start → returns { jobId } immediately (< 10 seconds)
                    │
                    ▼
            QStash receives published message
                    │
                    ▼
            QStash → POST /api/import/process { jobId, phase: 'lessons', chunkIndex: 0 }
            Function processes chunk → queues next chunk → returns 200
                    │
                    ▼
            QStash → POST /api/import/process { jobId, phase: 'lessons', chunkIndex: 1 }
                    │
                    ▼
            ... until all chunks complete ...
                    │
                    ▼
            ImportJob.status = 'complete'
```

Meanwhile the browser polls `GET /api/import/status/[jobId]` every 2 seconds and renders a progress bar.

**System Design Lesson:**
> Message queues decouple producers from consumers. The browser (producer) returns immediately. Processing (consumer) runs independently. If a step fails, QStash retries automatically. The system is resilient to partial failures.

---

### Attempt 4 — Per-Row Upserts (Too Slow)

With QStash working, the next problem was speed. Initial processing used `upsert()` in a loop:

```typescript
// WRONG — 3,741 separate database round trips
for (const row of rows) {
  await prisma.lesson.upsert({ where: { id: row.lessonId }, ... })
}
```

**What happened:** Processing 3,741 rows took **35 minutes**. Each upsert is a separate database round trip (~50ms). 3,741 × 50ms = 187 seconds per phase. With three phases that is ~10 minutes just in database time, plus retry overhead.

Additionally the full 3.3MB of row data was stored in `ImportJob.rowsJson` and read back on every QStash call — 9 calls × 3.3MB = 30MB of redundant database reads.

**System Design Lesson:**
> N+1 queries are fatal at scale. Per-row processing grows linearly and becomes impossible at large sizes. A function that takes 35 minutes for 3,741 rows will take 470 minutes for 50,000 rows — it will never finish within any reasonable timeout.

---

### Final Architecture — Bulk Inserts + Phase Separation

Two changes produced the correct solution:

**Change 1: Replace per-row upserts with `createMany`**

```typescript
// CORRECT — 1 database query for 1,000 rows
await prisma.lesson.createMany({
  data: chunk,           // array of 1,000 rows
  skipDuplicates: true,  // idempotent — re-importing the same file is safe
})
```

`createMany` generates a single `INSERT INTO lessons VALUES (...), (...), (...)` SQL statement. The database inserts 1,000 rows in one round trip instead of 1,000 round trips. This is a **70–100× speedup** for bulk data operations.

**Change 2: Separate reference data (small) from bulk data (large)**

Analysis of the actual import file revealed the real data shape:

| Entity | Unique count | Strategy |
|--------|-------------|----------|
| Locations | 8 | Synchronous `createMany` in start route |
| Instructors | 43 | Synchronous `createMany` in start route |
| Customers | 165 | Synchronous `createMany` in start route |
| Lessons | 3,741 | Background QStash chunked `createMany` |
| Participants | 3,741 | Background QStash chunked `createMany` |

Locations, instructors, and customers are tiny sets. Inserting them in the synchronous start route takes under 2 seconds. Only lessons and participants (the bulk of the work) need the background queue.

```
POST /api/import/start (synchronous, < 10 seconds):
  1. Parse Excel file in memory
  2. createMany locations (8)          → 1 query, instant
  3. createMany instructors (43)       → 1 query, instant
  4. createMany customers (165)        → 1 query, instant
  5. Resolve all DB IDs in 2 queries
  6. Pre-build lesson rows with resolved instructorId + locationId
  7. Pre-build participant rows with resolved customerId + lessonId
  8. Store ONLY pre-resolved data in DB (~1.1MB not 3.3MB)
  9. Publish first chunk to QStash
 10. Return { jobId } to browser

POST /api/import/process (background, QStash, per chunk):
  Phase "lessons":      createMany 1,000 lessons at a time (4 calls for 3,741 rows)
  Phase "participants": createMany 1,000 participants at a time (4 calls for 3,741 rows)
```

**The key insight:** Pre-resolving IDs in the start route means each QStash processing call has everything it needs — it never needs to look up instructor IDs or location IDs mid-processing.

**Performance comparison:**

| Metric | Before | After |
|--------|--------|-------|
| DB queries per 3,741 rows | ~11,223 | ~12 |
| Import time | 35 minutes | ~2 minutes |
| QStash calls needed | 40+ | 9 |
| Data stored in ImportJob | 3.3MB | 1.1MB |
| 50,000 row estimate | Never finishes | ~15 minutes |

---

### The Full QStash Pipeline in Code

```typescript
// POST /api/import/start — the start route

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // 1. Parse Excel → rows[]
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

  // 2. Insert reference data synchronously
  const uniqueLocations = [...new Set(rows.map(r => r.locationName).filter(Boolean))]
  await prisma.location.createMany({ data: uniqueLocations.map(name => ({ name })), skipDuplicates: true })

  // ... same for instructors and customers ...

  // 3. Resolve IDs
  const locationMap = Object.fromEntries(
    (await prisma.location.findMany()).map(l => [l.name, l.id])
  )

  // 4. Pre-resolve bulk data
  const lessonRows = rows.map(r => ({
    id: r.lessonId,
    lessonType: r.lessonType || 'Group',
    instructorId: instructorMap[r.instructorEmail],
    locationId: locationMap[r.locationName],
    createdAt: safeDate(r.lessonDate),
  }))

  // 5. Store and queue
  const job = await prisma.importJob.create({
    data: { status: 'queued', totalRows: rows.length, rowsJson: JSON.stringify({ lessons: lessonRows, participants: participantRows }) }
  })

  const client = new Client({ token: process.env.QSTASH_TOKEN!, baseUrl: process.env.QSTASH_URL })
  await client.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/import/process`,
    body: { jobId: job.id, phase: 'lessons', chunkIndex: 0 }
  })

  return NextResponse.json({ jobId: job.id, totalRows: rows.length })
}
```

```typescript
// POST /api/import/process — the QStash worker

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

export const POST = verifySignatureAppRouter(async (request: NextRequest) => {
  const { jobId, phase, chunkIndex } = await request.json()
  const CHUNK_SIZE = 1000

  const job = await prisma.importJob.findUnique({ where: { id: jobId } })
  const { lessons, participants } = JSON.parse(job!.rowsJson!)

  const rows = phase === 'lessons' ? lessons : participants
  const chunk = rows.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE)

  // Bulk insert this chunk
  if (phase === 'lessons') {
    await prisma.lesson.createMany({ data: chunk, skipDuplicates: true })
  } else {
    await prisma.lessonParticipant.createMany({ data: chunk, skipDuplicates: true })
  }

  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE)
  const isLastChunk = chunkIndex + 1 >= totalChunks

  if (isLastChunk && phase === 'lessons') {
    // Transition to participants phase
    const client = new Client({ token: process.env.QSTASH_TOKEN!, baseUrl: process.env.QSTASH_URL })
    await client.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/import/process`,
      body: { jobId, phase: 'participants', chunkIndex: 0 }
    })
    await prisma.importJob.update({ where: { id: jobId }, data: { progress: 50 } })
  } else if (isLastChunk && phase === 'participants') {
    // All done
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'complete', progress: 100, rowsJson: null }  // clear blob
    })
  } else {
    // Queue next chunk of same phase
    const client = new Client({ token: process.env.QSTASH_TOKEN!, baseUrl: process.env.QSTASH_URL })
    await client.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/import/process`,
      body: { jobId, phase, chunkIndex: chunkIndex + 1 }
    })
    const progress = Math.round(((chunkIndex + 1) / totalChunks) * (phase === 'lessons' ? 50 : 50) + (phase === 'participants' ? 50 : 0))
    await prisma.importJob.update({ where: { id: jobId }, data: { progress } })
  }

  return NextResponse.json({ ok: true })
})
```

### Key System Design Concepts Applied

**Asynchronous Processing**
The HTTP response is decoupled from the actual work. The browser gets `{ jobId }` in under 10 seconds regardless of file size.

**Message Queues**
QStash provides durable delivery with automatic retries. If a processing step fails, QStash retries it. The queue persists even if the Vercel function crashes mid-execution.

**Chunking**
3,741 rows ÷ 1,000 per chunk = 4 database calls. Each chunk completes in ~5 seconds — well within the 60-second Vercel limit. This pattern scales to any size.

**Bulk Operations**
`createMany` with `skipDuplicates` is idempotent. Re-running the same import safely produces the same result. This is the difference between O(n) queries and O(1) queries per chunk.

**Phase Separation**
Separating "setup" (reference data) from "bulk work" (lessons, participants) gives each phase predictable, bounded execution time.

**Polling for Progress (Producer-Consumer)**
The frontend polls `GET /api/import/status/[jobId]` every 2 seconds. Processing functions write progress to the database. The producer (processing function) and consumer (browser) are fully decoupled, communicating only through shared state.

**Idempotency**
Every `createMany` uses `skipDuplicates: true`. Re-importing the same file twice produces the same result as importing it once. Critical for reliability — if a chunk fails and QStash retries it, no duplicate records are created.

**Saga Pattern**
A long-running operation split across multiple independent steps. Each step updates shared state (`ImportJob`) so any step can be retried without re-running the entire operation from the start.

**Pre-resolution of IDs**
Foreign key IDs (instructorId, locationId, customerId) are resolved once in the start route and stored alongside the bulk data. This eliminates redundant DB lookups across all 9 processing calls.

---

## 10. CSV Export

The export route builds a CSV string in memory and returns it with download headers:

```typescript
// GET /api/export-csv
const customers = await prisma.customer.findMany({
  where: { deletedAt: null },
  include: {
    lessonParticipants: {
      include: { lesson: { include: { instructor: true, location: true } } },
      orderBy: { lesson: { createdAt: 'desc' } }
    }
  }
})

// One row per lesson participant — customers repeat across multiple rows
const rows = customers.flatMap(customer =>
  customer.lessonParticipants.map(lp => [
    customer.id,
    `${customer.firstName} ${customer.lastName}`,
    customer.email,
    customer.phone ?? '',
    lp.lesson.createdAt.toISOString().split('T')[0],
    lp.lesson.lessonType,
    `${lp.lesson.instructor.firstName} ${lp.lesson.instructor.lastName}`,
    lp.lesson.location.name,
    lp.customerSymptoms ?? '',
    lp.customerImprovements ?? '',
    lp.status
  ].join(','))
)

return new Response([csvHeaders, ...rows].join('\n'), {
  headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="customer_records.csv"'
  }
})
```

The exported CSV can be re-imported — column headers match the import pipeline's expected field names.

---

## 11. Performance Optimizations

### Parallel Database Queries

Where two independent queries are needed, they run in parallel:

```typescript
const [customers, total] = await Promise.all([
  prisma.customer.findMany({ skip, take, where, include }),
  prisma.customer.count({ where })
])
```

Without `Promise.all`, these run sequentially, doubling the database round-trip time.

### Pagination

All Customers fetches 50 per page. Search results paginate at 20 per page. Fetching all records at once would slow API responses, transfer large JSON payloads, and cause React to render hundreds of DOM nodes simultaneously.

### Lazy Panel Loading

Panels only fetch on first open. Subsequent opens use cached React state.

### Customer Detail On-Demand

Search results load only 5 lesson participants per customer as a preview. Full lesson history is fetched only when the user opens the detail modal. Search speed is constant regardless of how many lessons a customer has accumulated.

### Edge Caching for Reference Data

Static reference data (instructors, locations) changes rarely and is cached at the edge:

```typescript
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
})
```

`s-maxage=60` means Vercel's CDN serves this for 60 seconds without hitting the database. `stale-while-revalidate=300` serves stale data while revalidating in the background — users never see a loading state for dropdowns.

### Bulk `createMany` for Imports

All import operations use `createMany` rather than per-row upserts. See [Section 9](#9-the-import-pipeline--a-system-design-story) for the full explanation — this was a 70–100× speedup.

### Database Indexes

See [Section 4](#database-indexes) for the full index list. The most impactful:
- `customers(deletedAt)` — every customer query filters by this
- `customers(firstName)`, `customers(lastName)` — every search query uses these
- `lesson_participants(customerId)` — every customer detail load joins on this

---

## 12. Environment Variables

Create `.env.local` in the project root (never commit this file):

```bash
# PostgreSQL — pooled via PgBouncer (used by the app at runtime)
DATABASE_URL="postgresql://postgres.[ref]:[password]@pooler.supabase.com:6543/postgres?pgbouncer=true"

# PostgreSQL — direct connection (Prisma migrations only)
DIRECT_URL="postgresql://postgres.[ref]:[password]@supabase.com:5432/postgres"

# JWT signing secret — generate with: openssl rand -hex 64
JWT_SECRET="your-64-char-hex-secret"

# QStash (from Upstash dashboard → QStash → Quickstart)
# Use the EU regional endpoint if your Supabase is in Europe
QSTASH_URL="https://qstash-eu-central-1.upstash.io"
QSTASH_TOKEN="eyJVc2VySUQi..."
QSTASH_CURRENT_SIGNING_KEY="sig_..."
QSTASH_NEXT_SIGNING_KEY="sig_..."

# Your production domain (no trailing slash, no port for production)
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

**Where to find Supabase URLs:**
Go to your project → Settings → Database → Connection string. Port 6543 = pooled (`DATABASE_URL`), port 5432 = direct (`DIRECT_URL`).

**On Vercel:** Add all variables in Project Settings → Environment Variables for Production, Preview, and Development environments.

---

## 13. Local Development Setup

**Prerequisites:** Node.js 18+, a Supabase project (or any PostgreSQL database)

```bash
# 1. Clone
git clone https://github.com/DvbyDt/Ankh-Client-Record-DB.git
cd Ankh-Client-Record-DB/ankh-client-app

# 2. Install
npm install

# 3. Environment
cp .env.production.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, JWT_SECRET
# QSTASH vars only needed if testing import locally

# 4. Generate Prisma client (required before first run)
npx prisma generate

# 5. Run migrations (creates all tables)
npx prisma migrate dev

# 6. Create first manager account
npm run seed -- yourusername yourpassword

# 7. Start dev server
npm run dev
```

The app runs at `http://localhost:3000` and redirects to `http://localhost:3000/en`.

### Useful Commands

```bash
npm run dev                                     # Start with Turbopack (fast HMR)
npm run build                                   # Production build (same as Vercel runs)
npm run lint                                    # ESLint check
npx prisma studio                               # Visual DB browser at localhost:5555
npx prisma migrate dev --name "describe_change" # Create migration after schema edit
npx prisma generate                             # Regenerate TypeScript client
```

---

## 14. Database Migrations

Prisma tracks every schema change as a migration file in `prisma/migrations/`. These files are committed to git and represent the complete evolution history of the database.

### Creating a Migration

```bash
# After editing prisma/schema.prisma:
npx prisma migrate dev --name "add_field_to_customer"
```

This command:
1. Compares the current schema to the last migration
2. Generates a new `migration.sql` file with the ALTER TABLE statements
3. Applies the migration to your development database
4. Regenerates the Prisma client TypeScript types

### Applying Migrations in Production

Vercel does not run migrations automatically. Run them manually when deploying schema changes:

```bash
# Use DIRECT_URL (port 5432) — PgBouncer does not support DDL
export DATABASE_URL="postgresql://postgres.[ref]:[pw]@supabase.com:5432/postgres"
npx prisma migrate deploy
```

Or paste the migration SQL directly into Supabase's SQL Editor.

**Important:** Always use the direct connection (port 5432) for migrations. PgBouncer (port 6543) does not support the transaction modes that `CREATE INDEX`, `ALTER TABLE`, and other DDL statements require.

---

## 15. Deployment Vercel + Supabase

### Architecture

```
User's Browser
      │
      ▼
Vercel Edge Network (CDN)
  Serves static assets (JS, CSS, fonts)
  Caches API responses with Cache-Control headers
      │
      ▼
Vercel Serverless Functions
  One function per API route
  Scales to zero when idle
  ~50ms cold start
  60-second max execution time
      │
      ▼
Supabase PgBouncer (port 6543)
  Connection pool
  Queues requests when pool is full
  Prevents connection exhaustion under load
      │
      ▼
Supabase PostgreSQL (AWS ap-northeast-2, Seoul)
  Automatic daily backups
  Point-in-time recovery
```

### Deploy Steps

```bash
# Subsequent deploys — Vercel auto-deploys on push to main
git add .
git commit -m "your change"
git push origin main

# After schema changes:
DIRECT_URL="your_direct_url" npx prisma migrate deploy
```

### Why `postinstall` Runs `prisma generate`

```json
"scripts": {
  "build": "next build --turbopack",
  "postinstall": "prisma generate"
}
```

Vercel runs `npm install` then `npm run build`. The `postinstall` hook ensures the TypeScript client is always regenerated from the schema during every Vercel build, so deployed code and generated types are always in sync.

---

## 16. Role-Based Access Control

RBAC is enforced at two independent layers:

**Layer 1 — API routes (the actual security boundary):**
```typescript
const auth = requireManager(request)
if ('error' in auth) return auth.error  // 401 or 403 before any logic runs
```

**Layer 2 — UI (convenience only, not security):**
```tsx
{currentUser?.role === 'MANAGER' && (
  <button onClick={() => deleteCustomer(id)}>Delete</button>
)}
```

The UI check hides irrelevant controls but is not a security boundary. A user who bypasses the UI and calls the API directly will still receive a 403 if their JWT does not contain the MANAGER role.

---

## 17. Error Handling Strategy

### API Routes

Every route is wrapped in `try/catch`. On error, log the full details server-side (visible in Vercel function logs) and return a generic message to the client — never expose stack traces or internal details:

```typescript
try {
  // ... database operations
} catch (error) {
  console.error('Error in /api/customers:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

### Frontend

- Network errors set an error state and render an `AlertCircle` message
- Form submission errors display inline below the relevant field
- Success actions show an auto-dismissing toast notification (4 seconds)
- Destructive actions require confirmation via a modal dialog

### Import Errors

The import pipeline returns partial success — processes all valid rows and reports failures for individual rows:

```json
{
  "status": "complete",
  "message": "Successfully imported 3,738 records (3 rows skipped)",
  "rowErrors": [
    "Row 12: Missing required fields (customerId, lessonDate)",
    "Row 45: Invalid lesson date format",
    "Row 892: Missing instructor name"
  ]
}
```

HTTP status `207 Multi-Status` is used for partial success so the frontend can distinguish a complete failure (5xx) from a partial one (207).

---

## 18. Scalability Analysis

The import pipeline scales linearly — O(n / chunk_size) — rather than exponentially. Doubling the data roughly doubles the time, which is the correct complexity for a bulk import pipeline:

| Records | Import Time | QStash Calls | DB Queries |
|---------|-------------|--------------|------------|
| 3,741 | ~2 minutes | 9 | ~12 |
| 10,000 | ~4 minutes | 22 | ~22 |
| 50,000 | ~15 minutes | 102 | ~102 |
| 100,000 | ~28 minutes | 202 | ~202 |

The only bottleneck at very large scale (100K+ rows) would be the `rowsJson` field in the `ImportJob` table. At that point, the pre-resolved data should move to a dedicated staging table with proper indexing rather than being stored as a JSON string in a single row.

---

## 19. Adding New Features

### Add a New Field to Customer

1. Edit `prisma/schema.prisma` — add the field to the `Customer` model
2. Run `npx prisma migrate dev --name "add_field_to_customer"`
3. Update the relevant API routes (`GET`, `PUT`) to read/write the new field
4. Update frontend form and display components

### Add a New API Route

Create `src/app/api/your-resource/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const data = await prisma.yourModel.findMany()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/your-resource error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Add a New Language

1. Create `messages/[locale].json` with all keys from `en.json`
2. Add to `src/i18n.ts`: `export const locales = ['en', 'ko', 'ja'] as const`
3. Middleware and routing handle the rest automatically

### Add a New Page

```typescript
// src/app/[locale]/your-page/page.tsx
'use client'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function YourPage() {
  const pathname = usePathname()
  const locale = pathname.split('/')[1] || 'en'
  const t = useTranslations()
  return <div>{t('YourSection.title')}</div>
}
```

---

## 20. Common Issues & Fixes

### `PrismaClientInitializationError` on Vercel

`DATABASE_URL` is not set or is incorrect in Vercel's project settings. Verify the variable exists for the Production environment and uses port **6543** (pooled, not direct).

### Migrations fail with "prepared statement already exists"

You are using the pooled connection URL for migrations. Always use `DIRECT_URL` (port 5432) for `prisma migrate deploy`. PgBouncer does not support the transaction modes that DDL commands require.

### `NotFoundError: removeChild` crash

Caused by browser extensions (Korean IME, password managers, translation tools) mutating DOM nodes inside Radix UI portals. Affected pages are rewritten to use pure HTML + Tailwind without Radix components. If this reappears on another page, remove all shadcn components from that page and rebuild with plain HTML elements.

### JWT token not persisting after login

`JWT_SECRET` is not set in the environment. If undefined, `jwt.sign()` throws and the login route returns 500. The frontend silently fails to store the token — the user appears logged out immediately after login.

### Import stuck at a specific percentage, cycling back

A QStash processing chunk is timing out and being retried. Check Vercel function logs for the specific error. Common causes:
- Invalid date format — verify the `Lesson Date` column contains parseable dates
- Missing instructor or location — verify `Instructor Name` and `Lesson Location` columns are non-empty
- Database timeout under load — reduce `CHUNK_SIZE` from 1,000 to 500 in `import/process/route.ts`

### QStash returning 401 errors

You are using the wrong regional endpoint. If your Supabase is in the EU, `QSTASH_URL` must be `https://qstash-eu-central-1.upstash.io`. Using the default US endpoint with an EU-region token causes authentication failures. Also ensure you are using the `@upstash/qstash` SDK with `baseUrl: process.env.QSTASH_URL` explicitly set — raw `fetch` to QStash bypasses the SDK's regional routing.

### Build fails with ESLint errors

Verify `eslint.config.mjs` has `no-explicit-any` set to `"warn"` not `"error"`:

```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unused-vars": "warn",
  "no-unused-vars": "warn",
  "react/no-unescaped-entities": "warn",
}
```

### Search returns no results for Korean names

Prisma's `contains` with `mode: 'insensitive'` uses `ILIKE` in PostgreSQL. Supabase's default `en_US.UTF-8` collation handles Korean characters in `ILIKE` queries correctly. If results are missing despite the customer existing, verify the `customers_firstName_idx` and `customers_lastName_idx` indexes have been created — PostgreSQL will sometimes fall back to a sequential scan on an unindexed column that returns incorrect results under certain collation edge cases.

---

*Built for production. Evolved through real constraints. Every architectural decision has a reason.*