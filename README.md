 # 🏛️ Ankh Client Record Database

A comprehensive, multi-language customer record management system for tracking therapy/treatment sessions, symptoms, and improvements. Built with modern web technologies and designed for healthcare professionals who need reliable access to patient records across multiple locations and instructors.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Features in Detail](#key-features-in-detail)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Internationalization](#internationalization)
- [Deployment](#deployment)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Ankh is a customer record database application designed for managing therapy/treatment sessions with multilingual support (English & Korean). It enables managers and instructors to:

- **Track customer records** with detailed contact information
- **Manage lesson participation** with symptoms and improvements tracking
- **Handle multiple locations** and instructor assignments
- **Import/Export data** via CSV and Excel files
- **Search and filter** customers efficiently
- **View comprehensive analytics** of customer progress

The application supports both **English (en)** and **Korean (ko)** interfaces with proper name formatting for each locale.

---

## ✨ Features

### Core Features
- ✅ **Customer Management** - Create, read, update, and delete customer records
- ✅ **Lesson Tracking** - Record lessons with symptoms, improvements, and lesson content
- ✅ **Multi-Location Support** - Manage customers across multiple locations
- ✅ **Instructor Management** - Assign instructors and track their sessions
- ✅ **Advanced Search** - Search by customer name, instructor, or location
- ✅ **Bulk Import/Export** - Import CSV/Excel files and export records as CSV
- ✅ **User Management** - Create managers and instructor accounts with role-based access
- ✅ **Multilingual Interface** - Full English and Korean support with locale-aware name formatting

### UI Features
- 🎨 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🌙 **Modern Dark/Light UI** - Clean, professional interface with Tailwind CSS
- 📱 **Real-time Search** - Dynamic customer search with filtering
- 🔐 **Role-Based Access** - Manager vs Instructor permissions
- 📊 **Customer Statistics** - View lesson counts, symptoms progression
- 💾 **Session Persistence** - Automatic session management via JWT tokens

### Data Features
- 📈 **Symptom Tracking** - Record initial symptoms and improvements over sessions
- 🎯 **Lesson Content** - Store detailed lesson information (type, content, date)
- 👥 **Bulk Operations** - View all customers/users in expandable lists
- 🔄 **Data Consistency** - Prevents orphaned records with cascade deletes
- 🗑️ **Soft Deletes** - Mark customers as deleted without losing history

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 15.5** - React framework with App Router
- **React 19** - UI component library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **React Hook Form** - Form state management
- **Zod** - Schema validation

### Backend & Database
- **Next.js API Routes** - Serverless backend functions
- **Prisma ORM** - Type-safe database client
- **PostgreSQL** - Primary database (Supabase/Neon compatible)
- **JWT** - Authentication tokens

### Tools & Libraries
- **next-intl** - Internationalization (i18n)
- **xlsx** - Excel file processing
- **papaparse** - CSV parsing
- **bcryptjs** - Password hashing
- **lucide-react** - Icon library
- **js-cookie** - Client-side cookie management
- **date-fns** - Date utilities

### DevOps & Build
- **Vercel** - Recommended deployment platform
- **Turbopack** - Next.js bundler (for build optimization)
- **ESLint** - Code linting
- **Prisma Migrations** - Database versioning

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 (or yarn/pnpm)
- **PostgreSQL** >= 12 (or use Supabase/Neon)
- **Git** (for version control)

### Optional
- **Docker** - For containerized deployment
- **Vercel CLI** - For Vercel deployment

Check your versions:
```bash
node --version
npm --version
```

---

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ankh-client-record-db.git
cd ankh-client-app
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

This will also run the `postinstall` script to generate the Prisma client:
```bash
npx prisma generate
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the root directory:

```bash
# Database Connection
DATABASE_URL="postgresql://user:password@localhost:5432/ankh_db"

# Optional: For production deployments
NODE_ENV="development"
```

**Never commit the `.env.local` file to version control!**

### 4. Initialize the Database
Run Prisma migrations to create tables:

```bash
npx prisma migrate dev --name init
```

This will:
- Create the PostgreSQL schema
- Generate the Prisma client
- Optionally seed test data (see `prisma/seed.ts`)

### 5. (Optional) Seed Test Data
```bash
npm run seed
```

This populates the database with sample customers, instructors, and lessons for testing.

---

## ⚙️ Configuration

### Database Configuration

#### Local PostgreSQL
```bash
# .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/ankh_db"
```

#### Supabase (Recommended for Cloud)
1. Create a project on [Supabase](https://supabase.com)
2. Get your connection string from Project Settings → Database → Connection Strings
3. Add to `.env.local`:
```bash
DATABASE_URL="postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres"
```

#### Neon or Other Providers
Replace `DATABASE_URL` with your provider's connection string.

### Application Configuration

#### Internationalization
Languages are configured in the app:
- **en** - English
- **ko** - Korean (Korean names display as "LastName FirstName")

Routes automatically use locale prefixes:
- `http://localhost:3000/en` - English interface
- `http://localhost:3000/ko` - Korean interface

#### Default Locale
Edit `middleware.ts` to change the default locale:
```typescript
const defaultLocale = 'en'; // Change to 'ko' for Korean
```

---

## 🎮 Getting Started

### Development Server

Start the development server with hot-reload:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Note**: The app will redirect to `/en` by default (English locale).

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

The production server will run on the default port (usually 3000).

### Linting

Check code quality:
```bash
npm run lint
```

---

## 📁 Project Structure

```
ankh-client-app/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx           # Main layout with language switching
│   │   │   ├── page.tsx             # Dashboard with customer search & management
│   │   │   ├── add-record/
│   │   │   │   └── page.tsx         # Add new lesson record for customer
│   │   │   └── manage-users/
│   │   │       └── page.tsx         # User management (managers only)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── login/route.ts   # Login endpoint
│   │   │   ├── customers/
│   │   │   │   ├── route.ts         # GET all customers, POST new customer
│   │   │   │   ├── search/route.ts  # Search customers by name
│   │   │   │   └── [customerId]/route.ts  # GET, PUT, DELETE customer
│   │   │   ├── lessons/
│   │   │   │   ├── new/route.ts     # Create new lesson record
│   │   │   │   └── [lessonId]/participants/route.ts  # Manage lesson participants
│   │   │   ├── users/
│   │   │   │   ├── route.ts         # User CRUD operations
│   │   │   │   ├── [userId]/route.ts
│   │   │   │   └── instructors/route.ts  # Get all instructors
│   │   │   ├── locations/
│   │   │   │   └── route.ts         # Location CRUD
│   │   │   ├── export-csv/route.ts  # Export customer data as CSV
│   │   │   ├── import-csv/route.ts  # Import CSV/Excel files
│   │   │   └── health/
│   │   │       └── db/route.ts      # Database health check
│   │   ├── page.tsx                 # Root redirect to /en
│   │   └── layout.tsx               # Root layout
│   ├── components/
│   │   ├── LanguageSwitcher.tsx     # Locale switcher UI
│   │   └── ui/                      # Reusable UI components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── table.tsx
│   │       └── ... (other Radix UI components)
│   ├── lib/
│   │   └── prisma.ts                # Prisma singleton instance
│   ├── i18n.ts                      # i18n configuration
│   └── generated/
│       └── prisma/                  # Auto-generated Prisma client (do not edit)
├── prisma/
│   ├── schema.prisma                # Database schema definition
│   ├── seed.ts                      # Database seeding script
│   └── migrations/                  # Migration history
│       ├── migration_lock.toml
│       └── [timestamp]_*/
│           └── migration.sql
├── public/                          # Static assets
├── messages/
│   ├── en.json                      # English translations
│   └── ko.json                      # Korean translations
├── middleware.ts                    # Next.js middleware for locale detection
├── next.config.ts                   # Next.js configuration
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.js               # Tailwind CSS configuration
├── postcss.config.js                # PostCSS configuration
├── .env.local                       # Environment variables (local only)
├── .env.example                     # Example environment variables
├── .eslintrc                        # ESLint configuration
├── package.json                     # Dependencies and scripts
└── README.md                        # This file
```

---

## 🎯 Key Features in Detail

### 1. **Customer Management**

#### View All Customers
- Press "View All Customers" button
- See expanded list with:
  - Customer name (locale-aware formatting)
  - Email and phone
  - Initial and current symptoms
  - All lesson records
  - Edit and delete options

#### Search Customers
- Use the search bar to find by:
  - First name
  - Last name
  - Email address
- Results show lesson counts and quick actions

#### Edit Customer
- Click "Edit" button on any customer
- Modify: First name, Last name, Email, Phone
- Changes are saved to the database

#### Delete Customer
- Click trash icon to delete
- Confirmations prevent accidental deletion
- Cascades to delete all related lessons

### 2. **Lesson Recording**

#### Add New Record
1. Click "Add New Record" button
2. Choose: New customer or existing customer
3. Fill in:
   - **Lesson Details**: Instructor, Location, Lesson Type (Group/Individual), Content
   - **Customer Info**: Name, Email, Phone (auto-filled for existing)
   - **Health Tracking**: Current symptoms, Improvements observed
4. Submit to create lesson record

#### Track Symptoms & Improvements
- Initial symptoms from first lesson
- Progress through subsequent lessons
- Automatic comparison of old vs. new symptoms

### 3. **User Management** (Managers Only)

#### Create Users
- Managers can create:
  - New instructors
  - New managers
- Requires: Username, Password, Name, Email, Role

#### View All Users
- Filter by role (Manager/Instructor)
- See user details and creation date
- Delete users if needed

### 4. **Import/Export Data**

#### Export CSV
- Click "Export CSV" to download all customer data
- Includes: ID, name, email, phone, all lessons
- Format compatible with re-import

#### Import CSV/Excel
1. Click "Import CSV"
2. Select file (CSV, XLSX, XLS format)
3. File is parsed and validated
4. Data is merged with existing records
5. Success message shows records imported

**CSV Format Required:**
```
customer_id, customer_name, initial_symptom, lesson_id, lesson_date, instructor_name, lesson_type, lesson_content, customer_symptoms, customer_improvements, course_completion_status
```

### 5. **Multilingual Support**

#### Language Switching
- Click language flag in top right
- Seamlessly switch between English and Korean
- All content updates in real-time

#### Korean-Specific Features
- Names display as "LastName FirstName" (Korean convention)
- All UI text in Korean
- Korean character support for customer data

---

## 📡 API Documentation

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response:
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "firstName": "string",
    "lastName": "string",
    "role": "MANAGER|INSTRUCTOR",
    "email": "string"
  }
}
```

### Customers

#### Get All Customers
```http
GET /api/customers?countOnly=false
Authorization: Bearer {token}
```

#### Search Customers
```http
GET /api/customers/search?name=김준
Authorization: Bearer {token}
```

#### Create Customer (via Lesson)
```http
POST /api/lessons/new
Authorization: Bearer {token}
Content-Type: application/json

