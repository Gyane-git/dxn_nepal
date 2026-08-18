-- AlterTable
ALTER TABLE `paymentsettings`
    DROP COLUMN `stripeEnabled`,
    DROP COLUMN `stripeLogo`,
    DROP COLUMN `stripeSecretKey`,
    DROP COLUMN `stripeCurrency`,
    ADD COLUMN `nabilbankEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nabilbankLogo` VARCHAR(191) NULL,
    ADD COLUMN `nabilbankMerchantId` VARCHAR(191) NULL,
    ADD COLUMN `nabilbankSecretKey` VARCHAR(191) NULL,
    ADD COLUMN `nabilbankGatewayUrl` VARCHAR(191) NULL,
    ADD COLUMN `nabilbankVerificationUrl` VARCHAR(191) NULL;
