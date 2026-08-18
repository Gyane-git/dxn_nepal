-- AlterTable
ALTER TABLE `paymentsettings`
    CHANGE COLUMN `nabilbankEnabled` `visaEnabled` BOOLEAN NOT NULL DEFAULT false,
    CHANGE COLUMN `nabilbankLogo` `visaLogo` VARCHAR(191) NULL,
    CHANGE COLUMN `nabilbankMerchantId` `visaMerchantId` VARCHAR(191) NULL,
    CHANGE COLUMN `nabilbankSecretKey` `visaSecretKey` VARCHAR(191) NULL,
    CHANGE COLUMN `nabilbankGatewayUrl` `visaGatewayUrl` VARCHAR(191) NULL,
    CHANGE COLUMN `nabilbankVerificationUrl` `visaVerificationUrl` VARCHAR(191) NULL;
