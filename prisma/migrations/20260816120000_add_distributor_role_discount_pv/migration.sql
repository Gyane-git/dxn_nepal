-- AlterTable
ALTER TABLE `order` ADD COLUMN `pvCredited` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `totalPv` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `discountPercent` DECIMAL(5, 2) NULL,
    ADD COLUMN `pvEarned` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `customerDiscountPercent` DECIMAL(5, 2) NULL,
    ADD COLUMN `forCustomer` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `forDistributor` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasDiscount` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasPointValue` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `distributorApprovedAt` DATETIME(3) NULL,
    ADD COLUMN `distributorId` VARCHAR(191) NULL,
    ADD COLUMN `pvBalance` INTEGER NOT NULL DEFAULT 0,
    MODIFY `role` ENUM('USER', 'ADMIN', 'DISTRIBUTOR') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `distributorapplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `distributorId` VARCHAR(191) NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `distributorapplication_userId_idx`(`userId`),
    INDEX `distributorapplication_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `distributorsequence` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `lastValue` INTEGER NOT NULL DEFAULT 100000,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productdistributordiscount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `distributorId` INTEGER NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `productdistributordiscount_productId_idx`(`productId`),
    INDEX `productdistributordiscount_distributorId_idx`(`distributorId`),
    UNIQUE INDEX `productdistributordiscount_productId_distributorId_key`(`productId`, `distributorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productdistributorpv` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `distributorId` INTEGER NOT NULL,
    `pvValue` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `productdistributorpv_productId_idx`(`productId`),
    INDEX `productdistributorpv_distributorId_idx`(`distributorId`),
    UNIQUE INDEX `productdistributorpv_productId_distributorId_key`(`productId`, `distributorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `user_distributorId_key` ON `user`(`distributorId`);

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributorapplication` ADD CONSTRAINT `distributorapplication_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productdistributordiscount` ADD CONSTRAINT `productdistributordiscount_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productdistributordiscount` ADD CONSTRAINT `productdistributordiscount_distributorId_fkey` FOREIGN KEY (`distributorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productdistributorpv` ADD CONSTRAINT `productdistributorpv_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productdistributorpv` ADD CONSTRAINT `productdistributorpv_distributorId_fkey` FOREIGN KEY (`distributorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
