/*
  Warnings:

  - You are about to drop the column `type` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userRoleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `UserRole` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserToUserRole` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[host]` on the table `Judge` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `host` to the `Judge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastActive` to the `Judge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Judge` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `_UserToUserRole` DROP FOREIGN KEY `_UserToUserRole_A_fkey`;

-- DropForeignKey
ALTER TABLE `_UserToUserRole` DROP FOREIGN KEY `_UserToUserRole_B_fkey`;

-- AlterTable
ALTER TABLE `Judge` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `host` VARCHAR(191) NOT NULL,
    ADD COLUMN `ip` VARCHAR(191) NULL,
    ADD COLUMN `lastActive` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `type`,
    DROP COLUMN `userRoleId`;

-- DropTable
DROP TABLE `UserRole`;

-- DropTable
DROP TABLE `_UserToUserRole`;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `perms` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_id_key`(`id`),
    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserOnRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Judge_host_key` ON `Judge`(`host`);

-- AddForeignKey
ALTER TABLE `UserOnRole` ADD CONSTRAINT `UserOnRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserOnRole` ADD CONSTRAINT `UserOnRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
