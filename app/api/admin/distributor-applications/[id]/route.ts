import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid application id");

    const application = await prisma.distributorApplication.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!application) return fail(404, "Application not found");

    return ok(application);
  } catch (error) {
    return handleApiError(error);
  }
}
