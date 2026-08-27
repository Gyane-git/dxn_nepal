import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const createDealerSchema = z.object({
  /** Optional — a Dealer can stand alone or be backed by an approved Distributor account (see lib/session.ts requireDealer). */
  userId: z.number().int().positive().optional(),
  name: z.string().min(2).max(150),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().max(150).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  shippingCharge: z.number().min(0).max(1_000_000).default(0),
});

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
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { user: { email: { contains: search } } },
              { user: { distributorId: { contains: search } } },
            ],
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
export async function POST(request: Request) {
  try {
    const admin = await requirePermission("dealers.create");
    const body = await request.json();
    const parsed = createDealerSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    if (data.userId) {
      const user = await prisma.user.findUnique({ where: { id: data.userId } });
      if (!user) return fail(404, "User not found");
      if (user.role !== "DISTRIBUTOR") return fail(400, "Only an approved distributor can be made a dealer");

      const existing = await prisma.dealer.findUnique({ where: { userId: data.userId } });
      if (existing) return fail(409, "This distributor is already a dealer");
    }

    const dealer = await prisma.dealer.create({
      data: {
        userId: data.userId ?? null,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        shippingCharge: data.shippingCharge,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: "dealer.create",
      entityType: "Dealer",
      entityId: dealer.id,
      newValue: { userId: data.userId ?? null, name: data.name },
    });

    return ok(dealer, "Dealer created");
  } catch (error) {
    return handleApiError(error);
  }
}
