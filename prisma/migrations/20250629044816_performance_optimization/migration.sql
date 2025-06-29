/*
  Warnings:

  - The primary key for the `Problem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ProblemLanguageTestEnvironment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `problemSlug` on the `ProblemLanguageTestEnvironment` table. All the data in the column will be lost.
  - The primary key for the `ProblemTestEnvironment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `problemSlug` on the `ProblemTestEnvironment` table. All the data in the column will be lost.
  - The primary key for the `Role` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Role` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `problemSlug` on the `Submission` table. All the data in the column will be lost.
  - The primary key for the `_ContestToProblem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_ProblemToType` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `ProblemSubmissionsStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Rating` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserOnRole` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Contest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Problem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[problemId]` on the table `ProblemLanguageTestEnvironment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `problemId` to the `ProblemLanguageTestEnvironment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `problemId` to the `ProblemTestEnvironment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `problemId` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `B` on the `_ContestToProblem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `A` on the `_ProblemToType` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "ProblemLanguageTestEnvironment" DROP CONSTRAINT "ProblemLanguageTestEnvironment_problemSlug_fkey";

-- DropForeignKey
ALTER TABLE "ProblemSubmissionsStats" DROP CONSTRAINT "ProblemSubmissionsStats_problemSlug_fkey";

-- DropForeignKey
ALTER TABLE "ProblemTestEnvironment" DROP CONSTRAINT "ProblemTestEnvironment_problemSlug_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_userId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_problemSlug_fkey";

-- DropForeignKey
ALTER TABLE "UserOnRole" DROP CONSTRAINT "UserOnRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserOnRole" DROP CONSTRAINT "UserOnRole_userId_fkey";

-- DropForeignKey
ALTER TABLE "_ContestToProblem" DROP CONSTRAINT "_ContestToProblem_B_fkey";

-- DropForeignKey
ALTER TABLE "_ProblemToType" DROP CONSTRAINT "_ProblemToType_A_fkey";

-- DropIndex
DROP INDEX "ProblemLanguageTestEnvironment_problemSlug_key";

-- AlterTable
ALTER TABLE "Problem" DROP CONSTRAINT "Problem_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Problem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ProblemLanguageTestEnvironment" DROP CONSTRAINT "ProblemLanguageTestEnvironment_pkey",
DROP COLUMN "problemSlug",
ADD COLUMN     "problemId" INTEGER NOT NULL,
ADD CONSTRAINT "ProblemLanguageTestEnvironment_pkey" PRIMARY KEY ("problemId", "lang");

-- AlterTable
ALTER TABLE "ProblemTestEnvironment" DROP CONSTRAINT "ProblemTestEnvironment_pkey",
DROP COLUMN "problemSlug",
ADD COLUMN     "problemId" INTEGER NOT NULL,
ADD CONSTRAINT "ProblemTestEnvironment_pkey" PRIMARY KEY ("problemId");

-- AlterTable
ALTER TABLE "Role" DROP CONSTRAINT "Role_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "ip" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "problemSlug",
ADD COLUMN     "problemId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "_ContestToProblem" DROP CONSTRAINT "_ContestToProblem_AB_pkey",
DROP COLUMN "B",
ADD COLUMN     "B" INTEGER NOT NULL,
ADD CONSTRAINT "_ContestToProblem_AB_pkey" PRIMARY KEY ("A", "B");

-- AlterTable
ALTER TABLE "_ProblemToType" DROP CONSTRAINT "_ProblemToType_AB_pkey",
DROP COLUMN "A",
ADD COLUMN     "A" INTEGER NOT NULL,
ADD CONSTRAINT "_ProblemToType_AB_pkey" PRIMARY KEY ("A", "B");

-- DropTable
DROP TABLE "ProblemSubmissionsStats";

-- DropTable
DROP TABLE "Rating";

-- DropTable
DROP TABLE "UserOnRole";

-- DropEnum
DROP TYPE "Gender";

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemLanguageTestEnvironment_problemId_key" ON "ProblemLanguageTestEnvironment"("problemId");

-- CreateIndex
CREATE INDEX "Submission_authorId_idx" ON "Submission"("authorId");

-- CreateIndex
CREATE INDEX "Submission_problemId_idx" ON "Submission"("problemId");

-- CreateIndex
CREATE INDEX "Submission_authorId_problemId_idx" ON "Submission"("authorId", "problemId");

-- CreateIndex
CREATE INDEX "_ContestToProblem_B_index" ON "_ContestToProblem"("B");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemTestEnvironment" ADD CONSTRAINT "ProblemTestEnvironment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemLanguageTestEnvironment" ADD CONSTRAINT "ProblemLanguageTestEnvironment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "ProblemTestEnvironment"("problemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContestToProblem" ADD CONSTRAINT "_ContestToProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemToType" ADD CONSTRAINT "_ProblemToType_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
