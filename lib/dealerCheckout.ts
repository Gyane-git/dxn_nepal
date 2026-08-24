import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/session";
import { notify } from "@/lib/notify";
import { getDealerOptions, verifyDealerCanFulfill, type CartLine } from "@/lib/dealerSelection";
import { computeShippingAndTax, type ShippingSnapshot } from "@/lib/checkoutCore";

export interface ResolvedDealer {
  id: number;
  name: string;
  phone: string | null;
}

export interface DealerAwareShippingResult {
  shippingFee: number;
  shippingLabel: string | null;
  tax: number;
  taxLabel: string | null;
  total: number;
  dealer: ResolvedDealer | null;
}

/**
 * Resolves dealer routing + the resulting shipping fee/total for checkout — shared by every
 * payment method (COD and every online gateway's initiate AND complete step) so the
 * dealer-required rule, the shipping-fee override, and the total charged are computed
 * identically everywhere. A gateway's `initiate` and `complete` steps call this with the same
 * inputs so the amount actually charged always matches the amount verified.
 *
 * Falls back untouched to the pre-dealer municipality/zone shipping flow (`dealer: null`) when
 * no dealer exists anywhere in the system yet, or none serve this city — see
 * lib/dealerSelection.ts's `dealerSystemActive` flag. Throws ApiError when a dealer is required
 * but missing, invalid, or can no longer fulfill the order, so every call site fails the same way.
 */
export async function computeShippingTaxAndDealer(
  shipping: ShippingSnapshot,
  subtotal: number,
  discount: number,
  cart: { items: CartLine[] },
  dealerId: number | null | undefined
): Promise<DealerAwareShippingResult> {
  const base = await computeShippingAndTax(shipping.country, subtotal, discount, shipping.municipalityId);

  const lines = cart.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }));
  const dealerOptions = await getDealerOptions(shipping.municipalityId, lines, shipping.wardNo);

  if (!dealerOptions.dealerSystemActive) {
    return { ...base, dealer: null };
  }

  const chosenId = Number(dealerId);
  if (!chosenId) throw new ApiError(400, "Please select a dealer to fulfill your order");

  const chosen = [dealerOptions.primary, ...dealerOptions.alternatives].find((o) => o?.dealerId === chosenId);
  if (!chosen) throw new ApiError(400, "The selected dealer is not available for your address");

  const stillFulfillable = await verifyDealerCanFulfill(chosenId, lines);
  if (!stillFulfillable) {
    throw new ApiError(409, "The selected dealer can no longer fulfill this order. Please choose another dealer.");
  }

  const dealerRecord = await prisma.dealer.findUnique({ where: { id: chosenId } });
  if (!dealerRecord || dealerRecord.status !== "ACTIVE") throw new ApiError(400, "The selected dealer is unavailable");

  const taxableAmount = Math.max(0, subtotal - discount);
  const shippingFee = chosen.shippingCharge;

  return {
    shippingFee,
    shippingLabel: `${dealerRecord.name} delivery`,
    tax: base.tax,
    taxLabel: base.taxLabel,
    total: taxableAmount + shippingFee + base.tax,
    dealer: { id: dealerRecord.id, name: dealerRecord.name, phone: dealerRecord.phone },
  };
}

/** Notifies the dealer's underlying account (if it has one — a standalone dealer has no account to notify). Best-effort, mirrors the customer's own order-placed notification. */
export async function notifyDealerOfOrder(dealerId: number, orderNumber: string) {
  const dealerUser = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { userId: true } });
  if (dealerUser?.userId) {
    await notify(dealerUser.userId, `Order ${orderNumber} has been assigned to you for fulfillment.`, { type: "order" });
  }
}
