import { requireAdmin } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/settings";
import { paymentSettingsSchema } from "@/schemas/admin-settings";

function serialize(settings: Awaited<ReturnType<typeof getPaymentSettings>>) {
  return {
    ...settings,
    codMinOrderAmount: settings.codMinOrderAmount ? Number(settings.codMinOrderAmount) : null,
    codMaxOrderAmount: settings.codMaxOrderAmount ? Number(settings.codMaxOrderAmount) : null,
    esewaSecretKey: undefined,
    hasEsewaSecretKey: Boolean(settings.esewaSecretKey),
    khaltiSecretKey: undefined,
    hasKhaltiSecretKey: Boolean(settings.khaltiSecretKey),
    fonepaySecretKey: undefined,
    hasFonepaySecretKey: Boolean(settings.fonepaySecretKey),
    connectipsPassword: undefined,
    hasConnectipsPassword: Boolean(settings.connectipsPassword),
    connectipsPrivateKey: undefined,
    hasConnectipsPrivateKey: Boolean(settings.connectipsPrivateKey),
    visaSecretKey: undefined,
    hasVisaSecretKey: Boolean(settings.visaSecretKey),
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getPaymentSettings();
    return ok(serialize(settings));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const parsed = paymentSettingsSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const data = parsed.data;
    const settings = await updatePaymentSettings({
      codEnabled: data.codEnabled,
      codMinOrderAmount: data.codMinOrderAmount ?? null,
      codMaxOrderAmount: data.codMaxOrderAmount ?? null,
      esewaEnabled: data.esewaEnabled,
      esewaLogo: data.esewaLogo || null,
      esewaProductCode: data.esewaProductCode || null,
      esewaSecretKey: data.esewaSecretKey === undefined ? undefined : data.esewaSecretKey || null,
      esewaPaymentUrl: data.esewaPaymentUrl || null,
      esewaStatusUrl: data.esewaStatusUrl || null,
      khaltiEnabled: data.khaltiEnabled,
      khaltiLogo: data.khaltiLogo || null,
      khaltiSecretKey: data.khaltiSecretKey === undefined ? undefined : data.khaltiSecretKey || null,
      khaltiBaseUrl: data.khaltiBaseUrl || null,
      fonepayEnabled: data.fonepayEnabled,
      fonepayLogo: data.fonepayLogo || null,
      fonepayMerchantCode: data.fonepayMerchantCode || null,
      fonepaySecretKey: data.fonepaySecretKey === undefined ? undefined : data.fonepaySecretKey || null,
      fonepayCheckoutUrl: data.fonepayCheckoutUrl || null,
      fonepayVerificationUrl: data.fonepayVerificationUrl || null,
      connectipsEnabled: data.connectipsEnabled,
      connectipsLogo: data.connectipsLogo || null,
      connectipsMerchantId: data.connectipsMerchantId || null,
      connectipsAppId: data.connectipsAppId || null,
      connectipsAppName: data.connectipsAppName || null,
      connectipsPassword: data.connectipsPassword === undefined ? undefined : data.connectipsPassword || null,
      connectipsPrivateKey: data.connectipsPrivateKey === undefined ? undefined : data.connectipsPrivateKey || null,
      connectipsGatewayUrl: data.connectipsGatewayUrl || null,
      connectipsValidationUrl: data.connectipsValidationUrl || null,
      visaEnabled: data.visaEnabled,
      visaLogo: data.visaLogo || null,
      visaMerchantId: data.visaMerchantId || null,
      visaSecretKey: data.visaSecretKey === undefined ? undefined : data.visaSecretKey || null,
      visaGatewayUrl: data.visaGatewayUrl || null,
      visaVerificationUrl: data.visaVerificationUrl || null,
    });

    return ok(serialize(settings), "Payment settings saved");
  } catch (error) {
    return handleApiError(error);
  }
}
