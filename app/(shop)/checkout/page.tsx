"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { type AddressInput } from "@/schemas/checkout";
import { Button } from "@/components/ui/Button";
import { AddressForm } from "@/components/account/AddressForm";
import { formatPrice } from "@/lib/format";

interface SavedAddress extends AddressInput {
  id: number;
  isDefault: boolean;
  province: { name: string };
  district: { name: string };
  municipality: { name: string };
}

interface ShippingEstimate {
  shippingFee: number;
  shippingLabel: string | null;
  tax: number;
  taxLabel: string | null;
  total: number;
}

interface DealerOption {
  dealerId: number;
  dealerName: string;
  isPrimary: boolean;
  canFulfillOrder: boolean;
  stockStatus: "Available" | "Partial" | "Unavailable";
  shippingCharge: number;
}

interface DealerOptionsResponse {
  dealerSystemActive: boolean;
  primary: DealerOption | null;
  alternatives: DealerOption[];
  noneAvailable: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, selectedLines, selectedSubtotal, isLoading } = useCart();
  const subtotal = selectedSubtotal;
  const selectedItemsPayload = selectedLines.map((l) => ({ productId: Number(l.productId), variantId: l.variantId }));
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [newAddressLocation, setNewAddressLocation] = useState<{ municipalityId?: number; wardNo?: number }>({});

  const selectedSavedAddress = addresses.find((a) => a.id === selectedId);
  const municipalityId = showNewForm ? newAddressLocation.municipalityId ?? null : selectedSavedAddress?.municipalityId ?? null;
  const wardNo = showNewForm ? newAddressLocation.wardNo ?? null : selectedSavedAddress?.wardNo ?? null;

  const [dealerOptions, setDealerOptions] = useState<DealerOptionsResponse | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState<number | null>(null);
  const [isLoadingDealers, setIsLoadingDealers] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  useEffect(() => {
    fetch("/api/addresses")
      .then((res) => res.json())
      .then((json) => {
        const list: SavedAddress[] = json.data ?? [];
        setAddresses(list);
        if (list.length > 0) {
          setSelectedId(list.find((a) => a.isDefault)?.id ?? list[0].id);
        } else {
          setShowNewForm(true);
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsEstimating(true);
    fetch("/api/shipping-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "Nepal", subtotal, discount, municipalityId }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setShippingEstimate(json.data ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsEstimating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subtotal, discount, municipalityId]);

  useEffect(() => {
    if (!municipalityId) {
      setDealerOptions(null);
      setSelectedDealerId(null);
      return;
    }
    let cancelled = false;
    setIsLoadingDealers(true);
    const cityPayload = showNewForm
      ? { municipalityId, wardNo: wardNo ?? undefined, selectedItems: selectedItemsPayload }
      : selectedId
        ? { addressId: selectedId, selectedItems: selectedItemsPayload }
        : null;
    if (!cityPayload) {
      setIsLoadingDealers(false);
      return;
    }
    fetch("/api/checkout/dealer-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cityPayload),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const data: DealerOptionsResponse | null = json.data ?? null;
        setDealerOptions(data);
        if (data?.dealerSystemActive) {
          const preferred = data.primary?.canFulfillOrder
            ? data.primary
            : [data.primary, ...data.alternatives].find((o) => o?.canFulfillOrder);
          setSelectedDealerId(preferred?.dealerId ?? null);
        } else {
          setSelectedDealerId(null);
        }
      })
      .finally(() => !cancelled && setIsLoadingDealers(false));

    return () => {
      cancelled = true;
    };
  }, [municipalityId, wardNo, selectedId, showNewForm]);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError(null);
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, subtotal }),
    });
    const json = await res.json();
    setIsApplyingCoupon(false);
    if (!res.ok) {
      setCouponError(json.message ?? "Invalid coupon");
      setDiscount(0);
      setAppliedCode(null);
      return;
    }
    setDiscount(json.data.discount);
    setAppliedCode(json.data.code);
  }

  // A selected dealer's own delivery charge always overrides the flat municipality/zone estimate —
  // both in what's displayed here and in what's carried forward to payment, so the two never disagree.
  const chosenDealer = dealerOptions
    ? [dealerOptions.primary, ...dealerOptions.alternatives].find((o) => o?.dealerId === selectedDealerId)
    : null;
  const effectiveShippingFee = chosenDealer ? chosenDealer.shippingCharge : shippingEstimate?.shippingFee ?? 0;
  const effectiveShippingLabel = chosenDealer ? `${chosenDealer.dealerName} delivery` : shippingEstimate?.shippingLabel ?? null;
  const effectiveTax = shippingEstimate?.tax ?? 0;
  const effectiveTotal = Math.max(0, subtotal - discount) + effectiveShippingFee + effectiveTax;

  function proceedWithAddress(payload: { addressId?: number; address?: AddressInput; saveAddress?: boolean }) {
    if (dealerOptions?.dealerSystemActive && !selectedDealerId) {
      return;
    }
    sessionStorage.setItem(
      "bikesh-checkout-draft",
      JSON.stringify({
        ...payload,
        couponCode: appliedCode,
        discount,
        subtotal,
        shippingFee: effectiveShippingFee,
        shippingLabel: effectiveShippingLabel,
        tax: effectiveTax,
        taxLabel: shippingEstimate?.taxLabel ?? null,
        dealerId: selectedDealerId,
        selectedItems: selectedItemsPayload,
      })
    );
    router.push("/checkout/payment");
  }

  function onSubmitNewAddress(values: AddressInput) {
    proceedWithAddress({ address: values, saveAddress });
  }

  function continueWithSavedAddress() {
    if (!selectedId) return;
    proceedWithAddress({ addressId: selectedId });
  }

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500">Loading…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500">
        Your cart is empty. <a href="/shop" className="text-primary-600 underline">Go shopping</a>.
      </div>
    );
  }

  if (selectedLines.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500">
        No items are selected for checkout. <a href="/cart" className="text-primary-600 underline">Go back to your cart</a> and select what you&apos;d like to buy.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Checkout</h1>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
            <h2 className="text-sm font-semibold text-gray-900">Billing Address</h2>

            {addresses.length > 0 && !showNewForm && (
              <div className="mt-4 space-y-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors ${
                      selectedId === addr.id ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedId === addr.id}
                      onChange={() => setSelectedId(addr.id)}
                      className="mt-1 accent-primary-600"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{addr.fullName}</p>
                      <p className="text-gray-600">
                        {addr.line1}
                        {addr.landmark ? ` (near ${addr.landmark})` : ""}, {addr.municipality.name} — Ward {addr.wardNo},{" "}
                        {addr.district.name}, {addr.province.name}
                      </p>
                      <p className="text-gray-500">{addr.phone}</p>
                    </div>
                    {selectedId === addr.id && (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-primary-600" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setShowNewForm(true)}
                  className="text-sm font-medium text-primary-600 hover:underline"
                >
                  + Use a new address
                </button>
              </div>
            )}

            {showNewForm && (
              <div className="mt-4">
                <AddressForm
                  onSubmit={onSubmitNewAddress}
                  onCancel={addresses.length > 0 ? () => setShowNewForm(false) : undefined}
                  submitLabel="Continue to Payment"
                  onLocationChange={(loc) => setNewAddressLocation({ municipalityId: loc.municipalityId, wardNo: loc.wardNo })}
                  extraFooter={
                    <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
                      <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                      Save this address for next time
                    </label>
                  }
                />
              </div>
            )}

            {addresses.length > 0 && !showNewForm && (
              <Button
                className="mt-5 w-full"
                size="lg"
                onClick={continueWithSavedAddress}
                disabled={!selectedId || (dealerOptions?.dealerSystemActive && !selectedDealerId)}
              >
                Continue to Payment
              </Button>
            )}
          </section>
        </div>

        <div className="w-full shrink-0 self-start rounded-2xl border border-gray-200 bg-white p-6 shadow-soft lg:w-[30rem]">
          <h2 className="text-sm font-semibold text-gray-900">Order Summary</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
            {selectedLines.map((line) => (
              <li key={line.productId} className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1 truncate">{line.name} × {line.quantity}</span>
                <span className="shrink-0 whitespace-nowrap">{formatPrice(line.price * line.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <Button type="button" variant="outline" size="sm" isLoading={isApplyingCoupon} onClick={applyCoupon}>
              Apply
            </Button>
          </div>
          {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
          {appliedCode && <p className="mt-1 text-xs text-accent-700">Coupon &quot;{appliedCode}&quot; applied</p>}

          <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
            <div className="flex items-start justify-between gap-3 text-gray-600">
              <span>Subtotal</span>
              <span className="shrink-0 whitespace-nowrap">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-start justify-between gap-3 text-accent-700">
                <span>Discount</span>
                <span className="shrink-0 whitespace-nowrap">-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 text-gray-600">
              <span className="min-w-0">
                Shipping
                {effectiveShippingLabel && (
                  <span className="block truncate text-xs text-gray-400">{effectiveShippingLabel}</span>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap">
                {isEstimating || isLoadingDealers
                  ? "…"
                  : shippingEstimate || chosenDealer
                    ? effectiveShippingFee > 0
                      ? formatPrice(effectiveShippingFee)
                      : "Free"
                    : "—"}
              </span>
            </div>
            {effectiveTax > 0 && (
              <div className="flex items-start justify-between gap-3 text-gray-600">
                <span className="min-w-0 truncate">{shippingEstimate?.taxLabel ?? "Tax"}</span>
                <span className="shrink-0 whitespace-nowrap">{formatPrice(effectiveTax)}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 pt-1 text-base font-bold text-gray-900">
              <span>Total</span>
              <span className="shrink-0 whitespace-nowrap">{formatPrice(effectiveTotal)}</span>
            </div>
          </div>

          {municipalityId && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-gray-900">Buy Product From</h2>

              {isLoadingDealers ? (
                <p className="mt-3 text-sm text-gray-500">Checking dealer availability…</p>
              ) : !dealerOptions?.dealerSystemActive ? null : dealerOptions.noneAvailable ? (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  Sorry, this order cannot currently be fulfilled from the available dealers in your city. Try
                  reducing quantities, removing an unavailable product, or choosing a different address.
                </p>
              ) : (
                <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {[dealerOptions.primary, ...dealerOptions.alternatives]
                    .filter((o): o is DealerOption => o !== null)
                    .map((option) => (
                      <label
                        key={option.dealerId}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
                          option.canFulfillOrder ? "" : "cursor-not-allowed opacity-60"
                        } ${
                          selectedDealerId === option.dealerId
                            ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="dealer"
                          disabled={!option.canFulfillOrder}
                          checked={selectedDealerId === option.dealerId}
                          onChange={() => setSelectedDealerId(option.dealerId)}
                          className="mt-1 accent-primary-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">
                            {option.dealerName}
                            {option.isPrimary && <span className="ml-2 text-xs font-normal text-gray-400">Your area dealer</span>}
                          </p>
                          <p className="text-gray-500">
                            {option.stockStatus === "Available"
                              ? "Stock available"
                              : option.stockStatus === "Partial"
                                ? "Partial stock — cannot fulfill full order"
                                : "Unavailable"}
                            {" · "}Delivery: {formatPrice(option.shippingCharge)}
                          </p>
                        </div>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
