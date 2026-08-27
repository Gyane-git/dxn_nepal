import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("dealers.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid id");

    const existing = await prisma.wardDistance.findUnique({ where: { id } });
    if (!existing) return fail(404, "Ward distance not found");

    await prisma.wardDistance.delete({ where: { id } });
    return ok(null, "Ward distance removed");
  } catch (error) {
    return handleApiError(error);
  }
}
