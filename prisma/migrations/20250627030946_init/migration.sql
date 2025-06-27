/*
  Warnings:

  - You are about to drop the column `status` on the `Submission` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SubmissionVerdict" AS ENUM ('RN', 'AC', 'WA', 'AB', 'QU', 'IR', 'CE', 'RTE', 'OLE', 'TLE', 'MLE', 'ISE');

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "status",
ADD COLUMN     "verdict" "SubmissionVerdict" NOT NULL DEFAULT 'QU';

-- DropEnum
DROP TYPE "SubmissionStatus";
