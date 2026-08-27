import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { categoryBulkActionSchema } from "@/schemas/admin-category";

export async function POST(request: Request) {
  try {
    await requirePermission("categories.edit");
    const body = await request.json();
    const parsed = categoryBulkActionSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");

    const { ids, action } = parsed.data;

    if (action === "delete") {
      await requirePermission("categories.delete");
    }

    switch (action) {
      case "delete":
        await prisma.category.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
        break;
      case "enable":
        await prisma.category.updateMany({ where: { id: { in: ids } }, data: { status: "ACTIVE" } });
        break;
      case "disable":
        await prisma.category.updateMany({ where: { id: { in: ids } }, data: { status: "INACTIVE" } });
        break;
      case "restore":
        await prisma.category.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
        break;
    }

    return ok(null, "Bulk action applied");
  } catch (error) {
    return handleApiError(error);
  }
}
