-- AlterTable
ALTER TABLE `distributorapplication` ADD COLUMN `alternatePhone` VARCHAR(191) NULL,
    ADD COLUMN `businessAddress` VARCHAR(191) NULL,
    ADD COLUMN `businessEmail` VARCHAR(191) NULL,
    ADD COLUMN `businessName` VARCHAR(191) NULL,
    ADD COLUMN `businessPhone` VARCHAR(191) NULL,
    ADD COLUMN `businessType` VARCHAR(191) NULL,
    ADD COLUMN `districtId` INTEGER NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `estimatedMonthlySales` DECIMAL(12, 2) NULL,
    ADD COLUMN `fullAddress` VARCHAR(191) NULL,
    ADD COLUMN `landmark` VARCHAR(191) NULL,
    ADD COLUMN `municipalityId` INTEGER NULL,
    ADD COLUMN `numberOfEmployees` INTEGER NULL,
    ADD COLUMN `panVatNumber` VARCHAR(191) NULL,
    ADD COLUMN `provinceId` INTEGER NULL,
    ADD COLUMN `registrationNumber` VARCHAR(191) NULL,
    ADD COLUMN `sponsorDistributorId` INTEGER NULL,
    ADD COLUMN `toleArea` VARCHAR(191) NULL,
    ADD COLUMN `wardId` INTEGER NULL,
    ADD COLUMN `yearsInBusiness` INTEGER NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `notification` ADD COLUMN `link` VARCHAR(191) NULL,
    ADD COLUMN `type` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `dealerId` INTEGER NULL,
    ADD COLUMN `dealerName` VARCHAR(191) NULL,
    ADD COLUMN `dealerPhone` VARCHAR(191) NULL,
    ADD COLUMN `wardId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ward` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `municipalityId` INTEGER NOT NULL,
    `wardNo` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ward_municipalityId_idx`(`municipalityId`),
    UNIQUE INDEX `ward_municipalityId_wardNo_key`(`municipalityId`, `wardNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warddistance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromWardId` INTEGER NOT NULL,
    `toWardId` INTEGER NOT NULL,
    `distance` INTEGER NOT NULL,

    INDEX `warddistance_fromWardId_idx`(`fromWardId`),
    INDEX `warddistance_toWardId_idx`(`toWardId`),
    UNIQUE INDEX `warddistance_fromWardId_toWardId_key`(`fromWardId`, `toWardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dealer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `shippingCharge` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dealer_userId_key`(`userId`),
    INDEX `dealer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dealerwardassignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dealerId` INTEGER NOT NULL,
    `wardId` INTEGER NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dealerwardassignment_dealerId_idx`(`dealerId`),
    INDEX `dealerwardassignment_wardId_idx`(`wardId`),
    UNIQUE INDEX `dealerwardassignment_wardId_priority_key`(`wardId`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dealerinventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dealerId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `variantId` INTEGER NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dealerinventory_dealerId_idx`(`dealerId`),
    INDEX `dealerinventory_productId_idx`(`productId`),
    UNIQUE INDEX `dealerinventory_dealerId_productId_variantId_key`(`dealerId`, `productId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dealershippingcharge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dealerId` INTEGER NOT NULL,
    `wardId` INTEGER NOT NULL,
    `charge` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dealershippingcharge_dealerId_idx`(`dealerId`),
    INDEX `dealershippingcharge_wardId_idx`(`wardId`),
    UNIQUE INDEX `dealershippingcharge_dealerId_wardId_key`(`dealerId`, `wardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditlog_actorId_idx`(`actorId`),
    INDEX `auditlog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `distributorapplication_sponsorDistributorId_idx` ON `distributorapplication`(`sponsorDistributorId`);

-- CreateIndex
CREATE INDEX `distributorapplication_wardId_idx` ON `distributorapplication`(`wardId`);

-- CreateIndex
CREATE INDEX `order_wardId_idx` ON `order`(`wardId`);

-- CreateIndex
CREATE INDEX `order_dealerId_idx` ON `order`(`dealerId`);

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_sponsorDistributorId_fkey` FOREIGN KEY (`sponsorDistributorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `addressbook`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `addressbook`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `addressbook`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `ward`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ward` ADD CONSTRAINT `ward_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `addressbook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warddistance` ADD CONSTRAINT `warddistance_fromWardId_fkey` FOREIGN KEY (`fromWardId`) REFERENCES `ward`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warddistance` ADD CONSTRAINT `warddistance_toWardId_fkey` FOREIGN KEY (`toWardId`) REFERENCES `ward`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealer` ADD CONSTRAINT `dealer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealerwardassignment` ADD CONSTRAINT `dealerwardassignment_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `dealer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealerwardassignment` ADD CONSTRAINT `dealerwardassignment_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `ward`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealerinventory` ADD CONSTRAINT `dealerinventory_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `dealer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealerinventory` ADD CONSTRAINT `dealerinventory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealerinventory` ADD CONSTRAINT `dealerinventory_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `productvariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealershippingcharge` ADD CONSTRAINT `dealershippingcharge_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `dealer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dealershippingcharge` ADD CONSTRAINT `dealershippingcharge_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `ward`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditlog` ADD CONSTRAINT `auditlog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `ward`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `dealer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
