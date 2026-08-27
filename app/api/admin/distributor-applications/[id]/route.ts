import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("distributors.view");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid application id");

    const application = await prisma.distributorApplication.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        reviewedBy: { select: { id: true, name: true } },
        sponsor: { select: { id: true, name: true, distributorId: true } },
        province: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
        municipality: { select: { id: true, name: true } },
        ward: { select: { id: true, wardNo: true } },
      },
    });
    if (!application) return fail(404, "Application not found");

    return ok(application);
  } catch (error) {
    return handleApiError(error);
  }
}
