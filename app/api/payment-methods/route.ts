import { ok, handleApiError } from "@/lib/api";
import { getPaymentSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await getPaymentSettings();
    return ok({
      codEnabled: settings.codEnabled,
      esewaEnabled: settings.esewaEnabled,
      esewaLogo: settings.esewaLogo,
      khaltiEnabled: settings.khaltiEnabled,
      khaltiLogo: settings.khaltiLogo,
      fonepayEnabled: settings.fonepayEnabled,
      fonepayLogo: settings.fonepayLogo,
      connectipsEnabled: settings.connectipsEnabled,
      connectipsLogo: settings.connectipsLogo,
      visaEnabled: settings.visaEnabled,
      visaLogo: settings.visaLogo,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
