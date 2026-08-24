-- DropForeignKey
ALTER TABLE `dealer` DROP FOREIGN KEY `dealer_userId_fkey`;

-- AlterTable
ALTER TABLE `dealer` MODIFY `userId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `dealer` ADD CONSTRAINT `dealer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
