import { createSign } from "crypto";

/**
 * connectIPS (NCHL) merchant integration. Requires a merchant certificate (issued by
 * NCHL, typically as a .pfx) — its private key must be supplied here in PEM format
 * (convert with `openssl pkcs12 -in cert.pfx -nocerts -nodes -out key.pem`). No
 * publicly shared sandbox credentials exist; disabled by default until configured
 * via the admin dashboard's Payment Settings (which take precedence — see
 * `resolveConnectipsConfig`).
 *
 * The token-signing scheme (SHA-256 digest, RSA-signed, base64-encoded) and the
 * checkout form fields are documented by NCHL. The transaction date format and
 * whether TXNAMT is paisa or rupees are best-effort reconstructions from public/
 * community documentation — double check both against your NCHL onboarding docs
 * once you have real credentials.
 */
export interface ConnectipsConfig {
  merchantId: string;
  appId: string;
  appName: string;
  password: string;
  privateKeyPem: string;
  gatewayUrl: string;
  validationUrl: string;
}

const envDefaults: ConnectipsConfig = {
  merchantId: process.env.CONNECTIPS_MERCHANT_ID || "",
  appId: process.env.CONNECTIPS_APP_ID || "",
  appName: process.env.CONNECTIPS_APP_NAME || "",
  password: process.env.CONNECTIPS_PASSWORD || "",
  privateKeyPem: process.env.CONNECTIPS_PRIVATE_KEY || "",
  gatewayUrl: process.env.CONNECTIPS_GATEWAY_URL || "https://uat.connectips.com/connectipswebgw/loginpage",
  validationUrl:
    process.env.CONNECTIPS_VALIDATION_URL || "https://uat.connectips.com/connectipswebws/api/creditor/validatetxn",
};

/** Merges admin-configured Payment Settings over the env-var/sandbox defaults. */
export function resolveConnectipsConfig(overrides?: {
  connectipsMerchantId?: string | null;
  connectipsAppId?: string | null;
  connectipsAppName?: string | null;
  connectipsPassword?: string | null;
  connectipsPrivateKey?: string | null;
  connectipsGatewayUrl?: string | null;
  connectipsValidationUrl?: string | null;
}): ConnectipsConfig {
  return {
    merchantId: overrides?.connectipsMerchantId || envDefaults.merchantId,
    appId: overrides?.connectipsAppId || envDefaults.appId,
    appName: overrides?.connectipsAppName || envDefaults.appName,
    password: overrides?.connectipsPassword || envDefaults.password,
    privateKeyPem: overrides?.connectipsPrivateKey || envDefaults.privateKeyPem,
    gatewayUrl: overrides?.connectipsGatewayUrl || envDefaults.gatewayUrl,
    validationUrl: overrides?.connectipsValidationUrl || envDefaults.validationUrl,
  };
}

/** SHA-256 digest of `message`, RSA-signed with the merchant's private key, base64-encoded. */
export function signConnectipsToken(message: string, privateKeyPem: string): string {
  return createSign("RSA-SHA256").update(message).sign(privateKeyPem, "base64");
}

/** dd-mm-yyyy — best-effort; verify against your NCHL onboarding docs. */
function formatConnectipsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export interface ConnectipsFormFields {
  MERCHANTID: string;
  APPID: string;
  APPNAME: string;
  TXNID: string;
  TXNDATE: string;
  TXNCRNCY: string;
  TXNAMT: string;
  REFERENCEID: string;
  REMARKS: string;
  PARTICULARS: string;
  TOKEN: string;
}

/** Builds the signed form fields to auto-submit (POST) to `config.gatewayUrl`. */
export function buildConnectipsFormFields(
  params: { txnId: string; amount: number; remarks: string; particulars: string },
  config: ConnectipsConfig
): ConnectipsFormFields {
  const txnDate = formatConnectipsDate(new Date());
  const txnCrncy = "NPR";
  // Best-effort: paisa, matching the convention used elsewhere in this codebase (eSewa/Khalti amounts).
  const txnAmt = Math.round(params.amount * 100).toString();

  const message =
    `MERCHANTID=${config.merchantId},APPID=${config.appId},APPNAME=${config.appName},` +
    `TXNID=${params.txnId},TXNDATE=${txnDate},TXNCRNCY=${txnCrncy},TXNAMT=${txnAmt},` +
    `REFERENCEID=${params.txnId},REMARKS=${params.remarks},PARTICULARS=${params.particulars},TOKEN=TOKEN`;

  return {
    MERCHANTID: config.merchantId,
    APPID: config.appId,
    APPNAME: config.appName,
    TXNID: params.txnId,
    TXNDATE: txnDate,
    TXNCRNCY: txnCrncy,
    TXNAMT: txnAmt,
    REFERENCEID: params.txnId,
    REMARKS: params.remarks,
    PARTICULARS: params.particulars,
    TOKEN: signConnectipsToken(message, config.privateKeyPem),
  };
}

export interface ConnectipsValidationResult {
  status: string;
  statusDesc: string;
}

/**
 * The authoritative server-to-server check — never trust the bare TXNID connectIPS
 * appends to the return URL as proof of payment.
 */
export async function verifyConnectipsPayment(
  params: { txnId: string; amount: number },
  config: ConnectipsConfig
): Promise<ConnectipsValidationResult> {
  const txnAmt = Math.round(params.amount * 100).toString();
  const message = `MERCHANTID=${config.merchantId},APPID=${config.appId},REFERENCEID=${params.txnId},TXNAMT=${txnAmt}`;
  const token = signConnectipsToken(message, config.privateKeyPem);

  const res = await fetch(config.validationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${config.appId}:${config.password}`).toString("base64")}`,
    },
    body: JSON.stringify({
      merchantId: config.merchantId,
      appId: config.appId,
      referenceId: params.txnId,
      txnAmt,
      token,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`connectIPS validation failed with HTTP ${res.status}: ${body}`);
  }
  return res.json();
}
