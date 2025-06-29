/*
  Warnings:

  - You are about to drop the column `isDeleted` on the `Submission` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('ACTIVE', 'ABORTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'LOCKED');

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "status" "ProblemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "isDeleted",
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'ACTIVE';
