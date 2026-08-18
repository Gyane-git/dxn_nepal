import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handleApiError, ok } from "@/lib/api";
import { sendMailBestEffort, orderConfirmationEmail } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { renderInvoicePdf } from "@/lib/invoice";
import { resolveVisaConfig, verifyVisaPayment } from "@/lib/visa";
import {
  applyCoupon,
  computeSubtotal,
  computeShippingAndTax,
  createOrderFromCart,
  loadValidatedCart,
  resolveCartPricing,
  resolveShippingAddress,
} from "@/lib/checkoutCore";
import { getPaymentSettings } from "@/lib/settings";

/**
 * The order is only ever created here, once the acquiring bank's verification API —
 * the authoritative source of truth, never query params appended to the return URL —
 * confirms the payment succeeded. Until then the cart/stock are untouched.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const transactionUuid: string | undefined = body.transactionUuid;
    if (!transactionUuid) return fail(400, "Missing transaction reference");

    // Idempotent: a retried/duplicated call for an already-completed transaction just returns it.
    const existing = await prisma.order.findUnique({ where: { orderNumber: transactionUuid } });
    if (existing) return ok({ orderNumber: existing.orderNumber }, "Order already recorded");

    const shipping = await resolveShippingAddress(user, body);
    const cart = await loadValidatedCart(user.id);
    const pricing = await resolveCartPricing(cart, user);
    const subtotal = computeSubtotal(cart, pricing);
    const { discount, couponId } = await applyCoupon(subtotal, body.couponCode);
    const { shippingFee, tax, taxLabel, total } = await computeShippingAndTax(
      shipping.country,
      subtotal,
      discount,
      shipping.municipalityId
    );

    const paymentSettings = await getPaymentSettings();
    const config = resolveVisaConfig(paymentSettings);
    const result = await verifyVisaPayment({ txnId: transactionUuid, amount: total }, config);

    if (result.status !== "SUCCESS") {
      return fail(402, `Payment ${result.status.toLowerCase()} — no order was created. Your cart is unchanged.`);
    }

    if (Math.abs(result.amount - total) > 0.01) {
      return fail(
        409,
        "The confirmed payment amount doesn't match your cart total. Please contact support before retrying."
      );
    }

    const order = await createOrderFromCart({
      orderNumber: transactionUuid,
      userId: user.id,
      shipping,
      cart,
      pricing,
      subtotal,
      discount,
      shippingFee,
      tax,
      taxLabel,
      couponId,
      paymentMethod: "ONLINE",
      paymentSubMethod: "VISA",
      paymentStatus: "PAID",
      paymentReference: result.refId,
      historyNote: `Order placed — paid via card (ref: ${result.refId ?? "n/a"})`,
    });

    await notify(user.id, `Your order ${order.orderNumber} has been placed and is now Processing.`);

    const items = cart.items.map((item) => ({
      name: item.product.name,
      price: pricing.get(item.id)!.unitPrice,
      quantity: item.quantity,
    }));

    let invoiceAttachment;
    try {
      const pdf = await renderInvoicePdf({
        orderNumber: order.orderNumber,
        placedAt: order.placedAt.toISOString(),
        fullName: shipping.fullName,
        phone: shipping.phone,
        email: shipping.email,
        line1: shipping.line1,
        line2: shipping.line2,
        city: shipping.city,
        state: shipping.state,
        postalCode: shipping.postalCode,
        country: shipping.country,
        paymentMethod: "ONLINE",
        paymentStatus: order.paymentStatus,
        subtotal,
        discount,
        shippingFee,
        tax,
        taxLabel,
        total: Number(order.total),
        items,
      });
      invoiceAttachment = { filename: `invoice-${order.orderNumber}.pdf`, content: pdf, contentType: "application/pdf" };
    } catch (error) {
      console.error("[checkout] failed to generate invoice attachment:", error);
    }

    await sendMailBestEffort({
      to: shipping.email,
      ...orderConfirmationEmail({
        orderNumber: order.orderNumber,
        fullName: shipping.fullName,
        paymentMethod: "ONLINE",
        items,
        subtotal,
        discount,
        shippingFee,
        tax,
        taxLabel,
        total: Number(order.total),
        shipping,
      }),
      attachments: invoiceAttachment ? [invoiceAttachment] : undefined,
    });

    return ok({ orderNumber: order.orderNumber }, "Order placed successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
