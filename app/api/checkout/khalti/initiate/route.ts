import { requireUser } from "@/lib/session";
import { fail, handleApiError, ok } from "@/lib/api";
import { generateOrderNumber } from "@/lib/orderNumber";
import { initiateKhaltiPayment, resolveKhaltiConfig } from "@/lib/khalti";
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
 * Khalti's initiate step is itself a server-to-server call — unlike eSewa/Fonepay/
 * connectIPS, there's no client-built redirect form; Khalti hands back a ready
 * payment_url. Nothing is written to Order/stock/cart here — that only happens once
 * /api/checkout/khalti/complete confirms the payment via the lookup API.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const paymentSettings = await getPaymentSettings();
    if (!paymentSettings.khaltiEnabled) return fail(400, "Khalti payment is currently unavailable");

    const shipping = await resolveShippingAddress(user, body, { persist: false });

    const cart = await loadValidatedCart(user.id);
    const pricing = await resolveCartPricing(cart, user);
    const subtotal = computeSubtotal(cart, pricing);
    const { discount } = await applyCoupon(subtotal, body.couponCode);
    const { total } = await computeShippingAndTax(shipping.country, subtotal, discount, shipping.municipalityId);

    if (total <= 0) return fail(400, "Order total must be greater than zero to pay online");

    const transactionUuid = generateOrderNumber();
    const baseUrl = (process.env.NEXTAUTH_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    const returnUrl = `${baseUrl}/checkout/khalti/return?txn=${transactionUuid}`;
    const config = resolveKhaltiConfig(paymentSettings);

    if (!config.secretKey) return fail(400, "Khalti is not configured yet — add a secret key in Payment Settings");

    const result = await initiateKhaltiPayment(
      {
        amount: Math.round(total * 100), // paisa
        purchaseOrderId: transactionUuid,
        purchaseOrderName: `Order ${transactionUuid}`,
        returnUrl,
        websiteUrl: baseUrl,
      },
      config
    );

    return ok({ transactionUuid, redirectUrl: result.payment_url });
  } catch (error) {
    return handleApiError(error);
  }
}
