/*
  Warnings:

  - You are about to drop the column `AC` on the `ProblemSubmissionsStats` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `ProblemSubmissionsStats` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "AC_subs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "input" TEXT NOT NULL DEFAULT 'stdin',
ADD COLUMN     "output" TEXT NOT NULL DEFAULT 'stdout',
ADD COLUMN     "total_subs" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "pdfUuid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProblemSubmissionsStats" DROP COLUMN "AC",
DROP COLUMN "total";
