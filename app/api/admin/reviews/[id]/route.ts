import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";

const statusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("reviews.approve");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid id");

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return fail(404, "Review not found");
    if (!admin.isSuperAdmin && admin.dealerId != null) {
      const assignment = await prisma.dealerInventory.findFirst({
        where: { dealerId: admin.dealerId, productId: existing.productId, status: "ACTIVE" },
      });
      if (!assignment) return fail(404, "Review not found");
    }

    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const review = await prisma.review.update({
      where: { id },
      data: { status: parsed.data.status },
      include: {
        product: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
    });

    return ok(review, "Review updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("reviews.delete");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid id");

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return fail(404, "Review not found");
    if (!admin.isSuperAdmin && admin.dealerId != null) {
      const assignment = await prisma.dealerInventory.findFirst({
        where: { dealerId: admin.dealerId, productId: existing.productId, status: "ACTIVE" },
      });
      if (!assignment) return fail(404, "Review not found");
    }

    await prisma.review.delete({ where: { id } });
    return ok(null, "Review deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
