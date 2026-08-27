import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { categoryReorderSchema } from "@/schemas/admin-category";

export async function POST(request: Request) {
  try {
    await requirePermission("categories.edit");
    const body = await request.json();
    const parsed = categoryReorderSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const { items } = parsed.data;

    await prisma.$transaction(
      items.map((item) =>
        prisma.category.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            ...(item.parentCategoryId !== undefined ? { parentCategoryId: item.parentCategoryId || null } : {}),
          },
        })
      )
    );

    return ok(null, "Order updated");
  } catch (error) {
    return handleApiError(error);
  }
}
