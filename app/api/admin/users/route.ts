import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";
import { recordAudit } from "@/lib/audit";
import { createAdminUserSchema } from "@/schemas/admin-user";

/** Admin-panel staff accounts only (role=ADMIN) — customers/distributors are managed elsewhere. */
export async function GET(request: Request) {
  try {
    await requirePermission("users.view");
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const { page, pageSize, skip } = parsePagination(searchParams);

    const where = {
      role: "ADMIN" as const,
      ...(status ? { status: status as "ACTIVE" | "DISABLED" } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          adminRole: { select: { id: true, name: true, isSuperAdmin: true } },
          dealer: { select: { id: true, name: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return ok({ users, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePermission("users.create");
    const body = await request.json();
    const parsed = createAdminUserSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(409, "A user with this email already exists");

    let role = null as { isSuperAdmin: boolean } | null;
    if (data.adminRoleId != null) {
      role = await prisma.adminRole.findUnique({ where: { id: data.adminRoleId }, select: { isSuperAdmin: true } });
      if (!role) return fail(404, "Role not found");
      if (role.isSuperAdmin && !admin.isSuperAdmin) return fail(403, "Only a Super Admin can assign the Super Admin role");
    }

    if (data.dealerId != null) {
      const dealer = await prisma.dealer.findUnique({ where: { id: data.dealerId }, select: { userId: true } });
      if (!dealer) return fail(404, "Dealer not found");
      if (dealer.userId != null) return fail(409, "This dealer is already linked to another login");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email,
          phone: data.phone || null,
          passwordHash,
          role: "ADMIN",
          adminRoleId: data.adminRoleId,
          status: "ACTIVE",
          emailVerified: true,
        },
        select: { id: true, name: true, email: true, status: true, createdAt: true },
      });
      if (data.dealerId != null) {
        await tx.dealer.update({ where: { id: data.dealerId }, data: { userId: created.id } });
      }
      return created;
    });

    await recordAudit({
      actorId: admin.id,
      action: "admin_user.create",
      entityType: "User",
      entityId: user.id,
      newValue: { email, adminRoleId: data.adminRoleId, dealerId: data.dealerId ?? null },
    });

    return ok(user, "Admin user created");
  } catch (error) {
    return handleApiError(error);
  }
}
