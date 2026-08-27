import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { resolveOrCreateWard } from "@/lib/ward";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const assignSchema = z.object({
  municipalityId: z.number().int().positive(),
  /** 0 (CITYWIDE_WARD_NO, see lib/ward.ts) means "the whole city" — matching is city-level now, not ward-level. */
  wardNo: z.number().int().min(0),
  dealerId: z.number().int().positive(),
  priority: z.number().int().min(1).max(5).default(1),
});

/**
 * Assigns a dealer to a ward at a given priority (1 = primary). Reassigning a priority slot
 * that's already held moves it — `@@unique([wardId, priority])` in the schema is what actually
 * guarantees exactly one dealer per priority per ward; this just performs that move atomically.
 */
export async function POST(request: Request) {
  try {
    const admin = await requirePermission("dealers.edit");
    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const dealer = await prisma.dealer.findUnique({ where: { id: data.dealerId } });
    if (!dealer) return fail(404, "Dealer not found");

    const ward = await resolveOrCreateWard(data.municipalityId, data.wardNo);

    const assignment = await prisma.$transaction(async (tx) => {
      const existing = await tx.dealerWardAssignment.findUnique({
        where: { wardId_priority: { wardId: ward.id, priority: data.priority } },
      });
      if (existing) {
        return tx.dealerWardAssignment.update({ where: { id: existing.id }, data: { dealerId: data.dealerId } });
      }
      return tx.dealerWardAssignment.create({
        data: { dealerId: data.dealerId, wardId: ward.id, priority: data.priority },
      });
    });

    await recordAudit({
      actorId: admin.id,
      action: "ward_assignment.set",
      entityType: "DealerWardAssignment",
      entityId: assignment.id,
      newValue: { wardId: ward.id, wardNo: data.wardNo, dealerId: data.dealerId, priority: data.priority },
    });

    return ok(assignment, "Ward assigned");
  } catch (error) {
    return handleApiError(error);
  }
}