{
  "lessonType": "Group|Individual",
  "instructorId": "string",
  "location": "location_id",
  "customers": [
    {
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string",
      "symptoms": "string",
      "improvements": "string"
    }
  ]
}
```

#### Update Customer
```http
PUT /api/customers/{customerId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string"
}
```

#### Delete Customer
```http
DELETE /api/customers/{customerId}
Authorization: Bearer {token}
```

### Lessons

#### Create Lesson
```http
POST /api/lessons/new
Authorization: Bearer {token}
Content-Type: application/json

{
  "lessonType": "Group|Individual",
  "instructorId": "string",
  "location": "location_id",
  "customers": [
    {
      "id": "customer_id",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string",
      "symptoms": "string",
      "improvements": "string"
    }
  ]
}
```

#### Delete Lesson Participant
```http
DELETE /api/lessons/{lessonId}/participants/{customerId}
Authorization: Bearer {token}
```

### Users

#### Create User
```http
POST /api/users
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "role": "MANAGER|INSTRUCTOR",
  "firstName": "string",
  "lastName": "string",
  "email": "string"
}
```

#### Get All Users
```http
GET /api/users
Authorization: Bearer {token}
```

#### Get Instructors
```http
GET /api/users/instructors
Authorization: Bearer {token}
```

#### Delete User
```http
DELETE /api/users/{userId}
Authorization: Bearer {token}
```

### Import/Export

#### Export CSV
```http
GET /api/export-csv
Authorization: Bearer {token}

