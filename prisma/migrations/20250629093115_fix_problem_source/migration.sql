/*
  Warnings:

  - You are about to drop the column `authors` on the `Problem` table. All the data in the column will be lost.
  - You are about to drop the column `curators` on the `Problem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "authors",
DROP COLUMN "curators",
ADD COLUMN     "problemSource" TEXT;

-- CreateTable
CREATE TABLE "_AuthorToProblem" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AuthorToProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CuratorToProblem" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CuratorToProblem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AuthorToProblem_B_index" ON "_AuthorToProblem"("B");

-- CreateIndex
CREATE INDEX "_CuratorToProblem_B_index" ON "_CuratorToProblem"("B");

-- AddForeignKey
ALTER TABLE "_AuthorToProblem" ADD CONSTRAINT "_AuthorToProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuthorToProblem" ADD CONSTRAINT "_AuthorToProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CuratorToProblem" ADD CONSTRAINT "_CuratorToProblem_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CuratorToProblem" ADD CONSTRAINT "_CuratorToProblem_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
