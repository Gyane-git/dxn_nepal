import { prisma } from "@/lib/prisma";
import { handleApiError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/session";

/** Dealer choices for transferring an order. Requires the dedicated transfer permission. */
export async function GET() {
  try {
    await requirePermission("orders.transfer");
    const dealers = await prisma.dealer.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, salesCenterCode: true },
      orderBy: { name: "asc" },
    });
    return ok(dealers);
  } catch (error) {
    return handleApiError(error);
  }
}
