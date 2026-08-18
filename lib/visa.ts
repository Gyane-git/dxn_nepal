import { createHmac } from "crypto";

/**
 * Generic Visa card payment integration. Card acceptance isn't bank-specific — once
 * DXN integrates with any Nepal Rastra Bank "A"-class commercial bank's Electronic
 * Payment Gateway (EPG) as its acquirer (Nabil, NIC Asia, Global IME, etc.), that
 * gateway accepts Visa cards issued by ANY bank, since Visa is a shared card network,
 * not a single issuer's product. This module is acquirer-agnostic: whichever bank's
 * EPG you actually sign up with, paste its credentials into the admin dashboard's
 * Payment Settings (which take precedence — see `resolveVisaConfig`).
 *
 * No acquiring bank in Nepal publishes public EPG API docs — the real endpoint URLs,
 * field names, and signing scheme are handed to you directly by your acquirer's IT
 * team after enrolling as a merchant. Everything below — field names, the HMAC-SHA256
 * signing scheme, and the verification response shape — is a PROVISIONAL SCAFFOLD
 * following this codebase's eSewa/Fonepay conventions, not confirmed against any real
 * bank's documentation. Replace `sign`, `VisaFormFields`, and `VisaVerificationResult`
 * once you receive your actual EPG integration kit. Disabled by default until
 * configured via the admin dashboard.
 */
export interface VisaConfig {
  merchantId: string;
  secretKey: string;
  gatewayUrl: string;
  verificationUrl: string;
}

const envDefaults: VisaConfig = {
  merchantId: process.env.VISA_MERCHANT_ID || "",
  secretKey: process.env.VISA_SECRET_KEY || "",
  gatewayUrl: process.env.VISA_GATEWAY_URL || "",
  verificationUrl: process.env.VISA_VERIFICATION_URL || "",
};

/** Merges admin-configured Payment Settings over the env-var defaults. */
export function resolveVisaConfig(overrides?: {
  visaMerchantId?: string | null;
  visaSecretKey?: string | null;
  visaGatewayUrl?: string | null;
  visaVerificationUrl?: string | null;
}): VisaConfig {
  return {
    merchantId: overrides?.visaMerchantId || envDefaults.merchantId,
    secretKey: overrides?.visaSecretKey || envDefaults.secretKey,
    gatewayUrl: overrides?.visaGatewayUrl || envDefaults.gatewayUrl,
    verificationUrl: overrides?.visaVerificationUrl || envDefaults.verificationUrl,
  };
}

/** PLACEHOLDER signing scheme (HMAC-SHA256 over comma-joined `field=value` pairs) — confirm the real scheme against your acquiring bank's integration kit before going live. */
function sign(secretKey: string, fields: Record<string, string>, signedFieldNames: string[]): string {
  const message = signedFieldNames.map((name) => `${name}=${fields[name]}`).join(",");
  return createHmac("sha256", secretKey).update(message).digest("hex");
}

export interface VisaFormFields {
  merchant_id: string;
  txn_id: string;
  amount: string;
  return_url: string;
  signed_field_names: string;
  signature: string;
}

/** Builds the signed form fields to auto-submit (POST) to `config.gatewayUrl`. PLACEHOLDER field names. */
export function buildVisaFormFields(
  params: { txnId: string; amount: number; returnUrl: string },
  config: VisaConfig
): VisaFormFields {
  const signedFieldNames = ["merchant_id", "txn_id", "amount"];
  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    txn_id: params.txnId,
    amount: params.amount.toFixed(2),
  };

  return {
    ...fields,
    return_url: params.returnUrl,
    signed_field_names: signedFieldNames.join(","),
    signature: sign(config.secretKey, fields, signedFieldNames),
  } as VisaFormFields;
}

export type VisaTransactionStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface VisaVerificationResult {
  status: VisaTransactionStatus;
  amount: number;
  refId: string | null;
}

/**
 * The authoritative server-to-server check — never trust query params the gateway
 * appends to the return URL as proof of payment. PLACEHOLDER request/response shape.
 */
export async function verifyVisaPayment(
  params: { txnId: string; amount: number },
  config: VisaConfig
): Promise<VisaVerificationResult> {
  const fields = { merchant_id: config.merchantId, txn_id: params.txnId, amount: params.amount.toFixed(2) };
  const signature = sign(config.secretKey, fields, ["merchant_id", "txn_id", "amount"]);

  const res = await fetch(config.verificationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, signature }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Visa card verification failed with HTTP ${res.status}: ${body}`);
  }
  return res.json();
}
