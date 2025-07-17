/*
  Warnings:

  - You are about to drop the column `authorId` on the `Contest` table. All the data in the column will be lost.
  - You are about to drop the column `maxRating` on the `Contest` table. All the data in the column will be lost.
  - You are about to drop the column `minRating` on the `Contest` table. All the data in the column will be lost.
  - The primary key for the `Contestant` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[contestId]` on the table `Contestant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Contestant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `style` to the `Contest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `newRating` to the `Contestant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `oldRating` to the `Contestant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rank` to the `Contestant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratingChange` to the `Contestant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Contestant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContestStyle" AS ENUM ('IOI', 'ICPC', 'TopCoder', 'Heuristic');

-- AlterTable
ALTER TABLE "Contest" DROP COLUMN "authorId",
DROP COLUMN "maxRating",
DROP COLUMN "minRating",
ADD COLUMN     "isRated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "style" "ContestStyle" NOT NULL;

-- AlterTable
ALTER TABLE "Contestant" DROP CONSTRAINT "Contestant_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "isVirtual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newRating" INTEGER NOT NULL,
ADD COLUMN     "oldRating" INTEGER NOT NULL,
ADD COLUMN     "rank" INTEGER NOT NULL,
ADD COLUMN     "ratingChange" INTEGER NOT NULL,
ADD COLUMN     "score" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "Contestant_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "contestantId" INTEGER;

-- CreateTable
CREATE TABLE "_AuthorToContest" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AuthorToContest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CuratorToContest" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CuratorToContest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TesterToContest" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TesterToContest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TesterToProblem" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TesterToProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AuthorToContest_B_index" ON "_AuthorToContest"("B");

-- CreateIndex
CREATE INDEX "_CuratorToContest_B_index" ON "_CuratorToContest"("B");

-- CreateIndex
CREATE INDEX "_TesterToContest_B_index" ON "_TesterToContest"("B");

-- CreateIndex
CREATE INDEX "_TesterToProblem_B_index" ON "_TesterToProblem"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Contestant_contestId_key" ON "Contestant"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "Contestant_userId_key" ON "Contestant"("userId");

-- CreateIndex
CREATE INDEX "Contestant_userId_idx" ON "Contestant"("userId");

-- CreateIndex
CREATE INDEX "Contestant_contestId_idx" ON "Contestant"("contestId");

-- CreateIndex
CREATE INDEX "Contestant_userId_contestId_idx" ON "Contestant"("userId", "contestId");

-- CreateIndex
CREATE INDEX "Submission_contestantId_idx" ON "Submission"("contestantId");

-- CreateIndex
CREATE INDEX "Submission_authorId_contestantId_idx" ON "Submission"("authorId", "contestantId");

-- CreateIndex
CREATE INDEX "Submission_contestantId_problemId_idx" ON "Submission"("contestantId", "problemId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contestantId_fkey" FOREIGN KEY ("contestantId") REFERENCES "Contestant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuthorToContest" ADD CONSTRAINT "_AuthorToContest_A_fkey" FOREIGN KEY ("A") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuthorToContest" ADD CONSTRAINT "_AuthorToContest_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CuratorToContest" ADD CONSTRAINT "_CuratorToContest_A_fkey" FOREIGN KEY ("A") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CuratorToContest" ADD CONSTRAINT "_CuratorToContest_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TesterToContest" ADD CONSTRAINT "_TesterToContest_A_fkey" FOREIGN KEY ("A") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TesterToContest" ADD CONSTRAINT "_TesterToContest_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TesterToProblem" ADD CONSTRAINT "_TesterToProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TesterToProblem" ADD CONSTRAINT "_TesterToProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
