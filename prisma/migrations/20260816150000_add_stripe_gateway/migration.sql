-- AlterTable
ALTER TABLE `paymentsettings`
    ADD COLUMN `stripeEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `stripeLogo` VARCHAR(191) NULL,
    ADD COLUMN `stripeSecretKey` VARCHAR(191) NULL,
    ADD COLUMN `stripeCurrency` VARCHAR(191) NOT NULL DEFAULT 'usd';
