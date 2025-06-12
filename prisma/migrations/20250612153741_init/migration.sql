/*
  Warnings:

  - Added the required column `name` to the `Contest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Contest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accepted_subs` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `points` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_subs` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Problem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Contest` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `max_rating` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `min_rating` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Judge` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Problem` ADD COLUMN `accepted_subs` INTEGER NOT NULL,
    ADD COLUMN `category` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `points` INTEGER NOT NULL,
    ADD COLUMN `total_subs` INTEGER NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Submission` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isLocked` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `CodingLanguage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `available` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `CodingLanguage_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
