import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

export async function getEmailSettings() {
  return prisma.emailSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function updateEmailSettings(data: {
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null | undefined;
  secure: boolean;
  fromName: string;
  fromEmail: string | null;
}) {
  const { smtpPassword, ...rest } = data;
  return prisma.emailSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { ...rest, ...(smtpPassword !== undefined ? { smtpPassword } : {}) },
    create: { id: SETTINGS_ID, ...rest, smtpPassword: smtpPassword ?? null },
  });
}

export async function getPaymentSettings() {
  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function updatePaymentSettings(data: {
  codEnabled: boolean;
  codMinOrderAmount: number | null;
  codMaxOrderAmount: number | null;
  esewaEnabled: boolean;
  esewaLogo: string | null;
  esewaProductCode: string | null;
  esewaSecretKey: string | null | undefined;
  esewaPaymentUrl: string | null;
  esewaStatusUrl: string | null;
  khaltiEnabled: boolean;
  khaltiLogo: string | null;
  khaltiSecretKey: string | null | undefined;
  khaltiBaseUrl: string | null;
  fonepayEnabled: boolean;
  fonepayLogo: string | null;
  fonepayMerchantCode: string | null;
  fonepaySecretKey: string | null | undefined;
  fonepayCheckoutUrl: string | null;
  fonepayVerificationUrl: string | null;
  connectipsEnabled: boolean;
  connectipsLogo: string | null;
  connectipsMerchantId: string | null;
  connectipsAppId: string | null;
  connectipsAppName: string | null;
  connectipsPassword: string | null | undefined;
  connectipsPrivateKey: string | null | undefined;
  connectipsGatewayUrl: string | null;
  connectipsValidationUrl: string | null;
  visaEnabled: boolean;
  visaLogo: string | null;
  visaMerchantId: string | null;
  visaSecretKey: string | null | undefined;
  visaGatewayUrl: string | null;
  visaVerificationUrl: string | null;
}) {
  const {
    esewaSecretKey,
    khaltiSecretKey,
    fonepaySecretKey,
    connectipsPassword,
    connectipsPrivateKey,
    visaSecretKey,
    ...rest
  } = data;
  const secretUpdates = {
    ...(esewaSecretKey !== undefined ? { esewaSecretKey } : {}),
    ...(khaltiSecretKey !== undefined ? { khaltiSecretKey } : {}),
    ...(fonepaySecretKey !== undefined ? { fonepaySecretKey } : {}),
    ...(connectipsPassword !== undefined ? { connectipsPassword } : {}),
    ...(connectipsPrivateKey !== undefined ? { connectipsPrivateKey } : {}),
    ...(visaSecretKey !== undefined ? { visaSecretKey } : {}),
  };
  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { ...rest, ...secretUpdates },
    create: {
      id: SETTINGS_ID,
      ...rest,
      esewaSecretKey: esewaSecretKey ?? null,
      khaltiSecretKey: khaltiSecretKey ?? null,
      fonepaySecretKey: fonepaySecretKey ?? null,
      connectipsPassword: connectipsPassword ?? null,
      connectipsPrivateKey: connectipsPrivateKey ?? null,
      visaSecretKey: visaSecretKey ?? null,
    },
  });
}

export async function getInvoiceSettings() {
  return prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function updateInvoiceSettings(data: {
  companyName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  footerNote: string | null;
  logo: string | null;
  invoicePrefix: string;
}) {
  return prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}
