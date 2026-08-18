import { requireUser } from "@/lib/session";
import { fail, handleApiError, ok } from "@/lib/api";
import { generateOrderNumber } from "@/lib/orderNumber";
import { buildVisaFormFields, resolveVisaConfig } from "@/lib/visa";
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
 * Builds a signed Visa card EPG redirect form. Nothing is written to Order/stock/
 * cart here — that only happens once /api/checkout/visa/complete confirms the
 * payment via the acquiring bank's verification API.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const paymentSettings = await getPaymentSettings();
    if (!paymentSettings.visaEnabled) return fail(400, "Card payment is currently unavailable");

    const shipping = await resolveShippingAddress(user, body, { persist: false });

    const cart = await loadValidatedCart(user.id);
    const pricing = await resolveCartPricing(cart, user);
    const subtotal = computeSubtotal(cart, pricing);
    const { discount } = await applyCoupon(subtotal, body.couponCode);
    const { total } = await computeShippingAndTax(shipping.country, subtotal, discount, shipping.municipalityId);

    if (total <= 0) return fail(400, "Order total must be greater than zero to pay online");

    const transactionUuid = generateOrderNumber();
    const baseUrl = (process.env.NEXTAUTH_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    const returnUrl = `${baseUrl}/checkout/visa/return?txn=${transactionUuid}`;
    const config = resolveVisaConfig(paymentSettings);

    if (!config.merchantId || !config.secretKey || !config.gatewayUrl) {
      return fail(400, "Card payment is not configured yet — add merchant credentials in Payment Settings");
    }

    const fields = buildVisaFormFields({ txnId: transactionUuid, amount: total, returnUrl }, config);

    return ok({ transactionUuid, formUrl: config.gatewayUrl, fields });
  } catch (error) {
    return handleApiError(error);
  }
}
