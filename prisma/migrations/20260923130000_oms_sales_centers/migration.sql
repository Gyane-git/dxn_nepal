ALTER TABLE `dealer`
  ADD COLUMN `salesCenterCode` VARCHAR(191) NULL,
  ADD COLUMN `country` VARCHAR(191) NULL,
  ADD COLUMN `contactPerson` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Dealer_salesCenterCode_key` ON `dealer`(`salesCenterCode`);
