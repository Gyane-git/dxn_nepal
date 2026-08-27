-- AlterTable
ALTER TABLE `dealer` ADD COLUMN `adminRoleId` INTEGER NULL;

-- AlterTable
ALTER TABLE `dealerinventory` ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX `dealer_adminRoleId_idx` ON `dealer`(`adminRoleId`);

-- CreateIndex
CREATE INDEX `dealerinventory_status_idx` ON `dealerinventory`(`status`);

-- AddForeignKey
ALTER TABLE `dealer` ADD CONSTRAINT `dealer_adminRoleId_fkey` FOREIGN KEY (`adminRoleId`) REFERENCES `adminrole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
