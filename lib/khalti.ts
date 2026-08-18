/**
 * Khalti ePayment API v2 integration. Unlike eSewa, Khalti has no publicly shared
 * sandbox secret key — each merchant registers for their own test/dev account and
 * pastes the resulting secret key into the admin dashboard's Payment Settings
 * (which take precedence — see `resolveKhaltiConfig`). Disabled by default until
 * a secret key is configured. Docs: https://docs.khalti.com/khalti-epayment/
 */
export interface KhaltiConfig {
  secretKey: string;
  baseUrl: string;
}

const envDefaults: KhaltiConfig = {
  secretKey: process.env.KHALTI_SECRET_KEY || "",
  baseUrl: process.env.KHALTI_BASE_URL || "https://dev.khalti.com",
};

/** Merges admin-configured Payment Settings over the env-var/sandbox defaults. */
export function resolveKhaltiConfig(overrides?: {
  khaltiSecretKey?: string | null;
  khaltiBaseUrl?: string | null;
}): KhaltiConfig {
  return {
    secretKey: overrides?.khaltiSecretKey || envDefaults.secretKey,
    baseUrl: overrides?.khaltiBaseUrl || envDefaults.baseUrl,
  };
}

export interface KhaltiInitiateResult {
  pidx: string;
  payment_url: string;
  expires_at: string;
  expires_in: number;
}

/**
 * Khalti's initiate step is a server-to-server call (unlike eSewa/Fonepay/ConnectIPS,
 * where the merchant builds the redirect locally) — it returns a ready-made payment_url
 * to send the browser to.
 */
export async function initiateKhaltiPayment(
  params: {
    amount: number; // in paisa (1 NPR = 100 paisa), integer
    purchaseOrderId: string;
    purchaseOrderName: string;
    returnUrl: string;
    websiteUrl: string;
  },
  config: KhaltiConfig
): Promise<KhaltiInitiateResult> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/v2/epayment/initiate/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${config.secretKey}`,
    },
    body: JSON.stringify({
      return_url: params.returnUrl,
      website_url: params.websiteUrl,
      amount: Math.round(params.amount),
      purchase_order_id: params.purchaseOrderId,
      purchase_order_name: params.purchaseOrderName,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Khalti initiate failed with HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

export type KhaltiPaymentStatus =
  | "Completed"
  | "Pending"
  | "Initiated"
  | "Refunded"
  | "Partially Refunded"
  | "Expired"
  | "User canceled";

export interface KhaltiLookupResult {
  pidx: string;
  total_amount: number; // paisa
  status: KhaltiPaymentStatus;
  transaction_id: string | null;
  fee: number;
  refunded: boolean;
}

/** The authoritative server-to-server check — never trust the `status` query param Khalti appends to return_url. */
export async function lookupKhaltiPayment(pidx: string, config: KhaltiConfig): Promise<KhaltiLookupResult> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/v2/epayment/lookup/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${config.secretKey}`,
    },
    body: JSON.stringify({ pidx }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Khalti lookup failed with HTTP ${res.status}: ${body}`);
  }
  return res.json();
}
