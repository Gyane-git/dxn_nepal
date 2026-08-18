"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface PaymentSettingsValues {
  codEnabled: boolean;
  codMinOrderAmount: string;
  codMaxOrderAmount: string;
  esewaEnabled: boolean;
  esewaLogo: string | null;
  esewaProductCode: string;
  esewaSecretKey: string;
  esewaPaymentUrl: string;
  esewaStatusUrl: string;
  khaltiEnabled: boolean;
  khaltiLogo: string | null;
  khaltiSecretKey: string;
  khaltiBaseUrl: string;
  fonepayEnabled: boolean;
  fonepayLogo: string | null;
  fonepayMerchantCode: string;
  fonepaySecretKey: string;
  fonepayCheckoutUrl: string;
  fonepayVerificationUrl: string;
  connectipsEnabled: boolean;
  connectipsLogo: string | null;
  connectipsMerchantId: string;
  connectipsAppId: string;
  connectipsAppName: string;
  connectipsPassword: string;
  connectipsPrivateKey: string;
  connectipsGatewayUrl: string;
  connectipsValidationUrl: string;
  visaEnabled: boolean;
  visaLogo: string | null;
  visaMerchantId: string;
  visaSecretKey: string;
  visaGatewayUrl: string;
  visaVerificationUrl: string;
}

const EMPTY: PaymentSettingsValues = {
  codEnabled: true,
  codMinOrderAmount: "",
  codMaxOrderAmount: "",
  esewaEnabled: true,
  esewaLogo: null,
  esewaProductCode: "",
  esewaSecretKey: "",
  esewaPaymentUrl: "",
  esewaStatusUrl: "",
  khaltiEnabled: false,
  khaltiLogo: null,
  khaltiSecretKey: "",
  khaltiBaseUrl: "",
  fonepayEnabled: false,
  fonepayLogo: null,
  fonepayMerchantCode: "",
  fonepaySecretKey: "",
  fonepayCheckoutUrl: "",
  fonepayVerificationUrl: "",
  connectipsEnabled: false,
  connectipsLogo: null,
  connectipsMerchantId: "",
  connectipsAppId: "",
  connectipsAppName: "",
  connectipsPassword: "",
  connectipsPrivateKey: "",
  connectipsGatewayUrl: "",
  connectipsValidationUrl: "",
  visaEnabled: false,
  visaLogo: null,
  visaMerchantId: "",
  visaSecretKey: "",
  visaGatewayUrl: "",
  visaVerificationUrl: "",
};

type SecretField =
  | "esewaSecretKey"
  | "khaltiSecretKey"
  | "fonepaySecretKey"
  | "connectipsPassword"
  | "connectipsPrivateKey"
  | "visaSecretKey";

