import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, handleApiError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { notify } from "@/lib/notify";

const transferSchema = z.object({ dealerId: z.number().int().positive() });

/** Moves a PROCESSING order to another active dealer, atomically returning and reserving stock. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("orders.transfer");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid order id");
    const parsed = transferSchema.safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return fail(404, "Order not found");
    if (!admin.isSuperAdmin && admin.dealerId != null && order.dealerId !== admin.dealerId) return fail(404, "Order not found");
    if (order.status !== "PROCESSING") return fail(400, "Only pending (Processing) orders can be transferred");
    if (order.omsSyncStatus === "SUCCESS") return fail(400, "Orders already sent to OMS cannot be transferred");
    if (!order.dealerId) return fail(400, "This order has no assigned dealer to transfer from");
    if (order.dealerId === parsed.data.dealerId) return fail(400, "Choose a different dealer");

    const target = await prisma.dealer.findUnique({ where: { id: parsed.data.dealerId } });
    if (!target || target.status !== "ACTIVE") return fail(400, "The selected dealer is unavailable");

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const reserved = await tx.dealerInventory.updateMany({
          where: { dealerId: target.id, productId: item.productId, variantId: item.variantId, status: "ACTIVE", stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (reserved.count === 0) throw new Error(`${item.name} does not have enough stock at ${target.name}`);
      }
      for (const item of order.items) {
        await tx.dealerInventory.updateMany({
          where: { dealerId: order.dealerId!, productId: item.productId, variantId: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id }, data: { dealerId: target.id, dealerName: target.name, dealerPhone: target.phone } });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: "PROCESSING", note: `Transferred from ${order.dealerName ?? "previous dealer"} to ${target.name}` },
      });
    });

    if (target.userId) await notify(target.userId, `Order ${order.orderNumber} has been transferred to you for fulfillment.`, { type: "order" });
    return ok(null, `Order transferred to ${target.name}`);
  } catch (error) {
    const message = error instanceof Error && error.message.includes("does not have enough stock") ? error.message : null;
    return message ? fail(409, message) : handleApiError(error);
  }
}
