import { prisma } from "@/lib/prisma";
import { fail, handleApiError, ok } from "@/lib/api";
import { postOrderToOms } from "@/lib/oms";
import { requirePermission } from "@/lib/session";

/** Explicit manual OMS dispatch. Failed attempts remain retryable; success is immutable. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("orders.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid order id");
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return fail(404, "Order not found");
    if (!admin.isSuperAdmin && admin.dealerId != null && order.dealerId !== admin.dealerId) return fail(404, "Order not found");
    if (order.omsSyncStatus === "SUCCESS") return fail(409, "This order was already sent to OMS");
    try {
      await postOrderToOms(id);
      return ok(null, "Order sent to OMS successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "OMS order request failed";
      console.error(`[oms] send failed for local order ${id}:`, message);
      await prisma.order.update({ where: { id }, data: { omsSyncStatus: "FAILED", omsSyncError: message } });
      return fail(502, message);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