export default function PaymentSettingsPage() {
  const [values, setValues] = useState<PaymentSettingsValues>(EMPTY);
  const [hasSecret, setHasSecret] = useState<Record<SecretField, boolean>>({
    esewaSecretKey: false,
    khaltiSecretKey: false,
    fonepaySecretKey: false,
    connectipsPassword: false,
    connectipsPrivateKey: false,
    visaSecretKey: false,
  });
  const [touched, setTouched] = useState<Record<SecretField, boolean>>({
    esewaSecretKey: false,
    khaltiSecretKey: false,
    fonepaySecretKey: false,
    connectipsPassword: false,
    connectipsPrivateKey: false,
    visaSecretKey: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/payment")
      .then((res) => res.json())
      .then((json) => {
        const s = json.data;
        setValues({
          codEnabled: s.codEnabled,
          codMinOrderAmount: s.codMinOrderAmount?.toString() ?? "",
          codMaxOrderAmount: s.codMaxOrderAmount?.toString() ?? "",
          esewaEnabled: s.esewaEnabled,
          esewaLogo: s.esewaLogo ?? null,
          esewaProductCode: s.esewaProductCode ?? "",
          esewaSecretKey: "",
          esewaPaymentUrl: s.esewaPaymentUrl ?? "",
          esewaStatusUrl: s.esewaStatusUrl ?? "",
          khaltiEnabled: s.khaltiEnabled,
          khaltiLogo: s.khaltiLogo ?? null,
          khaltiSecretKey: "",
          khaltiBaseUrl: s.khaltiBaseUrl ?? "",
          fonepayEnabled: s.fonepayEnabled,
          fonepayLogo: s.fonepayLogo ?? null,
          fonepayMerchantCode: s.fonepayMerchantCode ?? "",
          fonepaySecretKey: "",
          fonepayCheckoutUrl: s.fonepayCheckoutUrl ?? "",
          fonepayVerificationUrl: s.fonepayVerificationUrl ?? "",
          connectipsEnabled: s.connectipsEnabled,
          connectipsLogo: s.connectipsLogo ?? null,
          connectipsMerchantId: s.connectipsMerchantId ?? "",
          connectipsAppId: s.connectipsAppId ?? "",
          connectipsAppName: s.connectipsAppName ?? "",
          connectipsPassword: "",
          connectipsPrivateKey: "",
          connectipsGatewayUrl: s.connectipsGatewayUrl ?? "",
          connectipsValidationUrl: s.connectipsValidationUrl ?? "",
          visaEnabled: s.visaEnabled,
          visaLogo: s.visaLogo ?? null,
          visaMerchantId: s.visaMerchantId ?? "",
          visaSecretKey: "",
          visaGatewayUrl: s.visaGatewayUrl ?? "",
          visaVerificationUrl: s.visaVerificationUrl ?? "",
        });
        setHasSecret({
          esewaSecretKey: s.hasEsewaSecretKey,
          khaltiSecretKey: s.hasKhaltiSecretKey,
          fonepaySecretKey: s.hasFonepaySecretKey,
          connectipsPassword: s.hasConnectipsPassword,
          connectipsPrivateKey: s.hasConnectipsPrivateKey,
          visaSecretKey: s.hasVisaSecretKey,
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  function set<K extends keyof PaymentSettingsValues>(key: K, value: PaymentSettingsValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setSecret(field: SecretField, value: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    set(field, value);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);
    const secret = (field: SecretField) => (touched[field] ? values[field] : undefined);
    const res = await fetch("/api/admin/settings/payment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codEnabled: values.codEnabled,
        codMinOrderAmount: values.codMinOrderAmount.trim() === "" ? null : Number(values.codMinOrderAmount),
        codMaxOrderAmount: values.codMaxOrderAmount.trim() === "" ? null : Number(values.codMaxOrderAmount),
        esewaEnabled: values.esewaEnabled,
        esewaLogo: values.esewaLogo,
        esewaProductCode: values.esewaProductCode || null,
        esewaPaymentUrl: values.esewaPaymentUrl || null,
        esewaStatusUrl: values.esewaStatusUrl || null,
        esewaSecretKey: secret("esewaSecretKey"),
        khaltiEnabled: values.khaltiEnabled,
        khaltiLogo: values.khaltiLogo,
        khaltiBaseUrl: values.khaltiBaseUrl || null,
        khaltiSecretKey: secret("khaltiSecretKey"),
        fonepayEnabled: values.fonepayEnabled,
        fonepayLogo: values.fonepayLogo,
        fonepayMerchantCode: values.fonepayMerchantCode || null,
        fonepayCheckoutUrl: values.fonepayCheckoutUrl || null,
        fonepayVerificationUrl: values.fonepayVerificationUrl || null,
        fonepaySecretKey: secret("fonepaySecretKey"),
        connectipsEnabled: values.connectipsEnabled,
        connectipsLogo: values.connectipsLogo,
        connectipsMerchantId: values.connectipsMerchantId || null,
        connectipsAppId: values.connectipsAppId || null,
        connectipsAppName: values.connectipsAppName || null,
        connectipsGatewayUrl: values.connectipsGatewayUrl || null,
        connectipsValidationUrl: values.connectipsValidationUrl || null,
        connectipsPassword: secret("connectipsPassword"),
        connectipsPrivateKey: secret("connectipsPrivateKey"),
        visaEnabled: values.visaEnabled,
        visaLogo: values.visaLogo,
        visaMerchantId: values.visaMerchantId || null,
        visaGatewayUrl: values.visaGatewayUrl || null,
        visaVerificationUrl: values.visaVerificationUrl || null,
        visaSecretKey: secret("visaSecretKey"),
      }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message);
      return;
    }
    setHasSecret({
      esewaSecretKey: json.data.hasEsewaSecretKey,
      khaltiSecretKey: json.data.hasKhaltiSecretKey,
      fonepaySecretKey: json.data.hasFonepaySecretKey,
      connectipsPassword: json.data.hasConnectipsPassword,
      connectipsPrivateKey: json.data.hasConnectipsPrivateKey,
      visaSecretKey: json.data.hasVisaSecretKey,
    });
    setTouched({
      esewaSecretKey: false,
      khaltiSecretKey: false,
      fonepaySecretKey: false,
      connectipsPassword: false,
      connectipsPrivateKey: false,
      visaSecretKey: false,
    });
    setValues((v) => ({
      ...v,
      esewaSecretKey: "",
      khaltiSecretKey: "",
      fonepaySecretKey: "",
      connectipsPassword: "",
      connectipsPrivateKey: "",
      visaSecretKey: "",
    }));
    setMessage("Payment settings saved");
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;

  function secretLabel(field: SecretField, label: string) {
    return `${label}${hasSecret[field] && !touched[field] ? " (saved)" : ""}`;
  }

  function secretPlaceholder(field: SecretField) {
    return hasSecret[field] ? "Leave blank to keep existing value" : "";
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Payment Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Control which payment methods customers can use at checkout. Leave eSewa credentials blank to use the sandbox defaults —
        Khalti, Fonepay, connectIPS, and Visa Card have no shared sandbox credentials, so register for a test/dev account with
        each provider and paste your own credentials below before enabling them.
      </p>

      <form onSubmit={handleSave} className="mt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash on Delivery</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.codEnabled} onChange={(e) => set("codEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Enable Cash on Delivery
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Minimum order amount"
              type="number"
              value={values.codMinOrderAmount}
              onChange={(e) => set("codMinOrderAmount", e.target.value)}
              placeholder="No minimum"
            />
            <Input
              label="Maximum order amount"
              type="number"
              value={values.codMaxOrderAmount}
              onChange={(e) => set("codMaxOrderAmount", e.target.value)}
              placeholder="No maximum"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            {values.esewaLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.esewaLogo} alt="eSewa" className="h-7 w-auto max-w-[72px] shrink-0 rounded object-contain" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#60BB46] text-xs font-bold text-white">
                e
              </span>
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">eSewa</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.esewaEnabled} onChange={(e) => set("esewaEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Enable eSewa online payment
          </label>
          <ImageUpload
            label="Gateway logo (shown at checkout)"
            value={values.esewaLogo}
            onChange={(url) => set("esewaLogo", url)}
            folder="payment"
            size="lg"
            fit="contain"
          />
          <Input label="Product code" value={values.esewaProductCode} onChange={(e) => set("esewaProductCode", e.target.value)} placeholder="EPAYTEST" />
          <Input
            label={secretLabel("esewaSecretKey", "Secret key")}
            type="password"
            value={values.esewaSecretKey}
            onChange={(e) => setSecret("esewaSecretKey", e.target.value)}
            placeholder={secretPlaceholder("esewaSecretKey")}
          />
          <Input label="Payment URL" value={values.esewaPaymentUrl} onChange={(e) => set("esewaPaymentUrl", e.target.value)} placeholder="https://rc-epay.esewa.com.np/api/epay/main/v2/form" />
          <Input label="Status check URL" value={values.esewaStatusUrl} onChange={(e) => set("esewaStatusUrl", e.target.value)} placeholder="https://rc.esewa.com.np/api/epay/transaction/status/" />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            {values.khaltiLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.khaltiLogo} alt="Khalti" className="h-7 w-auto max-w-[72px] shrink-0 rounded object-contain" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5C2D91] text-xs font-bold text-white">
                K
              </span>
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Khalti</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.khaltiEnabled} onChange={(e) => set("khaltiEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Enable Khalti online payment
          </label>
          <ImageUpload
            label="Gateway logo (shown at checkout)"
            value={values.khaltiLogo}
            onChange={(url) => set("khaltiLogo", url)}
            folder="payment"
            size="lg"
            fit="contain"
          />
          <Input
            label={secretLabel("khaltiSecretKey", "Secret key")}
            type="password"
            value={values.khaltiSecretKey}
            onChange={(e) => setSecret("khaltiSecretKey", e.target.value)}
            placeholder={secretPlaceholder("khaltiSecretKey")}
          />
          <Input
            label="API base URL"
            value={values.khaltiBaseUrl}
            onChange={(e) => set("khaltiBaseUrl", e.target.value)}
            placeholder="https://dev.khalti.com (sandbox) or https://khalti.com (live)"
          />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            {values.fonepayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.fonepayLogo} alt="Fonepay" className="h-7 w-auto max-w-[72px] shrink-0 rounded object-contain" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EE3124] text-xs font-bold text-white">
                F
              </span>
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fonepay</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.fonepayEnabled} onChange={(e) => set("fonepayEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Enable Fonepay online payment (also covers card payments via Fonepay&apos;s hosted page)
          </label>
          <ImageUpload
            label="Gateway logo (shown at checkout)"
            value={values.fonepayLogo}
            onChange={(url) => set("fonepayLogo", url)}
            folder="payment"
            size="lg"
            fit="contain"
          />
          <Input label="Merchant code (PID)" value={values.fonepayMerchantCode} onChange={(e) => set("fonepayMerchantCode", e.target.value)} />
          <Input
            label={secretLabel("fonepaySecretKey", "Secret key")}
            type="password"
            value={values.fonepaySecretKey}
            onChange={(e) => setSecret("fonepaySecretKey", e.target.value)}
            placeholder={secretPlaceholder("fonepaySecretKey")}
          />
          <Input
            label="Checkout URL"
            value={values.fonepayCheckoutUrl}
            onChange={(e) => set("fonepayCheckoutUrl", e.target.value)}
            placeholder="https://dev-clientapi.fonepay.com/api/merchantRequest"
          />
          <Input
            label="Verification URL"
            value={values.fonepayVerificationUrl}
            onChange={(e) => set("fonepayVerificationUrl", e.target.value)}
            placeholder="https://dev-clientapi.fonepay.com/api/merchantRequest/verificationMerchant"
          />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            {values.connectipsLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.connectipsLogo} alt="connectIPS" className="h-7 w-auto max-w-[72px] shrink-0 rounded object-contain" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#004B87] text-xs font-bold text-white">
                C
              </span>
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">connectIPS</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.connectipsEnabled} onChange={(e) => set("connectipsEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Enable connectIPS online payment (also covers card payments via connectIPS&apos;s hosted page)
          </label>
          <ImageUpload
            label="Gateway logo (shown at checkout)"
            value={values.connectipsLogo}
            onChange={(url) => set("connectipsLogo", url)}
            folder="payment"
            size="lg"
            fit="contain"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Merchant ID" value={values.connectipsMerchantId} onChange={(e) => set("connectipsMerchantId", e.target.value)} />
            <Input label="App ID" value={values.connectipsAppId} onChange={(e) => set("connectipsAppId", e.target.value)} placeholder="MER-XXX-APP-1" />
          </div>
          <Input label="App name" value={values.connectipsAppName} onChange={(e) => set("connectipsAppName", e.target.value)} />
          <Input
            label={secretLabel("connectipsPassword", "API password")}
            type="password"
            value={values.connectipsPassword}
            onChange={(e) => setSecret("connectipsPassword", e.target.value)}
            placeholder={secretPlaceholder("connectipsPassword")}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {secretLabel("connectipsPrivateKey", "Merchant private key (PEM)")}
            </label>
            <textarea
              rows={5}
              value={values.connectipsPrivateKey}
              onChange={(e) => setSecret("connectipsPrivateKey", e.target.value)}
              placeholder={
                hasSecret.connectipsPrivateKey
                  ? "Leave blank to keep existing key"
                  : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
              }
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-mono text-xs text-gray-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <p className="text-xs text-gray-400">
              connectIPS issues a merchant certificate (.pfx) — convert it to a PEM private key first, e.g.{" "}
              <code>openssl pkcs12 -in cert.pfx -nocerts -nodes -out key.pem</code>.
            </p>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            connectIPS redirects back to a fixed success/failure URL registered with NCHL when you onboard, not one
            passed per-request — register <code>{"{your domain}"}/checkout/connectips/return</code> as both the
            success and failure URL.
          </p>
          <Input
            label="Gateway (login page) URL"
            value={values.connectipsGatewayUrl}
            onChange={(e) => set("connectipsGatewayUrl", e.target.value)}
            placeholder="https://uat.connectips.com/connectipswebgw/loginpage"
          />
          <Input
            label="Validation URL"
            value={values.connectipsValidationUrl}
            onChange={(e) => set("connectipsValidationUrl", e.target.value)}
            placeholder="https://uat.connectips.com/connectipswebws/api/creditor/validatetxn"
          />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            {values.visaLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.visaLogo} alt="Visa Card" className="h-7 w-auto max-w-[72px] shrink-0 rounded object-contain" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A1F71] text-xs font-bold text-white">
                V
              </span>
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visa Card</h2>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Card acceptance isn&apos;t bank-specific — once you integrate with any Nepal Rastra Bank &quot;A&quot;-class
            commercial bank&apos;s Electronic Payment Gateway as your acquirer, it accepts Visa cards issued by any
            bank. No acquirer publishes public API docs, so the fields below are a provisional scaffold (see{" "}
            <code>lib/visa.ts</code>) — replace the signing logic once you have your real integration kit from
            whichever bank you sign up with.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.visaEnabled} onChange={(e) => set("visaEnabled", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Enable Visa card payment
          </label>
          <ImageUpload
            label="Gateway logo (shown at checkout)"
            value={values.visaLogo}
            onChange={(url) => set("visaLogo", url)}
            folder="payment"
            size="lg"
            fit="contain"
          />
          <Input label="Merchant ID (API code)" value={values.visaMerchantId} onChange={(e) => set("visaMerchantId", e.target.value)} />
          <Input
            label={secretLabel("visaSecretKey", "Secret key")}
            type="password"
            value={values.visaSecretKey}
            onChange={(e) => setSecret("visaSecretKey", e.target.value)}
            placeholder={secretPlaceholder("visaSecretKey")}
          />
          <Input
            label="Gateway (checkout page) URL"
            value={values.visaGatewayUrl}
            onChange={(e) => set("visaGatewayUrl", e.target.value)}
            placeholder="Provided by your acquiring bank's IT team"
          />
          <Input
            label="Verification URL"
            value={values.visaVerificationUrl}
            onChange={(e) => set("visaVerificationUrl", e.target.value)}
            placeholder="Provided by your acquiring bank's IT team"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}

        <Button type="submit" variant="admin" isLoading={isSaving} className="self-start">
          Save settings
        </Button>
      </form>
    </div>
  );
}
