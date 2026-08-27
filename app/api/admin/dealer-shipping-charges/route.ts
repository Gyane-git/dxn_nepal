import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { resolveOrCreateWard } from "@/lib/ward";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

/** Without `dealerId`, lists every dealer's ward overrides — the admin's cross-dealer shipping view. */
export async function GET(request: Request) {
  try {
    await requirePermission("dealers.view");
    const { searchParams } = new URL(request.url);
    const dealerIdParam = searchParams.get("dealerId");
    const dealerId = dealerIdParam ? Number(dealerIdParam) : null;
    if (dealerIdParam && !dealerId) return fail(400, "Invalid dealerId");

    const charges = await prisma.dealerShippingCharge.findMany({
      where: dealerId ? { dealerId } : undefined,
      include: {
        ward: { include: { municipality: { select: { id: true, name: true } } } },
        dealer: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(charges);
  } catch (error) {
    return handleApiError(error);
  }
}

const createChargeSchema = z.object({
  dealerId: z.number().int().positive(),
  municipalityId: z.number().int().positive(),
  /** 0 (CITYWIDE_WARD_NO, see lib/ward.ts) means "the whole city" — matching is city-level now, not ward-level. */
  wardNo: z.number().int().min(0),
  charge: z.number().min(0).max(100_000),
});

/** Creates or overwrites the city-specific shipping override for a dealer — one active rule per (dealer, city). */
export async function POST(request: Request) {
  try {
    const admin = await requirePermission("dealers.edit");
    const body = await request.json();
    const parsed = createChargeSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const dealer = await prisma.dealer.findUnique({ where: { id: data.dealerId } });
    if (!dealer) return fail(404, "Dealer not found");

    const ward = await resolveOrCreateWard(data.municipalityId, data.wardNo);

    const existing = await prisma.dealerShippingCharge.findUnique({
      where: { dealerId_wardId: { dealerId: data.dealerId, wardId: ward.id } },
    });

    const rule = await prisma.dealerShippingCharge.upsert({
      where: { dealerId_wardId: { dealerId: data.dealerId, wardId: ward.id } },
      create: { dealerId: data.dealerId, wardId: ward.id, charge: data.charge },
      update: { charge: data.charge, isActive: true },
    });

    await recordAudit({
      actorId: admin.id,
      action: existing ? "dealer_shipping_charge.update" : "dealer_shipping_charge.create",
      entityType: "DealerShippingCharge",
      entityId: rule.id,
      oldValue: existing ? { charge: Number(existing.charge) } : null,
      newValue: { dealerId: data.dealerId, wardId: ward.id, charge: data.charge },
    });

    return ok(rule, "Shipping charge saved");
  } catch (error) {
    return handleApiError(error);
  }
}
