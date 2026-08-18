import { createHmac } from "crypto";

/**
 * Fonepay merchant web-checkout integration. Like Khalti, Fonepay has no publicly
 * shared sandbox secret — each merchant is issued their own merchant code (PID) and
 * secret key for the dev sandbox. Disabled by default until configured via the admin
 * dashboard's Payment Settings (which take precedence — see `resolveFonepayConfig`).
 *
 * The checkout redirect + its HMAC-SHA512 "DV" signature are documented by Fonepay
 * and confirmed against multiple third-party integration guides. The *verification*
 * call's signed-field order below is a best-effort reconstruction following the same
 * comma-joined-values convention as the checkout signature — double check it against
 * your own Fonepay merchant onboarding docs once you have real credentials.
 */
export interface FonepayConfig {
  merchantCode: string;
  secretKey: string;
  checkoutUrl: string;
  verificationUrl: string;
}

const envDefaults: FonepayConfig = {
  merchantCode: process.env.FONEPAY_MERCHANT_CODE || "",
  secretKey: process.env.FONEPAY_SECRET_KEY || "",
  checkoutUrl: process.env.FONEPAY_CHECKOUT_URL || "https://dev-clientapi.fonepay.com/api/merchantRequest",
  verificationUrl:
    process.env.FONEPAY_VERIFICATION_URL || "https://dev-clientapi.fonepay.com/api/merchantRequest/verificationMerchant",
};

/** Merges admin-configured Payment Settings over the env-var/sandbox defaults. */
export function resolveFonepayConfig(overrides?: {
  fonepayMerchantCode?: string | null;
  fonepaySecretKey?: string | null;
  fonepayCheckoutUrl?: string | null;
  fonepayVerificationUrl?: string | null;
}): FonepayConfig {
  return {
    merchantCode: overrides?.fonepayMerchantCode || envDefaults.merchantCode,
    secretKey: overrides?.fonepaySecretKey || envDefaults.secretKey,
    checkoutUrl: overrides?.fonepayCheckoutUrl || envDefaults.checkoutUrl,
    verificationUrl: overrides?.fonepayVerificationUrl || envDefaults.verificationUrl,
  };
}

function sign(secretKey: string, values: string[]): string {
  return createHmac("sha512", secretKey).update(values.join(",")).digest("hex");
}

/** m/d/yyyy — Fonepay's documented DT format. */
function formatFonepayDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/**
 * Builds the full checkout redirect URL (GET) — the browser is sent here directly,
 * no auto-submitting form needed. `prn` is our own transactionUuid, reused as
 * Fonepay's payment reference number.
 */
export function buildFonepayRedirectUrl(
  params: {
    prn: string;
    amount: number;
    remarks1: string;
    returnUrl: string;
  },
  config: FonepayConfig
): string {
  const amt = params.amount.toFixed(2);
  const dt = formatFonepayDate(new Date());
  const md = "P";
  const crn = "NPR";
  const r1 = params.remarks1;
  const r2 = "N/A";

  const dv = sign(config.secretKey, [config.merchantCode, md, params.prn, amt, crn, dt, r1, r2, params.returnUrl]);

  const url = new URL(config.checkoutUrl);
  url.searchParams.set("PID", config.merchantCode);
  url.searchParams.set("MD", md);
  url.searchParams.set("PRN", params.prn);
  url.searchParams.set("AMT", amt);
  url.searchParams.set("CRN", crn);
  url.searchParams.set("DT", dt);
  url.searchParams.set("R1", r1);
  url.searchParams.set("R2", r2);
  url.searchParams.set("RU", params.returnUrl);
  url.searchParams.set("DV", dv);
  return url.toString();
}

export interface FonepayVerificationResult {
  success: boolean;
  responseCode: string | null;
}

/** Extracts a handful of flat (non-nested) XML tags without pulling in a full XML-parser dependency. */
function extractXmlTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : null;
}

/**
 * The authoritative server-to-server check — never trust the PRN/BID/UID/P_AMT query
 * params Fonepay appends to the return URL as proof of payment.
 */
export async function verifyFonepayPayment(
  params: { prn: string; bid: string; uid: string; amount: number },
  config: FonepayConfig
): Promise<FonepayVerificationResult> {
  const amt = params.amount.toFixed(2);
  const dv = sign(config.secretKey, [config.merchantCode, params.prn, params.bid, params.uid, amt]);

  const url = new URL(config.verificationUrl);
  url.searchParams.set("PID", config.merchantCode);
  url.searchParams.set("PRN", params.prn);
  url.searchParams.set("BID", params.bid);
  url.searchParams.set("UID", params.uid);
  url.searchParams.set("AMT", amt);
  url.searchParams.set("DV", dv);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Fonepay verification failed with HTTP ${res.status}`);
  }
  const xml = await res.text();
  const success = (extractXmlTag(xml, "success") ?? "").toLowerCase() === "true";
  return { success, responseCode: extractXmlTag(xml, "responseCode") };
}
