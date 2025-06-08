/*
  Warnings:

  - You are about to drop the column `isLoggedOut` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `DOB` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ContestParticipation` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `authorId` to the `Contest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `authorId` to the `Problem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ContestParticipation` DROP FOREIGN KEY `ContestParticipation_contestId_fkey`;

-- DropForeignKey
ALTER TABLE `ContestParticipation` DROP FOREIGN KEY `ContestParticipation_userId_fkey`;

-- AlterTable
ALTER TABLE `Contest` ADD COLUMN `authorId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Problem` ADD COLUMN `authorId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Rating` ADD COLUMN `contests_cnt` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Role` MODIFY `perms` BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Session` DROP COLUMN `isLoggedOut`;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `DOB`,
    DROP COLUMN `gender`,
    ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `perms` BIGINT NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('ACTIVE', 'DISABLED', 'BANNED', 'CONF_AWAITING') NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE `ContestParticipation`;

-- CreateTable
CREATE TABLE `Contestant` (
    `contestId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`contestId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JudgeToken` (
    `id` VARCHAR(191) NOT NULL,
    `judgeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `JudgeToken_judgeId_key`(`judgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Contestant` ADD CONSTRAINT `Contestant_contestId_fkey` FOREIGN KEY (`contestId`) REFERENCES `Contest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contestant` ADD CONSTRAINT `Contestant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JudgeToken` ADD CONSTRAINT `JudgeToken_judgeId_fkey` FOREIGN KEY (`judgeId`) REFERENCES `Judge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
