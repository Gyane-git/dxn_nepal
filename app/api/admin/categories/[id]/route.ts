import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { z } from "zod";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("categories.view");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid id");
    const category = await prisma.category.findUnique({
      where: { id },
      include: { parent: { select: { id: true, name: true } } },
    });
    if (!category) return fail(404, "Category not found");
    return ok(category);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("categories.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid id");
    const parsed = z.object({
      image: z.string().nullable().optional(),
      bannerImage: z.string().nullable().optional(),
    }).safeParse(await request.json());
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const category = await prisma.category.update({
      where: { id },
      data: { image: parsed.data.image ?? null, bannerImage: parsed.data.bannerImage ?? null },
    });
    return ok(category, "Category images updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    await requirePermission("categories.delete");
    return fail(403, "Categories are managed by OMS and cannot be deleted here.");
  } catch (error) {
    return handleApiError(error);
  }
}
