import { prisma } from "@/lib/prisma";
import { requireDealerPermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { notify } from "@/lib/notify";
import { sendMailBestEffort, orderStatusUpdateEmail } from "@/lib/mail";
import { z } from "zod";

const shipSchema = z.object({
  trackingNumber: z.string().min(1, "Tracking number is required").max(100),
  courierName: z.string().min(1, "Courier name is required").max(100),
});

/** A dealer may mark PROCESSING as SHIPPED for orders assigned to them — nothing else. All other transitions (delivered, cancelled, returned) stay admin-only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { dealer } = await requireDealerPermission("orders.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid order id");

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order || order.dealerId !== dealer.id) return fail(404, "Order not found");
    if (order.status !== "PROCESSING") return fail(400, "This order can no longer be marked as shipped");

    const body = await request.json();
    const parsed = shipSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: "SHIPPED", trackingNumber: parsed.data.trackingNumber, courierName: parsed.data.courierName },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: "SHIPPED", note: `Shipped by dealer (${dealer.name}) via ${parsed.data.courierName}` },
      });
    });

    const message = `Your order ${order.orderNumber} has shipped via ${parsed.data.courierName}.`;
    await notify(order.userId, message, { type: "order", link: "/account/orders" });
    await sendMailBestEffort({
      to: order.email,
      ...orderStatusUpdateEmail({ orderNumber: order.orderNumber, fullName: order.fullName }, message),
    });

    return ok(null, "Order marked as shipped");
  } catch (error) {
    return handleApiError(error);
  }
}
