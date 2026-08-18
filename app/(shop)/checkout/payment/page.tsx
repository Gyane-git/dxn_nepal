"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";

interface CheckoutDraft {
  addressId?: string;
  address?: Record<string, string>;
  saveAddress?: boolean;
  couponCode?: string | null;
  discount?: number;
  subtotal?: number;
  shippingFee?: number;
  shippingLabel?: string | null;
  tax?: number;
  taxLabel?: string | null;
}

const DRAFT_KEY = "bikesh-checkout-draft";

type PaymentMethodKey = "COD" | "ESEWA" | "KHALTI" | "FONEPAY" | "CONNECTIPS" | "VISA";

interface PaymentMethodsInfo {
  codEnabled: boolean;
  esewaEnabled: boolean;
  esewaLogo: string | null;
  khaltiEnabled: boolean;
  khaltiLogo: string | null;
  fonepayEnabled: boolean;
  fonepayLogo: string | null;
  connectipsEnabled: boolean;
  connectipsLogo: string | null;
  visaEnabled: boolean;
  visaLogo: string | null;
}

/** Auto-submits a hidden POST form — used by gateways (eSewa, connectIPS) that require a signed form POST. */
function redirectViaForm(formUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = formUrl;
  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Redirects the browser to a fully-formed URL — used by gateways (Khalti, Fonepay) that hand back a ready payment link. */
function redirectViaUrl(url: string) {
  window.location.href = url;
}

const METHOD_LABELS: Record<
  Exclude<PaymentMethodKey, "COD">,
  { name: string; tagline: string; badge: string; badgeColor: string }
> = {
  ESEWA: {
    name: "eSewa",
    tagline: "Nepal's trusted digital wallet",
    badge: "e",
    badgeColor: "#60BB46",
  },
  KHALTI: {
    name: "Khalti",
    tagline: "Pay securely with your Khalti wallet",
    badge: "K",
    badgeColor: "#5C2D91",
  },
  FONEPAY: {
    name: "Fonepay",
    tagline: "Mobile banking, wallet, or card via Fonepay",
    badge: "F",
    badgeColor: "#EE3124",
  },
  CONNECTIPS: {
    name: "connectIPS",
    tagline: "Bank transfer or card via connectIPS",
    badge: "C",
    badgeColor: "#004B87",
  },
  VISA: {
    name: "Visa Card",
    tagline: "Pay with any Visa card issued by a Nepali bank",
    badge: "V",
    badgeColor: "#1A1F71",
  },
};

export default function PaymentPage() {
  const router = useRouter();
  const { clear } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [method, setMethod] = useState<PaymentMethodKey>("COD");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [methods, setMethods] = useState<PaymentMethodsInfo | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        router.replace("/checkout");
        return;
      }
      setDraft(JSON.parse(raw));
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    fetch("/api/payment-methods")
      .then((res) => res.json())
      .then((json) => setMethods(json.data ?? null));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (methods && !methods.codEnabled && methods.esewaEnabled)
        setMethod("ESEWA");
    }, 0);
    return () => clearTimeout(timer);
  }, [methods]);

  async function handlePlaceOrder() {
    if (!draft) return;
    setIsPaying(true);
    setError(null);

    const payload = {
      addressId: draft.addressId,
      address: draft.address,
      saveAddress: draft.saveAddress,
      couponCode: draft.couponCode,
    };

    if (method === "COD") {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, paymentMethod: "COD" }),
      });
      const json = await res.json();
      setIsPaying(false);

      if (!res.ok) {
        setError(json.message ?? "Something went wrong");
        return;
      }

      sessionStorage.removeItem(DRAFT_KEY);
      await clear();
      router.push(`/order/success/${json.data.orderNumber}`);
      return;
    }

    // Online gateways: get a redirect payload, then send the browser to the gateway's hosted page.
    // The draft stays in sessionStorage — the gateway's /checkout/<gateway>/return page needs it.
    const initiatePath =
      method === "ESEWA"
        ? "/api/checkout/esewa/initiate"
        : method === "KHALTI"
          ? "/api/checkout/khalti/initiate"
          : method === "FONEPAY"
            ? "/api/checkout/fonepay/initiate"
            : method === "CONNECTIPS"
              ? "/api/checkout/connectips/initiate"
              : "/api/checkout/visa/initiate";

    const res = await fetch(initiatePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok) {
      setIsPaying(false);
      setError(json.message ?? "Something went wrong");
      return;
    }

    if (method === "ESEWA" || method === "CONNECTIPS" || method === "VISA") {
      redirectViaForm(json.data.formUrl, json.data.fields);
    } else {
      redirectViaUrl(json.data.redirectUrl);
    }
  }

  if (!draft) return null;

  const subtotal = draft.subtotal ?? 0;
  const discount = draft.discount ?? 0;
  const shippingFee = draft.shippingFee ?? 0;
  const tax = draft.tax ?? 0;
  const total = Math.max(0, subtotal - discount) + shippingFee + tax;

  const onlineMethods = (
    ["ESEWA", "KHALTI", "FONEPAY", "CONNECTIPS", "VISA"] as const
  ).filter((key) => {
    if (key === "ESEWA") return methods?.esewaEnabled ?? true;
    if (key === "KHALTI") return methods?.khaltiEnabled ?? false;
    if (key === "FONEPAY") return methods?.fonepayEnabled ?? false;
    if (key === "CONNECTIPS") return methods?.connectipsEnabled ?? false;
    return methods?.visaEnabled ?? false;
  });

  function logoFor(key: Exclude<PaymentMethodKey, "COD">): string | null {
    if (key === "ESEWA") return methods?.esewaLogo ?? null;
    if (key === "KHALTI") return methods?.khaltiLogo ?? null;
    if (key === "FONEPAY") return methods?.fonepayLogo ?? null;
    if (key === "CONNECTIPS") return methods?.connectipsLogo ?? null;
    return methods?.visaLogo ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        Payment
      </h1>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex items-start justify-between gap-3">
            <span>Subtotal</span>
            <span className="shrink-0 whitespace-nowrap">
              {formatPrice(subtotal)}
            </span>
          </div>
          {discount > 0 && (
            <div className="flex items-start justify-between gap-3 text-accent-700">
              <span>Discount</span>
              <span className="shrink-0 whitespace-nowrap">
                -{formatPrice(discount)}
              </span>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              Shipping
              {draft.shippingLabel && (
                <span className="block truncate text-xs text-gray-400">
                  {draft.shippingLabel}
                </span>
              )}
            </span>
            <span className="shrink-0 whitespace-nowrap">
              {shippingFee > 0 ? formatPrice(shippingFee) : "Free"}
            </span>
          </div>
          {tax > 0 && (
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate">
                {draft.taxLabel ?? "Tax"}
              </span>
              <span className="shrink-0 whitespace-nowrap">
                {formatPrice(tax)}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-gray-100 pt-3 text-lg font-bold text-gray-900">
          <span>Total to pay</span>
          <span className="shrink-0 whitespace-nowrap">
            {formatPrice(total)}
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {(methods?.codEnabled ?? true) && (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition-colors ${
                method === "COD"
                  ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                checked={method === "COD"}
                onChange={() => setMethod("COD")}
                className="accent-primary-600"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Cash on Delivery</p>
                <p className="text-gray-500">
                  Pay in cash when your order arrives
                </p>
              </div>
              {method === "COD" && (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </label>
          )}

          {onlineMethods.map((key) => {
            const info = METHOD_LABELS[key];
            const logo = logoFor(key);
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition-colors ${
                  method === key
                    ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  checked={method === key}
                  onChange={() => setMethod(key)}
                  className="accent-primary-600"
                />
                <div className="flex flex-1 items-center gap-3">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt={info.name}
                      className="h-10 w-20 max-w-[96px] shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: info.badgeColor }}
                    >
                      {info.badge}
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      Pay with{" "}
                      <span className="text-accent-700">{info.name}</span>
                    </p>
                    <p className="text-gray-500">{info.tagline}</p>
                  </div>
                </div>
                {method === key && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </label>
            );
          })}

          {method !== "COD" && (
            <p className="ml-8 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
              You&apos;ll be redirected to {METHOD_LABELS[method].name} to
              complete your payment securely, then brought back here
              automatically.
            </p>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <Button
          className="mt-6 w-full"
          size="lg"
          isLoading={isPaying}
          onClick={handlePlaceOrder}
        >
          {method === "COD"
            ? "Place Order"
            : `Pay with ${METHOD_LABELS[method].name} — ${formatPrice(total)}`}
        </Button>
      </div>
    </div>
  );
}
