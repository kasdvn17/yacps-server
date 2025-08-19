-- CreateEnum
CREATE TYPE "TestcaseDataVisibility" AS ENUM ('AUTHOR_ONLY', 'EVERYONE');

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "testcaseDataVisibility" "TestcaseDataVisibility" NOT NULL DEFAULT 'AUTHOR_ONLY';
