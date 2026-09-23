import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";

export async function GET(request: Request) {
  try {
    const admin = await requirePermission("dealers.view");
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const { page, pageSize, skip } = parsePagination(searchParams);

    // A login linked to one specific Dealer (see Dealer.userId) may only ever see that dealer —
    // never the full list — regardless of its role's `dealers.view` grant. Super Admin is exempt.
    if (!admin.isSuperAdmin && admin.dealerId != null) {
      const dealer = await prisma.dealer.findUnique({
        where: { id: admin.dealerId },
        include: {
          user: { select: { id: true, name: true, email: true, distributorId: true } },
          _count: { select: { wardAssignments: true, inventory: true, orders: true } },
        },
      });
      return ok({ dealers: dealer ? [dealer] : [], total: dealer ? 1 : 0, page: 1, pageSize });
    }

    const where = {
      ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
      ...(search
        ? {
            OR: [{ name: { contains: search } }, { phone: { contains: search } }, { user: { email: { contains: search } } }, { user: { distributorId: { contains: search } } }],
          }
        : {}),
    };

    const [dealers, total] = await Promise.all([
      prisma.dealer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, distributorId: true } },
          _count: { select: { wardAssignments: true, inventory: true, orders: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.dealer.count({ where }),
    ]);

    return ok({ dealers, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

/** A Dealer is normally standalone; passing `userId` optionally backs it with an approved Distributor account instead (grants that account dealer-portal access) — never a duplicate identity. */
export async function POST() {
  try {
    await requirePermission("dealers.create");
    return fail(403, "Dealers are managed by OMS. Use Sync Dealers from the dealer list.");
  } catch (error) {
    return handleApiError(error);
  }
}
