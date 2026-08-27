import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("dealers.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid assignment id");

    const assignment = await prisma.dealerWardAssignment.findUnique({ where: { id } });
    if (!assignment) return fail(404, "Assignment not found");

    await prisma.dealerWardAssignment.delete({ where: { id } });

    await recordAudit({
      actorId: admin.id,
      action: "ward_assignment.remove",
      entityType: "DealerWardAssignment",
      entityId: id,
      oldValue: { wardId: assignment.wardId, dealerId: assignment.dealerId, priority: assignment.priority },
    });

    return ok(null, "Ward assignment removed");
  } catch (error) {
    return handleApiError(error);
  }
}
