import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";

export async function GET(request: Request) {
  try {
    const admin = await requirePermission("products.view");
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const categoryIdParam = searchParams.get("categoryId");
    const brandIdParam = searchParams.get("brandId");
    const categoryId = categoryIdParam && !Number.isNaN(Number(categoryIdParam)) ? Number(categoryIdParam) : undefined;
    const brandId = brandIdParam && !Number.isNaN(Number(brandIdParam)) ? Number(brandIdParam) : undefined;
    const status = searchParams.get("status");
    const stockStatus = searchParams.get("stockStatus");
    const featured = searchParams.get("featured");
    const trashed = searchParams.get("trashed") === "true";
    const { page, pageSize, skip } = parsePagination(searchParams);

    // A dealer-linked login (see Dealer.userId) may only ever browse products actually assigned
    // to their dealer, and — matching the same rule their own inventory view enforces — only
    // currently PUBLISHED ones (an archived/draft product isn't sellable, so it isn't shown even
    // if it was assigned in the past). This ignores any `status`/`trashed` query params entirely
    // rather than letting a dealer browse drafts/archived/trashed central products.
    const scopedDealerId = !admin.isSuperAdmin ? admin.dealerId : null;
    const isDealerScoped = scopedDealerId != null;

    const where: Prisma.ProductWhereInput = {
      deletedAt: isDealerScoped ? null : trashed ? { not: null } : null,
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(isDealerScoped ? { status: "PUBLISHED" } : status ? { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" } : {}),
      ...(stockStatus ? { stockStatus: stockStatus as "IN_STOCK" | "OUT_OF_STOCK" | "ON_BACKORDER" } : {}),
      ...(featured === "true" ? { isFeatured: true } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }] } : {}),
      ...(scopedDealerId != null
        ? {
            dealerInventory: {
              some: { dealerId: scopedDealerId, status: "ACTIVE" as const },
            },
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          images: { take: 1, orderBy: { sortOrder: "asc" } },
          _count: { select: { variants: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    const data = products.map((p) => ({
      ...p,
      price: Number(p.price),
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    }));

    return ok({ products: data, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    await requirePermission("products.create");
    return fail(403, "Products are managed by OMS. Use Sync OMS Catalog from the product list.");
  } catch (error) {
    return handleApiError(error);
  }
}
