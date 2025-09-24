/*
  Warnings:

  - You are about to drop the column `address` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `lessons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."customers" DROP COLUMN "address";

-- AlterTable
ALTER TABLE "public"."lesson_participants" ADD COLUMN     "customerImprovements" TEXT,
ADD COLUMN     "customerSymptoms" TEXT;

-- AlterTable
ALTER TABLE "public"."lessons" DROP COLUMN "price",
ADD COLUMN     "courseCompletionStatus" TEXT NOT NULL DEFAULT 'In Progress',
ADD COLUMN     "lessonType" TEXT NOT NULL DEFAULT 'Group';
