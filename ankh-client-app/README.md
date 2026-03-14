# Ankh Client Record Database

A full-stack web application for managing client lesson records, health progress tracking, and instructor administration. Built for studios or wellness practices that need to record sessions, track customer symptoms and improvements over time, and manage a team of instructors.

**Live:** https://ankh-client-record-db.vercel.app

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Why Each Tool Was Chosen](#2-tech-stack--why-each-tool-was-chosen)
3. [Project Structure](#3-project-structure)
4. [Database Architecture](#4-database-architecture)
5. [API Reference](#5-api-reference)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Internationalization (i18n)](#8-internationalization-i18n)
9. [CSV Import Pipeline](#9-csv-import-pipeline)
10. [CSV Export](#10-csv-export)
11. [Performance Optimizations](#11-performance-optimizations)
12. [Environment Variables](#12-environment-variables)
13. [Local Development Setup](#13-local-development-setup)
14. [Database Migrations](#14-database-migrations)
15. [Deployment (Vercel + Supabase)](#15-deployment-vercel--supabase)
16. [Role-Based Access Control](#16-role-based-access-control)
17. [Error Handling Strategy](#17-error-handling-strategy)
18. [Adding New Features](#18-adding-new-features)
19. [Common Issues & Fixes](#19-common-issues--fixes)

---

## 1. Project Overview

### What it does

- **Lesson Recording** — Log individual or group sessions with instructor, location, lesson type, and content notes
- **Health Tracking** — Record customer symptoms and improvements at each session to track progress over time
- **Customer Management** — Search, view, edit, and soft-delete customer profiles with full lesson history
- **User Management** — Managers can create instructor accounts, assign roles, and search/edit users
- **Location Management** — Create and manage training venue/room records
- **CSV Import** — Bulk import historical records from Excel or CSV files with intelligent deduplication
- **CSV Export** — Download all customer and lesson data as a structured CSV spreadsheet
- **Bilingual UI** — Full English and Korean language support with locale-aware name formatting

### Who uses it

Two roles exist in the system:

| Role | Permissions |
|------|-------------|
| **MANAGER** | Full access: create/delete customers, users, locations; import/export; view all data |
| **INSTRUCTOR** | Search customers, view lesson history, add new lesson records |

---

## 2. Tech Stack & Why Each Tool Was Chosen

### Next.js 15 (App Router)

**Why:** Next.js was chosen as the foundation because it provides both the frontend React UI and the backend API routes in one unified project. This means no separate Express server, no CORS configuration, and a single deployment unit. The App Router (introduced in Next.js 13) allows server components, streaming, and file-based routing for API endpoints. Vercel (the company that created Next.js) provides zero-config deployment.

**What it gives us:**
- `src/app/api/**` folders become API endpoints automatically
- `src/app/[locale]/page.tsx` becomes the main page at `/en` and `/ko`
- Built-in TypeScript support, image optimization, and bundle splitting

### TypeScript

**Why:** The entire codebase is TypeScript. With a data model involving customers, lessons, participants, users, and locations all referencing each other via foreign keys, type safety prevents entire classes of bugs at compile time (passing a `customerId` where a `lessonId` was expected, for example). Prisma's generated client is also fully typed, so database query results come back with known shapes.

### Prisma ORM

**Why:** Prisma sits between the application code and PostgreSQL. Instead of writing raw SQL, all queries are written in TypeScript using Prisma's query builder. This provides:

- **Type-safe queries** — Prisma generates TypeScript types from the schema, so every `findMany`, `create`, and `update` call has fully typed inputs and outputs
- **Migration system** — Schema changes are tracked in migration files (`prisma/migrations/`) so the database can be evolved safely
- **Relation handling** — Deeply nested includes (customer → lessonParticipants → lesson → instructor) are expressed cleanly in code without manual JOIN construction
- **Upsert support** — The import pipeline uses `prisma.customer.upsert()` extensively to insert-or-update records atomically

The Prisma client is generated into `src/generated/prisma/` and imported via a singleton in `src/lib/prisma.ts` to prevent multiple instances during hot-reload in development.

```typescript
// src/lib/prisma.ts — singleton pattern
import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

The singleton pattern is critical because in Next.js development, hot-module replacement would otherwise create a new `PrismaClient` on every file change, exhausting the database connection pool.

### PostgreSQL via Supabase

**Why:** PostgreSQL is the industry-standard relational database for applications with complex relationships. Supabase provides hosted PostgreSQL with two important connection URLs:

- `DATABASE_URL` — A **pooled** connection via PgBouncer on port **6543**. This is used for all application queries because Vercel's serverless functions spin up and down rapidly, and without a pool they would exhaust PostgreSQL's connection limit (typically 100) within seconds under any real load.
- `DIRECT_URL` — A **direct** connection on port **5432**. This is used only by Prisma's migration CLI because PgBouncer does not support the DDL (schema-altering) commands that migrations require.

```
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.supabase.com:5432/postgres"
```

### Tailwind CSS v4

**Why:** Tailwind's utility-first approach allows the entire UI to be built without writing a single `.css` file. Every style is expressed as a class directly in JSX, which keeps visual logic co-located with component logic. v4 uses a PostCSS-based build pipeline that only includes the CSS classes actually used in the project, resulting in a tiny final stylesheet.

### next-intl

**Why:** Internationalization requires more than just translating strings — it requires routing (`/en/`, `/ko/`), server-side message loading, and locale-aware formatting. `next-intl` integrates tightly with Next.js App Router and provides:

- Middleware-based locale detection from URL prefix
- `useTranslations()` hook for type-safe string access in client components
- `getMessages()` for server components to pass translations to `NextIntlClientProvider`
- No runtime locale switching delay — locale is part of the URL, so it's server-resolved

### JWT + bcryptjs

**Why:** Authentication uses stateless JSON Web Tokens rather than database-backed sessions. This works well on serverless infrastructure (Vercel) where there is no persistent in-memory session store. When a user logs in, the server signs a JWT with the user's `id`, `username`, and `role` using a secret key. The token is stored in a browser cookie and sent with every subsequent request in the `Authorization: Bearer` header. Each API route verifies the token independently with no database lookup required.

Passwords are hashed with `bcryptjs` at 10 salt rounds before storage. bcryptjs is a pure-JavaScript implementation of bcrypt (no native bindings), which is important for Vercel's serverless environment which does not support native Node.js modules well.

### Lucide React

**Why:** Lucide provides a consistent, tree-shakeable icon set. Because the project uses a custom pure-Tailwind UI (no component library), having a reliable icon library avoids building SVGs by hand. Lucide's icons are React components that accept `className` for Tailwind styling.

### XLSX (SheetJS)

**Why:** The import pipeline must handle both `.xlsx` and `.csv` files from Excel because the client's historical data is stored in Excel workbooks. SheetJS is the standard library for parsing Excel binary format in Node.js. It reads the file buffer, extracts the first sheet, and converts rows to JSON objects with header-keyed values.

### js-cookie

**Why:** JWT tokens must persist across page navigations. `js-cookie` provides a simple API for setting, reading, and removing cookies from the browser without `document.cookie` string parsing. The token is stored with a 1-day expiry; the current user profile is cached separately for 7 days to avoid re-reading the JWT on every render.

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
│   │   │   │   ├── route.ts                 # GET (paginated list), POST (create)
│   │   │   │   ├── search/route.ts          # GET ?name= — full-text search
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
│   │   │   │   ├── [userId]/route.ts        # PUT (edit), DELETE
│   │   │   │   ├── instructors/route.ts     # GET — only INSTRUCTOR role (for dropdowns)
│   │   │   │   └── search/route.ts          # GET ?name= — search users by name
│   │   │   │
│   │   │   ├── locations/
│   │   │   │   └── route.ts                 # GET (all), POST (create)
│   │   │   │
│   │   │   ├── export-csv/route.ts          # GET — build and stream CSV download
│   │   │   ├── import-csv/route.ts          # POST multipart/form-data — parse and upsert
│   │   │   └── health/db/route.ts           # GET — database connectivity health check
│   │   │
│   │   ├── page.tsx                         # Root redirect → /en
│   │   └── layout.tsx                       # Root HTML shell (fonts, meta)
│   │
│   ├── components/
│   │   ├── LanguageSwitcher.tsx             # Dropdown: English / 한국어
│   │   └── ui/                             # shadcn/ui Radix components (used in add-record)
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
│   │   └── prisma/                          # Auto-generated by `prisma generate` — do not edit
│   │
│   └── i18n.ts                              # next-intl server config: locale list, message loader
│
├── prisma/
│   ├── schema.prisma                        # Data model — source of truth for DB structure
│   ├── seed.ts                              # Optional: seed script for dev data
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
├── tailwind.config.js                       # Tailwind (v4 uses CSS config, minimal here)
├── postcss.config.js                        # PostCSS with @tailwindcss/postcss
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
          └───────────────────────► instructorId  FK→User│
                                  │ locationId   FK→Loc  │
                                  │ lessonContent String?│
                                  │ createdAt    DateTime│
                                  │ updatedAt    DateTime│
                                  └──────────┬───────────┘
                                             │ 1
                                             │
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
└──────────────────────┘          │   UNIQUE(customerId, │
                                  │          lessonId)   │
                                  └──────────────────────┘
```

### Why This Schema Design

**CUID primary keys** (`@default(cuid())`) instead of auto-incrementing integers: CUIDs are collision-resistant, URL-safe, and don't expose the total count of records in the database. Incrementing integer IDs like `/customers/1`, `/customers/2` allow anyone to enumerate all records.

**`LessonParticipant` join table** rather than a direct many-to-many: A lesson can have multiple customers, and a customer can attend many lessons. But crucially, attendance carries its own data — symptoms observed *at that specific session*, improvements noted, and attendance status. This data cannot live on either the `Customer` or `Lesson` table; it only exists in the context of one customer at one lesson. The join table captures this.

**Soft delete on `Customer`** (`deletedAt DateTime?`): When a customer is deleted, we set `deletedAt` to the current timestamp rather than removing the row. This means:
- Historical lesson records remain intact (audit trail)
- The deletion can be undone
- Analytics on past lesson counts remain accurate
- All queries filter on `WHERE "deletedAt" IS NULL` to exclude deleted customers from normal views

**`createdAt` doubles as lesson date**: The `Lesson.createdAt` field stores the actual date of the lesson, not just the database insertion time. During CSV import, the parsed lesson date from the spreadsheet is passed as the `createdAt` value. This simplifies the schema (one timestamp instead of two) at the cost of slightly unintuitive naming.

**`@@unique([customerId, lessonId])`** on `LessonParticipant`: This composite unique constraint prevents a customer being added to the same lesson twice. The import pipeline uses `upsert` with this constraint — if a record already exists (reimporting the same CSV), it updates rather than creating a duplicate.

**`@@map("customers")`** etc.: Prisma model names are PascalCase (`Customer`) but the actual PostgreSQL table names are snake_case plural (`customers`). The `@@map` directive controls this translation.

### Prisma Schema Source

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (pgbouncer)
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
  deletedAt          DateTime?
  lessonParticipants LessonParticipant[]
  @@map("customers")
}

model Lesson {
  id                 String              @id @default(cuid())
  lessonType         String
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
```

### Database Indexes

Prisma auto-creates indexes for `@id`, `@unique`, and foreign key fields. For search performance, additional indexes were added:

```sql
-- Run in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS "customers_firstName_idx"         ON "customers"("firstName");
CREATE INDEX IF NOT EXISTS "customers_lastName_idx"          ON "customers"("lastName");
CREATE INDEX IF NOT EXISTS "customers_deletedAt_idx"         ON "customers"("deletedAt");
CREATE INDEX IF NOT EXISTS "customers_createdAt_idx"         ON "customers"("createdAt");
CREATE INDEX IF NOT EXISTS "lesson_participants_customerId_idx" ON "lesson_participants"("customerId");
CREATE INDEX IF NOT EXISTS "lesson_participants_lessonId_idx"   ON "lesson_participants"("lessonId");
CREATE INDEX IF NOT EXISTS "lessons_createdAt_idx"           ON "lessons"("createdAt");
CREATE INDEX IF NOT EXISTS "lessons_instructorId_idx"        ON "lessons"("instructorId");
CREATE INDEX IF NOT EXISTS "lessons_locationId_idx"          ON "lessons"("locationId");
CREATE INDEX IF NOT EXISTS "users_firstName_idx"             ON "users"("firstName");
CREATE INDEX IF NOT EXISTS "users_lastName_idx"              ON "users"("lastName");
```

The `deletedAt` index is particularly important: every customer query includes `WHERE "deletedAt" IS NULL`, and without an index PostgreSQL does a full table scan for this filter on every request.

---

## 5. API Reference

All API routes live under `src/app/api/`. Next.js maps each `route.ts` file to its corresponding URL path. Each exported function (`GET`, `POST`, `PUT`, `DELETE`) handles the respective HTTP method.

### Authentication

#### `POST /api/auth/login`

Validates username and password. Returns a signed JWT on success.

**Request body:**
```json
{ "username": "manager1", "password": "secret" }
```

**Response (200):**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "clx...",
    "username": "manager1",
    "role": "MANAGER",
    "firstName": "Min",
    "lastName": "Jegal"
  }
}
```

**How it works:**
1. Fetch user by username from database
2. Compare submitted password against stored bcrypt hash using `bcrypt.compare()`
3. If match, sign a JWT containing `{ id, username, role }` with `process.env.JWT_SECRET`, expiry 24 hours
4. Return token + user info

### Customers

#### `GET /api/customers`

Returns a paginated list of all non-deleted customers with their most recent lesson.

**Query params:** `?page=1&limit=50`

**Response:**
```json
{
  "customers": [ { "id": "...", "firstName": "...", "lessonParticipants": [...] } ],
  "total": 142,
  "totalPages": 3
}
```

Count and data queries run in parallel with `Promise.all()` to halve the round-trip time.

#### `GET /api/customers/search`

Full-text search across `firstName`, `lastName`, and `email` fields (case-insensitive).

**Query params:** `?name=kim&take=20&skip=0`

**How it works:**
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

Returns up to 5 lesson participants per customer for the search results preview. Full history is loaded separately via the detail endpoint.

#### `GET /api/customers/[customerId]`

Returns a single customer with their complete lesson history, including instructor and location names.

#### `PUT /api/customers/[customerId]`

Updates customer fields. Requires MANAGER role. Only updates provided fields (partial update pattern).

#### `DELETE /api/customers/[customerId]`

**Soft delete** — sets `deletedAt` to now. Requires MANAGER role. The customer's lesson history is preserved in the database; the customer is simply excluded from all future queries.

### Lessons

#### `POST /api/lessons/new`

Creates a lesson and registers one or more customers as participants in a single database transaction.

**Request body:**
```json
{
  "instructorId": "clx...",
  "location": "clx...",
  "lessonType": "Group",
  "lessonContent": "Neck and shoulder work",
  "customers": [
    {
      "id": "clx...",         // omit for new customer
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
1. If a customer has no `id` (new customer), create them first
2. Create the `Lesson` record
3. For each customer, create a `LessonParticipant` record linking them to the lesson
4. Return the created lesson with all participants

#### `GET /api/lessons/recent`

Returns the most recent `N` lesson participants ordered by lesson date, for the dashboard feed. Query param: `?limit=8`.

#### `DELETE /api/lessons/[lessonId]/participants/[customerId]`

Removes one customer from one lesson. Hard delete on the join table row.

### Users

#### `GET /api/users`

Returns all users. Requires authentication.

#### `POST /api/users`

Creates a new user. Requires MANAGER role. Hashes the password with bcrypt before storage.

#### `PUT /api/users/[userId]`

Updates user fields. If a `password` field is included, it is re-hashed before storage.

#### `DELETE /api/users/[userId]`

Hard delete. Requires MANAGER role.

#### `GET /api/users/instructors`

Returns only users with role `INSTRUCTOR`. Used to populate the instructor dropdown in the Add Record form. Response is cached with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

#### `GET /api/users/search`

Search users by name for the Manage Users page.

### Locations

#### `GET /api/locations`

Returns all locations. Cached for 60 seconds.

#### `POST /api/locations`

Creates a new location. Requires authentication.

### Import / Export

#### `POST /api/import-csv`

Accepts a `multipart/form-data` upload with a `file` field (CSV, XLSX, or XLS). Parses, validates, deduplicates, and batch-upserts all records. See [Section 9](#9-csv-import-pipeline) for full detail.

#### `GET /api/export-csv`

Fetches all non-deleted customers with their complete lesson history and streams a CSV download. Sets `Content-Disposition: attachment; filename="customer_records.csv"`.

---

## 6. Authentication & Authorization

### Login Flow

```
Browser                          Server                        Database
  │                                │                               │
  │──POST /api/auth/login──────────►│                               │
  │  { username, password }        │──SELECT * FROM users WHERE──►│
  │                                │   username = 'manager1'       │
  │                                │◄──{ id, password_hash, role }─│
  │                                │                               │
  │                                │  bcrypt.compare(pw, hash)     │
  │                                │  → true                       │
  │                                │                               │
  │                                │  jwt.sign({ id, role }, SECRET)
  │◄──{ token, user }──────────────│                               │
  │                                │                               │
  │  Cookies.set('jwt-token', token)                               │
  │  Cookies.set('current-user-data', JSON.stringify(user))        │
```

### Token Verification on Protected Routes

Every protected API route calls a `require_auth` helper at the top:

```typescript
function requireAuth(request: Request): { id: string; role: string } | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.split(' ')[1]
    return jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string }
  } catch {
    return null  // expired or tampered token
  }
}

// In a route:
const user = requireAuth(request)
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (user.role !== 'MANAGER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### JWT Token Contents

```json
{
  "id": "clx9f2...",
  "username": "manager1",
  "role": "MANAGER",
  "iat": 1748000000,
  "exp": 1748086400
}
```

The token expires after 24 hours (`expiresIn: '24h'`). After expiry, all API requests return 401 and the user is redirected to login.

### What Managers Can Do That Instructors Cannot

| Action | MANAGER | INSTRUCTOR |
|--------|---------|------------|
| Search customers | ✅ | ✅ |
| View lesson history | ✅ | ✅ |
| Add new lesson record | ✅ | ✅ |
| Edit customer details | ✅ | ❌ |
| Delete customer | ✅ | ❌ |
| View all customers (bulk) | ✅ | ❌ |
| Create/delete users | ✅ | ❌ |
| View all users | ✅ | ❌ |
| Manage users page | ✅ | ❌ |
| Import CSV | ✅ | ❌ |
| Export CSV | ✅ | ✅ |
| Add locations | ✅ | ❌ |

---

## 7. Frontend Architecture

### Page Structure

The app has three pages:

| Route | File | Description |
|-------|------|-------------|
| `/en` or `/ko` | `[locale]/page.tsx` | Main dashboard |
| `/en/add-record` | `[locale]/add-record/page.tsx` | Add lesson form |
| `/en/manage-users` | `[locale]/manage-users/page.tsx` | User search & edit |

### Main Dashboard (`page.tsx`) — Component Map

```
HomePage
│
├── Header (sticky, frosted glass)
│   ├── Logo + App Name
│   ├── Customer count badge
│   ├── LanguageSwitcher
│   └── User avatar + name + role badge + Logout
│
├── Toolbar (primary actions row + manager row)
│   ├── Add New Record → navigate to /add-record
│   ├── Export CSV → direct link to /api/export-csv
│   ├── Import CSV → opens UploadModal
│   └── [MANAGER ONLY]
│       ├── All Customers toggle → AllCustomersPanel
│       ├── All Users toggle → AllUsersPanel
│       ├── Add User → opens AddUserModal
│       ├── Add Location → opens AddLocationModal
│       └── Manage Users → navigate to /manage-users
│
├── RecentLessons panel (auto-loaded, hides if empty)
│   └── Last 8 lesson participants, click to open DetailModal
│
├── AllUsersPanel (toggle, lazy-loaded on first open)
│   └── Role filter (ALL / MANAGER / INSTRUCTOR)
│
├── AllCustomersPanel (toggle, lazy-loaded, paginated 50/page)
│
├── SearchBox
│   ├── Debounced input (400ms) — triggers on 2+ characters
│   ├── Shimmer skeletons while loading
│   ├── Results list
│   │   └── Each row: Avatar | Name + email | Action buttons
│   │       └── Expanded: Lesson preview cards
│   └── Pagination (20 results per page)
│
└── Modals (all use portal pattern via fixed positioning)
    ├── LoginModal
    ├── CustomerDetailModal (wide, full lesson history)
    ├── EditCustomerModal
    ├── UserInfoModal
    ├── AddUserModal
    ├── AddLocationModal
    └── UploadModal
```

### State Management

The app uses React's built-in `useState` and `useEffect` hooks. There is no external state management library (no Redux, Zustand, etc.) because:

1. State is naturally scoped — search results belong to the search section, user list belongs to the users panel
2. The app is a single-page dashboard, not a multi-page SPA where global state synchronization across routes would be needed
3. Props and lifting state up handles the cross-component communication that does exist (e.g., `fetchDetail` is passed down to `RecentLessons`)

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

// Usage: only fires fetch when user stops typing for 400ms
const debouncedSearch = useDebounce(searchTerm, 400)
useEffect(() => {
  if (debouncedSearch.length >= 2) fetch('/api/customers/search?name=...')
}, [debouncedSearch])
```

### Lazy Loading Panels

The All Customers and All Users panels are not fetched on page load. They only fetch when the user clicks the toggle button for the first time:

```typescript
onClick={() => {
  const next = !showAllCustomers
  setShowAllCustomers(next)
  if (next && allCustomers.length === 0) fetchAllCustomers(1) // first open only
}}
```

This means a page load with 500 customers costs the same as a page load with 10 — the bulk data never loads unless requested.

### Avatar Component

User and customer avatars display initials derived from first and last name. Korean names are handled correctly:

```typescript
function Avatar({ firstName, lastName, locale }) {
  const isKorean = /[\uAC00-\uD7AF]/.test(firstName + lastName)
  // Korean: Last[0] + First[0] (e.g. 김준)
  // English: First[0] + Last[0] (e.g. MJ)
  const initials = locale === 'ko'
    ? `${lastName?.[0] ?? ''}${firstName?.[0] ?? ''}`
    : `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`
  return (
    <div className={`rounded-full ... ${isKorean ? 'w-11 text-sm' : 'w-9 text-xs'}`}>
      {initials.toUpperCase()}
    </div>
  )
}
```

Korean syllable blocks (`가`–`힣`, Unicode range `AC00–D7AF`) are wider than Latin letters, so the avatar is given slightly more width when Korean characters are detected.

### Why No Radix UI / shadcn on Main Pages

The main dashboard (`page.tsx`) and manage-users page are built with **pure HTML + Tailwind only**, deliberately avoiding the shadcn/Radix UI components. This is because Radix UI components (Dialog, Select, etc.) use a portal pattern that inserts DOM nodes directly into `document.body`. Browser extensions — particularly Korean IME input methods, password managers, and translation extensions — can modify these portal nodes in ways that React's virtual DOM reconciliation does not expect, causing:

```
NotFoundError: Failed to execute 'removeChild' on 'Node':
  The node to be removed is not a child of this node.
```

The `add-record` page still uses shadcn components (Select dropdowns for instructor/location/lesson type) because it is less commonly affected — this is a trade-off between the convenience of the Select component and the crash risk.

---

## 8. Internationalization (i18n)

### How Routing Works

The `middleware.ts` file intercepts every request and ensures it has a locale prefix:

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware'
import { locales } from './src/i18n'

export default createMiddleware({
  locales: ['en', 'ko'],
  defaultLocale: 'en',
  localeDetection: true  // reads Accept-Language header on first visit
})

export const config = {
  matcher: ['/', '/(ko|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
}
```

A visit to `/` with a Korean browser redirects to `/ko`. A direct visit to `/en/add-record` is served in English.

The `matcher` pattern deliberately excludes `/api/**` — API routes are not locale-prefixed.

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
    "exportCSV": "Export CSV",
    "searchPlaceholder": "Search by name, email..."
  },
  "CustomerSearch": {
    "title": "Customer Search Results",
    "lessonDetails": "Lesson Details",
    "symptoms": "Symptoms",
    "improvements": "Customer Improvements"
  },
  "AddRecord": { "title": "Add New Lesson Record", "instructorLabel": "Instructor" }
}
```

### Name Ordering

Korean names are written Last-First (`김준호` = `Kim + Jun-ho`). The `formatName` function respects this:

```typescript
const formatName = (firstName: string, lastName: string): string => {
  if (locale === 'ko') return `${lastName} ${firstName}`  // 김 준호
  return `${firstName} ${lastName}`                        // Jun-ho Kim
}
```

This function is used everywhere a name is displayed: search results, lesson cards, user lists, and avatar initials.

### Adding a New Translation Key

1. Add the key to `messages/en.json` under the appropriate section
2. Add the Korean equivalent to `messages/ko.json`
3. Use it in a component: `const t = useTranslations(); t('Section.key')`

---

## 9. CSV Import Pipeline

The import pipeline is the most complex part of the codebase. It handles bulk data ingestion from Excel spreadsheets that may have been created with inconsistent formatting.

### Full Pipeline (Step by Step)

```
User selects file
       │
       ▼
POST /api/import-csv (multipart/form-data)
       │
       ▼
1. Read file buffer
   file.arrayBuffer() → Buffer
       │
       ▼
2. Parse with SheetJS
   XLSX.read(buffer, { type: 'buffer' })
   workbook.SheetNames[0] → first sheet
   XLSX.utils.sheet_to_json(sheet) → rows[]
       │
       ▼
3. Normalize headers (case-insensitive, trim whitespace)
   "Customer Name" → "customer name"
   "LESSON DATE"   → "lesson date"
       │
       ▼
4. Validate each row
   Required: customerId, customerName, lessonId, lessonDate, instructorName
   Skip row + log error if missing
       │
       ▼
5. Parse lesson date (two formats)
   Excel serial number: (45335 - 25569) * 86400000 → Date object
   ISO string: new Date("2026-01-15") → Date object
       │
       ▼
6. Deduplication (in-memory, before any DB writes)
   customers Map<customerId, { id, name }>
   instructors Map<email, { email, name }>
   locations Set<name>
   lessons Map<lessonId, { id, instructor, location, date, type, content }>
       │
       ▼
7. Batch upsert (50 records per transaction)
   │
   ├─ Upsert locations (create if name not exists)
   ├─ Upsert instructors (create if email not exists, hash default password)
   ├─ Upsert customers (by customerId)
   ├─ Upsert lessons (by lessonId, set createdAt = parsed lesson date)
   └─ Upsert lesson_participants (by customerId+lessonId composite key)
       │
       ▼
8. Return result
   { processedCount: 150, errorCount: 2, errors: ["Row 45: ..."] }
```

### Expected CSV Column Headers

The import is case-insensitive for headers. These are the expected names:

| Column | Required | Notes |
|--------|----------|-------|
| `Customer ID` | Yes | Used as the customer's database ID |
| `Customer Name` | Yes | Split on first space into firstName / lastName |
| `Lesson ID` | Yes | Used as the lesson's database ID |
| `Lesson Date` | Yes | Excel serial number or ISO date string |
| `Instructor Name` | Yes | Creates instructor account if not found |
| `Lesson Type` | No | Defaults to `"Group"` |
| `Location Name` | No | Defaults to `"Default Location"` |
| `Lesson Content` | No | Free text notes |
| `Customer Symptoms` | No | Health symptoms at this session |
| `Course Completion Status` | No | Stored as `customerImprovements` |

### Date Parsing

Excel stores dates as "serial numbers" (days since January 1, 1900). The import handles both:

```typescript
function parseLessonDate(value: unknown): Date | null {
  // Excel serial number format (e.g. 45335 = 2024-01-15)
  if (typeof value === 'number' && value > 30000 && value < 99999) {
    const date = new Date((value - 25569) * 86400 * 1000)
    if (!isNaN(date.getTime())) return date
  }
  // ISO string format (e.g. "2026-01-15")
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!isNaN(date.getTime())) return date
  }
  return null
}
```

### Why Batch Upsert Instead of Simple Insert

Raw inserts would fail on reimport (unique constraint violations). Upserts (`INSERT ... ON CONFLICT DO UPDATE`) are idempotent — reimporting the same file is safe, it simply overwrites existing records with the same data. This makes the import pipeline a reliable "sync" operation rather than a fragile "one-time load".

Transactions are batched at 50 records because Supabase's connection pool limits the number of concurrent statements, and large transactions risk timeout errors.

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

// One row per lesson participant (customers repeat across multiple rows)
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

return new Response([headers, ...rows].join('\n'), {
  headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="customer_records.csv"'
  }
})
```

The exported CSV can be reimported as-is — the column headers match the import pipeline's expected names.

---

## 11. Performance Optimizations

### Parallel Database Queries

Where two independent queries are needed (e.g., total count + paginated data), they run in parallel:

```typescript
const [customers, total] = await Promise.all([
  prisma.customer.findMany({ skip, take, where, include }),
  prisma.customer.count({ where })
])
```

Without `Promise.all`, these would run sequentially, doubling the database round-trip time.

### Pagination

The All Customers panel fetches 50 customers per page instead of all at once. The search results paginate at 20 per page. This is essential because the database may contain hundreds or thousands of customers, and fetching them all would:
- Slow down the initial API response
- Transfer large amounts of JSON over the network
- Cause React to render hundreds of DOM nodes at once

### Lazy Panel Loading

The All Customers and All Users panels fetch data only on first open. On subsequent opens (toggle off then on again), the cached data in React state is used immediately.

### Customer Detail On-Demand

The search results load only 5 lesson participants per customer as a preview. When the user opens the detail modal, the full lesson history is fetched via `GET /api/customers/[id]`. This means search results are fast regardless of how many lessons a customer has accumulated.

### API Response Caching

Static reference data (instructors list, locations list) changes rarely and is cached at the edge:

```typescript
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
})
```

`s-maxage=60` means Vercel's edge cache serves this response for 60 seconds without hitting the database. `stale-while-revalidate=300` means the cache serves stale data while revalidating in the background for up to 5 minutes, so users never see a loading state for these dropdowns.

### Database Indexes

See [Section 4](#database-indexes) for the full index list. The most impactful are:
- `customers(deletedAt)` — every customer query filters by this
- `customers(firstName)`, `customers(lastName)` — every search query uses these
- `lesson_participants(customerId)` — every customer detail load joins on this

---

## 12. Environment Variables

Create `.env.local` in the project root (never commit this file):

```bash
# PostgreSQL connection — pooled via PgBouncer (used by the app at runtime)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# PostgreSQL direct connection (used by Prisma CLI for migrations only)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].supabase.com:5432/postgres"

# JWT signing secret — generate with: openssl rand -base64 32
JWT_SECRET="your-very-long-random-secret-here"
```

**Where to find these values in Supabase:**
- Go to your project → Settings → Database
- Under "Connection string", select "URI"
- The pooled connection string (port 6543) → `DATABASE_URL`
- Switch to "Direct connection" (port 5432) → `DIRECT_URL`
- The password is the one you set when creating the Supabase project

**On Vercel:** Add these same three variables in Project Settings → Environment Variables. Set them for Production, Preview, and Development environments.

---

## 13. Local Development Setup

### Prerequisites

- Node.js 18 or later
- npm or yarn
- A Supabase project (or any PostgreSQL database)
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/DvbyDt/Ankh-Client-Record-DB.git
cd Ankh-Client-Record-DB/ankh-client-app

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL, DIRECT_URL, JWT_SECRET

# 4. Generate Prisma client (required before first run)
npx prisma generate

# 5. Run database migrations (creates all tables)
npx prisma migrate dev

# 6. (Optional) Seed with test data
npx tsx prisma/seed.ts

# 7. Start development server
npm run dev
```

The app runs at `http://localhost:3000` and redirects to `http://localhost:3000/en`.

### Useful Development Commands

```bash
npm run dev          # Start with Turbopack (fast HMR)
npm run build        # Production build (same as Vercel runs)
npm run lint         # ESLint check
npx prisma studio    # Visual database browser at localhost:5555
npx prisma migrate dev --name "add_new_field"  # Create a new migration
npx prisma generate  # Regenerate TypeScript client after schema changes
```

---

## 14. Database Migrations

Prisma tracks every schema change as a migration file in `prisma/migrations/`. These files are committed to git and represent the complete history of how the database evolved.

### Creating a Migration

```bash
# After editing prisma/schema.prisma:
npx prisma migrate dev --name "describe_what_changed"
```

This command:
1. Compares the current schema to the last migration
2. Generates a new `migration.sql` file with the ALTER TABLE statements
3. Applies the migration to your development database
4. Regenerates the Prisma client TypeScript types

### Applying Migrations in Production

Vercel does not run migrations automatically. You must run them manually when deploying schema changes:

```bash
# With your production DATABASE_URL set:
export DATABASE_URL="postgresql://..."
export DIRECT_URL="postgresql://..."
npx prisma migrate deploy
```

Or alternatively, paste and run the migration SQL directly in Supabase's SQL Editor.

**Important:** Always use `DIRECT_URL` (port 5432, not 6543) for migrations. PgBouncer (the pooled port 6543) does not support the transaction modes that `CREATE INDEX`, `ALTER TABLE`, and other DDL statements require.

### Resetting the Database (Development Only)

```bash
npx prisma migrate reset   # WARNING: drops all data
```

---

## 15. Deployment (Vercel + Supabase)

### Architecture

```
User's Browser
      │
      ▼
Vercel Edge Network (CDN)
  - Serves static assets (JS bundles, fonts)
  - Caches API responses with Cache-Control headers
      │
      ▼
Vercel Serverless Functions
  - Each API route runs as an isolated function
  - Scales to zero when idle
  - Spins up in ~50ms on cold start
      │
      ▼
Supabase PgBouncer (port 6543)
  - Maintains a warm pool of ~10 PostgreSQL connections
  - Queues incoming requests when pool is full
      │
      ▼
Supabase PostgreSQL
  - Hosted in AWS ap-northeast-2 (Seoul) region
  - Automatic daily backups
  - Point-in-time recovery available
```

### Deploy Steps

**First deployment:**

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Set the root directory to `ankh-client-app` if Vercel doesn't detect it automatically
4. Add environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`
5. Click Deploy
6. After deploy succeeds, run migrations: `npx prisma migrate deploy` locally with production credentials

**Subsequent deployments:**

```bash
git add .
git commit -m "your change description"
git push origin main
# Vercel automatically redeploys on push to main
```

### Build Command

Vercel runs `npm run build` which executes `next build --turbopack`. The `postinstall` script in `package.json` runs `prisma generate` automatically during the Vercel build, ensuring the TypeScript client is always regenerated from the schema.

```json
// package.json
"scripts": {
  "build": "next build --turbopack",
  "postinstall": "prisma generate"
}
```

---

## 16. Role-Based Access Control

RBAC is enforced at two layers:

**Layer 1 — API routes:** Every mutating operation checks the JWT role claim before executing:

```typescript
const user = requireAuth(request)
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
if (user.role !== 'MANAGER') return Response.json({ error: 'Forbidden' }, { status: 403 })
```

**Layer 2 — UI:** Manager-only buttons and panels are conditionally rendered:

```tsx
{currentUser?.role === 'MANAGER' && (
  <div className="manager-toolbar">
    <button onClick={() => setAddUserModal(true)}>Add User</button>
    <button onClick={() => deleteCustomer(id)}>Delete</button>
  </div>
)}
```

The UI check is a convenience (hides irrelevant controls), but it is not a security boundary. Security is enforced exclusively at the API layer.

---

## 17. Error Handling Strategy

### API Routes

Every API route is wrapped in a `try/catch`. On error:
- Log the full error to the console (`console.error`) — visible in Vercel's function logs
- Return a generic error message to the client (never expose stack traces or internal details)

```typescript
try {
  // ... database operations
} catch (error) {
  console.error('Error in /api/customers:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

### Frontend

- Network errors set an error state which renders an `AlertCircle` message in the UI
- Form submission errors display inline below the relevant form
- Success actions show a toast notification (auto-dismisses after 4 seconds)
- Destructive actions (delete customer, delete user) require confirmation via a modal dialog before executing

### Import Errors

The CSV import returns partial success — it processes all rows it can and reports errors for individual rows:

```json
{
  "message": "Import completed with 3 errors",
  "processedCount": 147,
  "errorCount": 3,
  "errors": [
    "Row 12: Missing required fields",
    "Row 45: Invalid lesson date format",
    "Row 89: Missing required fields"
  ]
}
```

HTTP status `207 Multi-Status` is used for partial success so the frontend can distinguish a complete failure (5xx) from a partial one.

---

## 18. Adding New Features

### Add a New Field to Customer

1. Edit `prisma/schema.prisma` — add the field to the `Customer` model
2. Run `npx prisma migrate dev --name "add_field_to_customer"`
3. Update the relevant API routes (`GET`, `PUT`) to read/write the new field
4. Update the frontend form and display components

### Add a New API Route

Create a file at `src/app/api/your-resource/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const data = await prisma.yourModel.findMany()
    return NextResponse.json({ data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Add a New Language

1. Create `messages/[locale].json` with all the same keys as `en.json`
2. Add the locale to the array in `src/i18n.ts`:
   ```typescript
   export const locales = ['en', 'ko', 'ja'] as const
   ```
3. The middleware and routing handle the rest automatically

### Add a New Page

Create `src/app/[locale]/your-page/page.tsx`:

```typescript
'use client'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function YourPage() {
  const pathname = usePathname()
  const locale = pathname.split('/')[1] || 'en'
  const t = useTranslations()
  return <div>...</div>
}
```

---

## 19. Common Issues & Fixes

### Build fails with ESLint errors

ESLint is configured to treat `no-unused-vars` and `no-explicit-any` as warnings, not errors. If the build fails for lint reasons, check `eslint.config.mjs` includes:

```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unused-vars": "warn",
  "no-unused-vars": "warn",
  "react/no-unescaped-entities": "warn",
}
```

### `PrismaClientInitializationError` on Vercel

Means the `DATABASE_URL` environment variable is not set or is incorrect in Vercel's project settings. Double-check the variable exists for the Production environment and that the connection string uses port **6543** (pooled).

### Migrations fail with "prepared statement already exists"

This happens when using the pooled connection URL for migrations. Always use `DIRECT_URL` (port 5432) for `prisma migrate deploy`:

```bash
export DATABASE_URL=$DIRECT_URL
npx prisma migrate deploy
```

### `NotFoundError: removeChild` crash on manage-users page

This is caused by browser extensions (Korean IME, password managers) mutating the DOM inside Radix UI portal nodes. The manage-users page has been rewritten to use pure HTML + Tailwind only, avoiding all Radix components. If this error reappears in other pages, remove any shadcn components from that page.

### Search returns no results for Korean names

Korean full-text search works via Prisma's `contains` with `mode: 'insensitive'`. If results are missing, check that the database column collation supports case-insensitive matching for Korean. Supabase's default PostgreSQL collation (`en_US.UTF-8`) handles Korean characters in `ILIKE` queries correctly.

### JWT token not persisting after login

Check that `JWT_SECRET` is set in the environment. If undefined, `jwt.sign()` throws and the login route returns a 500 error. The frontend may silently fail to store the token if the API response is not `200`.

### CSV import creates duplicate customers

The import uses customer ID (from the `Customer ID` column) as the upsert key. If two rows have different IDs for the same person (because the original spreadsheet had inconsistent IDs), they will create two separate customer records. Ensure the source spreadsheet has consistent, stable IDs across all rows for the same customer.