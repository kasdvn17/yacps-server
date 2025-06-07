/*
  Warnings:

  - Added the required column `color` to the `Role` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `Role_name_key` ON `Role`;

-- AlterTable
ALTER TABLE `Role` ADD COLUMN `color` VARCHAR(191) NOT NULL;
