/*
  Warnings:

  - You are about to drop the `_CategoryToProblem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CategoryToProblem" DROP CONSTRAINT "_CategoryToProblem_A_fkey";

-- DropForeignKey
ALTER TABLE "_CategoryToProblem" DROP CONSTRAINT "_CategoryToProblem_B_fkey";

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "categoryId" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "curators" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "authors" SET DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "_CategoryToProblem";

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
