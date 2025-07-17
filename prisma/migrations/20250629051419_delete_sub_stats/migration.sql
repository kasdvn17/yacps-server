/*
  Warnings:

  - You are about to drop the column `AC_subs` on the `Problem` table. All the data in the column will be lost.
  - You are about to drop the column `total_subs` on the `Problem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "AC_subs",
DROP COLUMN "total_subs";
