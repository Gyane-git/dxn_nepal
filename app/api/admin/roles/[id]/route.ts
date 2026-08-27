import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { roleSchema } from "@/schemas/admin-role";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("roles.view");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid role id");

    const role = await prisma.adminRole.findUnique({
      where: { id },
      include: { permissions: { select: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
    });
    if (!role) return fail(404, "Role not found");

    return ok({ ...role, permissions: role.permissions.map((p) => p.permission.key) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Renaming/describing a role requires roles.edit; changing its permission set additionally requires roles.manage_permissions. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("roles.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid role id");

    const existing = await prisma.adminRole.findUnique({
      where: { id },
      include: { permissions: { select: { permission: { select: { key: true } } } } },
    });
    if (!existing) return fail(404, "Role not found");

    const body = await request.json();
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    if (data.permissions.some((k) => !ALL_PERMISSION_KEYS.includes(k))) {
      return fail(400, "Unknown permission key");
    }

    if (existing.isSuperAdmin) return fail(400, "The Super Admin role cannot be edited");

    const oldKeys = existing.permissions.map((p) => p.permission.key).sort();
    const newKeys = [...data.permissions].sort();
    const permissionsChanged = JSON.stringify(oldKeys) !== JSON.stringify(newKeys);
    if (permissionsChanged && !admin.isSuperAdmin) {
      await requirePermission("roles.manage_permissions");
    }

    const nameConflict = await prisma.adminRole.findFirst({ where: { name: data.name, NOT: { id } } });
    if (nameConflict) return fail(409, "A role with this name already exists");

    const role = await prisma.$transaction(async (tx) => {
      await tx.adminRole.update({
        where: { id },
        data: { name: data.name, description: data.description || null },
      });
      if (permissionsChanged) {
        await tx.adminRolePermission.deleteMany({ where: { roleId: id } });
        await tx.adminRolePermission.createMany({
          data: await Promise.all(
            data.permissions.map(async (key) => {
              const permission = await tx.permission.findUniqueOrThrow({ where: { key } });
              return { roleId: id, permissionId: permission.id };
            }),
          ),
        });
      }
      return tx.adminRole.findUniqueOrThrow({ where: { id } });
    });

    await recordAudit({
      actorId: admin.id,
      action: "role.update",
      entityType: "AdminRole",
      entityId: id,
      oldValue: { name: existing.name, permissions: oldKeys },
      newValue: { name: data.name, permissions: newKeys },
    });

    return ok(role, "Role updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("roles.delete");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid role id");

    const existing = await prisma.adminRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!existing) return fail(404, "Role not found");
    if (existing.isSystem || existing.isSuperAdmin) return fail(400, "This system role cannot be deleted");
    if (existing._count.users > 0) {
      return fail(409, `Reassign ${existing._count.users} user(s) away from this role before deleting it`);
    }

    await prisma.adminRole.delete({ where: { id } });

    await recordAudit({
      actorId: admin.id,
      action: "role.delete",
      entityType: "AdminRole",
      entityId: id,
      oldValue: { name: existing.name },
    });

    return ok(null, "Role deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
