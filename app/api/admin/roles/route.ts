import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { parsePagination } from "@/lib/admin-query";
import { recordAudit } from "@/lib/audit";
import { roleSchema } from "@/schemas/admin-role";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requirePermission("roles.view");
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const { page, pageSize, skip } = parsePagination(searchParams);

    const where = search ? { name: { contains: search } } : {};

    const [roles, total] = await Promise.all([
      prisma.adminRole.findMany({
        where,
        orderBy: [{ isSuperAdmin: "desc" as const }, { createdAt: "desc" as const }],
        include: { _count: { select: { users: true, permissions: true } } },
        skip,
        take: pageSize,
      }),
      prisma.adminRole.count({ where }),
    ]);

    return ok({ roles, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePermission("roles.create");
    const body = await request.json();
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    if (data.permissions.some((k) => !ALL_PERMISSION_KEYS.includes(k))) {
      return fail(400, "Unknown permission key");
    }
    if (!admin.isSuperAdmin) {
      await requirePermission("roles.manage_permissions");
    }

    const existing = await prisma.adminRole.findUnique({ where: { name: data.name } });
    if (existing) return fail(409, "A role with this name already exists");

    const role = await prisma.adminRole.create({
      data: {
        name: data.name,
        description: data.description || null,
        permissions: { create: data.permissions.map((key) => ({ permission: { connect: { key } } })) },
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: "role.create",
      entityType: "AdminRole",
      entityId: role.id,
      newValue: { name: data.name, permissions: data.permissions },
    });

    return ok(role, "Role created");
  } catch (error) {
    return handleApiError(error);
  }
}
