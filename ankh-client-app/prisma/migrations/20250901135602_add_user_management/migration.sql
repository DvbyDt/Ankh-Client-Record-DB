/*
  Warnings:

  - You are about to drop the column `joinedAt` on the `lesson_participants` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `maxCapacity` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the `instructors` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `lesson_participants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationId` to the `lessons` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('MANAGER', 'INSTRUCTOR');

-- DropForeignKey
ALTER TABLE "public"."lessons" DROP CONSTRAINT "lessons_instructorId_fkey";

-- AlterTable
ALTER TABLE "public"."lesson_participants" DROP COLUMN "joinedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'attended';

-- AlterTable
ALTER TABLE "public"."lessons" DROP COLUMN "description",
DROP COLUMN "location",
DROP COLUMN "maxCapacity",
ADD COLUMN     "locationId" TEXT NOT NULL,
ALTER COLUMN "courseCompletionStatus" DROP DEFAULT,
ALTER COLUMN "lessonType" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."instructors";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "public"."locations"("name");

-- AddForeignKey
ALTER TABLE "public"."lessons" ADD CONSTRAINT "lessons_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lessons" ADD CONSTRAINT "lessons_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
