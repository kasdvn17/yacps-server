/*
  Warnings:

  - You are about to drop the column `category` on the `Problem` table. All the data in the column will be lost.
  - You are about to drop the column `statement` on the `Problem` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Problem` table. All the data in the column will be lost.
  - You are about to drop the `ProblemOnContest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProblemOnContest" DROP CONSTRAINT "ProblemOnContest_contestId_fkey";

-- DropForeignKey
ALTER TABLE "ProblemOnContest" DROP CONSTRAINT "ProblemOnContest_problemSlug_fkey";

-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "category",
DROP COLUMN "statement",
DROP COLUMN "userId",
ADD COLUMN     "solution" TEXT;

-- DropTable
DROP TABLE "ProblemOnContest";

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" INTEGER NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Type" (
    "id" SERIAL NOT NULL,
    "name" INTEGER NOT NULL,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContestToProblem" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContestToProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CategoryToProblem" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProblemToType" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProblemToType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Type_name_key" ON "Type"("name");

-- CreateIndex
CREATE INDEX "_ContestToProblem_B_index" ON "_ContestToProblem"("B");

-- CreateIndex
CREATE INDEX "_CategoryToProblem_B_index" ON "_CategoryToProblem"("B");

-- CreateIndex
CREATE INDEX "_ProblemToType_B_index" ON "_ProblemToType"("B");

-- AddForeignKey
ALTER TABLE "_ContestToProblem" ADD CONSTRAINT "_ContestToProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContestToProblem" ADD CONSTRAINT "_ContestToProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "Problem"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToProblem" ADD CONSTRAINT "_CategoryToProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToProblem" ADD CONSTRAINT "_CategoryToProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "Problem"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemToType" ADD CONSTRAINT "_ProblemToType_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemToType" ADD CONSTRAINT "_ProblemToType_B_fkey" FOREIGN KEY ("B") REFERENCES "Type"("id") ON DELETE CASCADE ON UPDATE CASCADE;
