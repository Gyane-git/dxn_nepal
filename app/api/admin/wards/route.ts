import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

/**
 * Lists every ward (1..wardCount) for a municipality, alongside its current primary dealer
 * assignment if one exists — the admin's at-a-glance view for ward assignment. Wards that
 * have never been referenced yet (no dealer assigned, never used on an application/order)
 * simply have no Ward row yet, so they're represented here without one.
 */
export async function GET(request: Request) {
  try {
    await requirePermission("dealers.view");
    const { searchParams } = new URL(request.url);
    const municipalityId = Number(searchParams.get("municipalityId"));
    if (!municipalityId) return fail(400, "municipalityId is required");

    const municipality = await prisma.addressBook.findUnique({ where: { id: municipalityId } });
    if (!municipality || municipality.level !== "MUNICIPALITY") return fail(400, "Invalid municipality");

    const existingWards = await prisma.ward.findMany({
      where: { municipalityId },
      include: {
        dealerAssignments: {
          where: { priority: 1 },
          include: { dealer: { select: { id: true, name: true, status: true } } },
        },
      },
    });
    const byWardNo = new Map(existingWards.map((w) => [w.wardNo, w]));

    const wardCount = municipality.wardCount ?? 0;
    const wards = Array.from({ length: wardCount }, (_, i) => i + 1).map((wardNo) => {
      const existing = byWardNo.get(wardNo);
      return {
        wardNo,
        wardId: existing?.id ?? null,
        primaryDealer: existing?.dealerAssignments[0]?.dealer ?? null,
      };
    });

    return ok({ municipality: { id: municipality.id, name: municipality.name }, wards });
  } catch (error) {
    return handleApiError(error);
  }
}
