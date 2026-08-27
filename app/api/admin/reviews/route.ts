import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";

export async function GET(request: Request) {
  try {
    const admin = await requirePermission("reviews.view");
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const { page, pageSize, skip } = parsePagination(searchParams);

    // A dealer-linked login (see Dealer.userId) may only ever see reviews left on products
    // actually assigned to its own dealer — never the entire store's reviews. Mirrors the same
    // scoping already applied to /admin/products. Super Admin is exempt.
    const scopedDealerId = !admin.isSuperAdmin ? admin.dealerId : null;

    const where: Prisma.ReviewWhereInput = {
      ...(status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { comment: { contains: search } },
              { product: { name: { contains: search } } },
            ],
          }
        : {}),
      ...(scopedDealerId != null
        ? { product: { dealerInventory: { some: { dealerId: scopedDealerId, status: "ACTIVE" as const } } } }
        : {}),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          product: { select: { name: true, slug: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return ok({ reviews, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}
