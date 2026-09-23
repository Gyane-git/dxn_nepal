import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("dealers.view");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid dealer id");

    // A dealer-linked login may only ever view its own dealer profile — never another dealer's.
    if (!admin.isSuperAdmin && admin.dealerId != null && admin.dealerId !== id) {
      return fail(403, "You can only view your own dealer profile");
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, distributorId: true } },
        wardAssignments: {
          include: { ward: { include: { municipality: { select: { id: true, name: true } } } } },
          orderBy: [{ priority: "asc" }],
        },
        shippingCharges: {
          include: { ward: { include: { municipality: { select: { id: true, name: true } } } } },
        },
        _count: { select: { inventory: true, orders: true } },
      },
    });
    if (!dealer) return fail(404, "Dealer not found");

    return ok(dealer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT() {
  try {
    await requirePermission("dealers.edit");
    return fail(403, "Dealer details are managed by OMS and cannot be edited here.");
  } catch (error) {
    return handleApiError(error);
  }
}
