import { requireUser } from "@/lib/session";
import { fail, handleApiError, ok } from "@/lib/api";
import { generateOrderNumber } from "@/lib/orderNumber";
import { buildConnectipsFormFields, resolveConnectipsConfig } from "@/lib/connectips";
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
 * Validates the cart/address/coupon and builds a signed connectIPS redirect form.
 * Nothing is written to Order/stock/cart here — that only happens once connectIPS
 * confirms the payment, in /api/checkout/connectips/complete.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const paymentSettings = await getPaymentSettings();
    if (!paymentSettings.connectipsEnabled) return fail(400, "connectIPS payment is currently unavailable");

    const shipping = await resolveShippingAddress(user, body, { persist: false });

    const cart = await loadValidatedCart(user.id);
    const pricing = await resolveCartPricing(cart, user);
    const subtotal = computeSubtotal(cart, pricing);
    const { discount } = await applyCoupon(subtotal, body.couponCode);
    const { total } = await computeShippingAndTax(shipping.country, subtotal, discount, shipping.municipalityId);

    if (total <= 0) return fail(400, "Order total must be greater than zero to pay online");

    const transactionUuid = generateOrderNumber();
    const config = resolveConnectipsConfig(paymentSettings);

    if (!config.merchantId || !config.appId || !config.privateKeyPem) {
      return fail(400, "connectIPS is not configured yet — add your merchant details in Payment Settings");
    }

    const fields = buildConnectipsFormFields(
      { txnId: transactionUuid, amount: total, remarks: "Order Payment", particulars: `Order ${transactionUuid}` },
      config
    );

    return ok({ transactionUuid, formUrl: config.gatewayUrl, fields });
  } catch (error) {
    return handleApiError(error);
  }
}
