import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const updateDealerSchema = z.object({
  name: z.string().min(2).max(150),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().max(150).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  shippingCharge: z.number().min(0).max(1_000_000),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("dealers.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid dealer id");

    // Dealer profile (name/shipping/status) stays Super-Admin/staff-managed — a dealer persona
    // may update its own inventory quantities (see the inventory route), never its own profile.
    if (!admin.isSuperAdmin && admin.dealerId != null) {
      return fail(403, "Only an administrator can edit dealer profile details");
    }

    const existing = await prisma.dealer.findUnique({ where: { id } });
    if (!existing) return fail(404, "Dealer not found");

    const body = await request.json();
    const parsed = updateDealerSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const dealer = await prisma.dealer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        shippingCharge: data.shippingCharge,
        status: data.status,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: "dealer.update",
      entityType: "Dealer",
      entityId: id,
      oldValue: { name: existing.name, shippingCharge: Number(existing.shippingCharge), status: existing.status },
      newValue: { name: data.name, shippingCharge: data.shippingCharge, status: data.status },
    });

    return ok(dealer, "Dealer updated");
  } catch (error) {
    return handleApiError(error);
  }
}
