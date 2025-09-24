-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."instructors" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "specialization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lessons" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 10,
    "price" DECIMAL(10,2) NOT NULL,
    "location" TEXT,
    "instructorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lesson_participants" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'confirmed',

    CONSTRAINT "lesson_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "public"."customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "instructors_email_key" ON "public"."instructors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_participants_customerId_lessonId_key" ON "public"."lesson_participants"("customerId", "lessonId");

-- AddForeignKey
ALTER TABLE "public"."lessons" ADD CONSTRAINT "lessons_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_participants" ADD CONSTRAINT "lesson_participants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lesson_participants" ADD CONSTRAINT "lesson_participants_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
