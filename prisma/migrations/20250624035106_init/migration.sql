/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `JudgeToken` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "JudgeStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "Judge" ADD COLUMN     "status" "JudgeStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "JudgeToken" DROP COLUMN "updatedAt";
