import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  charge: z.number().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("dealers.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid rule id");

    const existing = await prisma.dealerShippingCharge.findUnique({ where: { id } });
    if (!existing) return fail(404, "Shipping charge rule not found");

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const rule = await prisma.dealerShippingCharge.update({ where: { id }, data: parsed.data });

    await recordAudit({
      actorId: admin.id,
      action: "dealer_shipping_charge.update",
      entityType: "DealerShippingCharge",
      entityId: id,
      oldValue: { charge: Number(existing.charge), isActive: existing.isActive },
      newValue: { charge: Number(rule.charge), isActive: rule.isActive },
    });

    return ok(rule, "Shipping charge updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("dealers.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid rule id");

    const existing = await prisma.dealerShippingCharge.findUnique({ where: { id } });
    if (!existing) return fail(404, "Shipping charge rule not found");

    await prisma.dealerShippingCharge.delete({ where: { id } });

    await recordAudit({
      actorId: admin.id,
      action: "dealer_shipping_charge.remove",
      entityType: "DealerShippingCharge",
      entityId: id,
      oldValue: { dealerId: existing.dealerId, wardId: existing.wardId, charge: Number(existing.charge) },
    });

    return ok(null, "Shipping charge removed");
  } catch (error) {
    return handleApiError(error);
  }
}
