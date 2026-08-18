-- AlterTable
ALTER TABLE `user` MODIFY `pvBalance` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `order` MODIFY `totalPv` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orderitem` MODIFY `pvEarned` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `productdistributorpv` MODIFY `pvValue` DECIMAL(10, 2) NOT NULL;
