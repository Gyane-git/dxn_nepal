import { requireUser } from "@/lib/session";
import { fail, handleApiError, ok } from "@/lib/api";
import { generateOrderNumber } from "@/lib/orderNumber";
import { buildFonepayRedirectUrl, resolveFonepayConfig } from "@/lib/fonepay";
import {
  applyCoupon,
  computeSubtotal,
  computeShippingAndTax,
  loadValidatedCart,
  resolveCartPricing,
  resolveShippingAddress,
} from "@/lib/checkoutCore";
import { getPaymentSettings } from "@/lib/settings";

/**
 * Builds a signed Fonepay checkout redirect URL. Nothing is written to Order/stock/
 * cart here — that only happens once /api/checkout/fonepay/complete confirms the
 * payment via Fonepay's verification API.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const paymentSettings = await getPaymentSettings();
    if (!paymentSettings.fonepayEnabled) return fail(400, "Fonepay payment is currently unavailable");

    const shipping = await resolveShippingAddress(user, body, { persist: false });

    const cart = await loadValidatedCart(user.id);
    const pricing = await resolveCartPricing(cart, user);
    const subtotal = computeSubtotal(cart, pricing);
    const { discount } = await applyCoupon(subtotal, body.couponCode);
    const { total } = await computeShippingAndTax(shipping.country, subtotal, discount, shipping.municipalityId);

    if (total <= 0) return fail(400, "Order total must be greater than zero to pay online");

    const transactionUuid = generateOrderNumber();
    const baseUrl = (process.env.NEXTAUTH_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    const returnUrl = `${baseUrl}/checkout/fonepay/return?txn=${transactionUuid}`;
    const config = resolveFonepayConfig(paymentSettings);

    if (!config.merchantCode || !config.secretKey) {
      return fail(400, "Fonepay is not configured yet — add a merchant code and secret key in Payment Settings");
    }

    const redirectUrl = buildFonepayRedirectUrl(
      { prn: transactionUuid, amount: total, remarks1: `Order ${transactionUuid}`, returnUrl },
      config
    );

    return ok({ transactionUuid, redirectUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