Response: CSV file download
```

#### Import CSV
```http
POST /api/import-csv
Authorization: Bearer {token}
Content-Type: multipart/form-data

Form Data:
- file: (CSV or Excel file)
```

---

## 🗄️ Database Schema

### Core Tables

#### `User` (Instructors and Managers)
```sql
id              String      @id @default(cuid())
username        String      @unique
password        String      (hashed with bcryptjs)
role            MANAGER|INSTRUCTOR
firstName       String
lastName        String
email           String      @unique
createdAt       DateTime    @default(now())
```

#### `Customer`
```sql
id              String      @id @default(cuid())
firstName       String
lastName        String
email           String
phone           String?
createdAt       DateTime    @default(now())
deletedAt       DateTime?   (soft delete)
lessonParticipants  LessonParticipant[]  (one-to-many)
```

#### `Lesson`
```sql
id              String      @id @default(cuid())
lessonType      Group|Individual
lessonContent   String?
createdAt       DateTime    @default(now())
instructorId    String      (foreign key → User)
locationId      String      (foreign key → Location)
participants    LessonParticipant[]
```

#### `LessonParticipant`
```sql
id              String      @id @default(cuid())
customerId      String      (foreign key → Customer)
lessonId        String      (foreign key → Lesson)
customer        Customer
lesson          Lesson
customerSymptoms    String?     (symptoms at this lesson)
customerImprovements String?    (improvements observed)
status          attended|absent|cancelled?
```

#### `Location`
```sql
id              String      @id @default(cuid())
name            String      @unique
createdAt       DateTime    @default(now())
lessons         Lesson[]
```

### Key Relationships
- **One Instructor → Many Lessons** (1:N)
- **One Lesson → Many Participants** (1:N)
- **One Customer → Many Lessons** (via LessonParticipant) (M:N)
- **One Location → Many Lessons** (1:N)

---

## 🔐 Authentication

### How Login Works

1. **User enters credentials** (username/password)
2. **Frontend sends POST** to `/api/auth/login`
3. **Server validates** credentials with bcryptjs hash comparison
4. **Server generates JWT token** with user information
5. **Token stored** in `js-cookie` (browser cookies)
6. **Subsequent requests** include `Authorization: Bearer {token}` header
7. **API routes verify** token using `require_auth` middleware

### JWT Token Structure
```json
{
  "id": "user_id",
  "username": "username",
  "role": "MANAGER|INSTRUCTOR",
  "iat": 1614000000,
  "exp": 1614086400
}
```

### Security Features
- ✅ Passwords hashed with bcryptjs (salt rounds: 10)
- ✅ JWT tokens with expiration
- ✅ Role-based access control (MANAGER vs INSTRUCTOR)
- ✅ Managers-only operations (delete customers, manage users)
- ✅ Token stored in httpOnly cookies (when possible)

---

## 🌍 Internationalization (i18n)

### Supported Languages
- **English (en)** - Default
- **Korean (ko)** - Full support including name ordering

### How It Works

1. **URL Routing**: All routes prefixed with locale
   - `/en/*` → English interface
   - `/ko/*` → Korean interface

2. **Middleware Detection**: `middleware.ts` extracts locale from URL
3. **Translation Files**: `messages/en.json` and `messages/ko.json`
4. **React Component**: `useTranslations()` hook provides translations
5. **Name Formatting**: `formatName()` function applies locale-specific ordering

### Locale-Aware Name Formatting

**English (en)**:
```
formatName("John", "Doe") → "John Doe"
```

**Korean (ko)**:
```
formatName("준", "김") → "김 준" (LastName FirstName)
```

### Adding New Translations

1. Add key to `messages/en.json`:
```json
{
  "Common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

2. Add corresponding Korean translation to `messages/ko.json`:
```json
{
  "Common": {
    "save": "저장",
    "cancel": "취소"
  }
}
```

3. Use in component:
```tsx
const t = useTranslations()
<button>{t('Common.save')}</button>
```

---

## 🚀 Deployment

### Option 1: Vercel (Recommended)

1. **Push code to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Go to [Vercel](https://vercel.com)** and sign in with GitHub

3. **Import repository**
   - Click "New Project"
   - Select your repository
   - Configure as Next.js project (auto-detected)

4. **Set environment variables**
   - Project Settings → Environment Variables
   - Add `DATABASE_URL` from PostgreSQL provider

5. **Run Prisma migrations** (one-time)
   ```bash
   # Export DATABASE_URL and run migration
   export DATABASE_URL="your_prod_db_url"
   npx prisma migrate deploy
   ```

6. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app is live!

### Option 2: Docker + Railway/Render/Fly.io

1. **Create Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

2. **Build and push image**
```bash
docker build -t ankh-app .
docker tag ankh-app registry.example.com/ankh-app:latest
docker push registry.example.com/ankh-app:latest
```

3. **Deploy to platform** (follow platform-specific instructions)

### Option 3: Self-Hosted (VPS)

1. **SSH into server**
```bash
ssh user@your-server.com
```

2. **Clone repository**
```bash
git clone https://github.com/yourusername/ankh-client-app.git
cd ankh-client-app
```

3. **Install dependencies**
```bash
npm install
npx prisma generate
```

4. **Build**
```bash
npm run build
```

5. **Set environment variables**
```bash
export DATABASE_URL="your_prod_db_url"
export NODE_ENV="production"
```

6. **Run with PM2** (process manager)
```bash
npm install -g pm2
pm2 start npm --name "ankh" -- start
pm2 startup
pm2 save
```

7. **Configure Nginx reverse proxy** for HTTPS and routing

### Database Setup for Production

**Recommended: Supabase**
1. Create account on [Supabase](https://supabase.com)
2. Create project
3. Get connection string
4. Add to Vercel environment variables
5. Run migrations

**Alternative: AWS RDS, Azure Database, etc.**
Follow your provider's PostgreSQL setup instructions.

---

## 💻 Development

### Code Style & Linting

```bash
# Run ESLint
npm run lint

# Format code (if Prettier is set up)
npm run format
```

### Adding New Features

1. **Create feature branch**
```bash
git checkout -b feature/customer-profile
```

2. **Make changes**
   - Update database schema in `prisma/schema.prisma`
   - Run migration: `npx prisma migrate dev`
   - Create API routes in `src/app/api/`
   - Create UI components in `src/app/[locale]/`
   - Add translations to `messages/*.json`

3. **Test locally**
```bash
npm run dev
# Visit http://localhost:3000
```

4. **Commit and push**
```bash
git add .
git commit -m "feat: add customer profile feature"
git push origin feature/customer-profile
```

5. **Create Pull Request** on GitHub

### Database Migrations

After changing `prisma/schema.prisma`:

```bash
# Create and run migration
npx prisma migrate dev --name descriptive_name

# Apply existing migrations in production
npx prisma migrate deploy

# Reset local database (⚠️ deletes all data)
npx prisma migrate reset
```

### Performance Tips

- Use Turbopack for faster builds: already enabled in `package.json`
- Limit API results with pagination for large datasets
- Use Prisma `select` to fetch only needed fields
- Enable caching headers for static content
- Monitor database query performance with Prisma Studio

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "DATABASE_URL not set"
**Cause**: Environment variable not configured
**Solution**:
```bash
# Create .env.local with DATABASE_URL
echo 'DATABASE_URL="postgresql://..."' > .env.local
```

#### 2. "Prisma Client could not be loaded"
**Cause**: Prisma client not generated
**Solution**:
```bash
npx prisma generate
```

#### 3. "Cannot find module 'next-intl'"
**Cause**: Dependencies not installed
**Solution**:
```bash
npm install
```

#### 4. "Customer appears in 'View All' but not in search"
**Cause**: Search results were cached or API limit was reached
**Solution**:
1. Clear browser cache (Cmd+Shift+Delete)
2. Force refresh (Cmd+Shift+R)
3. Restart development server

#### 5. "Name formatting is wrong for Korean customers"
**Cause**: Browser locale not set to 'ko'
**Solution**:
1. Click language switcher (top right)
2. Select Korean flag
3. Page will reload with Korean locale

#### 6. "Import CSV shows error"
**Cause**: CSV format doesn't match expected headers
**Solution**:
1. Verify CSV has required columns (see CSV Format section)
2. Check character encoding is UTF-8
3. For Korean names, ensure proper encoding (not ANSI)

#### 7. "Lesson count doesn't match"
**Cause**: API was limiting results to 5 lessons
**Solution**:
1. Already fixed in `/api/customers/search`
2. Clear browser cache
3. Restart dev server

### Debug Mode

Enable detailed logging:

```typescript
// In API routes
console.log('Debug info:', variable)

// In components
console.log('Component state:', state)
```

### Getting Help

1. **Check ARCHITECTURE.md** for technical details
2. **Review database logs**: `npx prisma studio` (visual DB browser)
3. **Check browser console**: DevTools → Console for errors
4. **Check server logs**: Terminal where `npm run dev` is running

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for similar problems
- Provide detailed reproduction steps

---

## 🎓 Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev)

---

**Last Updated**: March 2, 2026

**Version**: 0.1.0

**Created with ❤️ for healthcare professionals worldwide**
