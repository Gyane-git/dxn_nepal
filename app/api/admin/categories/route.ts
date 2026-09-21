import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";

export async function GET(request: Request) {
  try {
    await requirePermission("categories.view");
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const parentCategoryId = searchParams.get("parentCategoryId");
    const trashed = searchParams.get("trashed") === "true";
    const tree = searchParams.get("tree") === "true";

    const where: Prisma.CategoryWhereInput = {
      deletedAt: trashed ? { not: null } : null,
      ...(status === "ACTIVE" || status === "INACTIVE" ? { status } : {}),
      ...(parentCategoryId === "root"
        ? { parentCategoryId: null }
        : parentCategoryId
        ? { parentCategoryId: Number(parentCategoryId) }
        : {}),
      ...(search ? { name: { contains: search } } : {}),
    };

    if (tree) {
      const categories = await prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { products: true, children: true } } },
      });
      return ok({ categories, total: categories.length, page: 1, pageSize: categories.length });
    }

    const { page, pageSize, skip } = parsePagination(searchParams);

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, children: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);

    return ok({ categories, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    await requirePermission("categories.create");
    return fail(403, "Categories are managed by OMS and are created during catalog sync.");
  } catch (error) {
    return handleApiError(error);
  }
}
