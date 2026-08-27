import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { updateAdminUserSchema } from "@/schemas/admin-user";

/** ADMIN users with adminRoleId==null (legacy/unmanaged) or an isSuperAdmin role both count as "Super Admin". */
async function countEffectiveSuperAdmins(excludeUserId?: number) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: [{ adminRoleId: null }, { adminRole: { isSuperAdmin: true } }],
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("users.view");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid user id");

    const user = await prisma.user.findUnique({
      where: { id, role: "ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        adminRoleId: true,
        adminRole: { select: { id: true, name: true, isSuperAdmin: true } },
        dealer: { select: { id: true, name: true } },
      },
    });
    if (!user) return fail(404, "User not found");

    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission("users.edit");
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) return fail(400, "Invalid user id");

    const existing = await prisma.user.findUnique({
      where: { id, role: "ADMIN" },
      include: { adminRole: { select: { isSuperAdmin: true } }, dealer: { select: { id: true } } },
    });
    if (!existing) return fail(404, "User not found");

    const body = await request.json();
    const parsed = updateAdminUserSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Invalid request");
    const data = parsed.data;

    const isSelf = existing.id === admin.id;
    if (isSelf && data.status === "DISABLED") {
      return fail(400, "You cannot disable your own account");
    }

    let nextRole = null as { isSuperAdmin: boolean } | null;
    if (data.adminRoleId != null) {
      nextRole = await prisma.adminRole.findUnique({ where: { id: data.adminRoleId }, select: { isSuperAdmin: true } });
      if (!nextRole) return fail(404, "Role not found");
      if (nextRole.isSuperAdmin && !admin.isSuperAdmin) return fail(403, "Only a Super Admin can assign the Super Admin role");
    }

    const wasSuperAdmin = existing.adminRoleId == null || existing.adminRole?.isSuperAdmin === true;
    const willBeSuperAdmin = data.adminRoleId == null || nextRole?.isSuperAdmin === true;
    const losingSuperAdmin = wasSuperAdmin && (!willBeSuperAdmin || data.status === "DISABLED");
    if (losingSuperAdmin) {
      const remaining = await countEffectiveSuperAdmins(existing.id);
      if (remaining === 0) return fail(400, "At least one Super Admin must remain");
    }

    if (data.dealerId !== undefined && data.dealerId !== existing.dealer?.id) {
      if (data.dealerId != null) {
        const target = await prisma.dealer.findUnique({ where: { id: data.dealerId }, select: { userId: true } });
        if (!target) return fail(404, "Dealer not found");
        if (target.userId != null && target.userId !== id) return fail(409, "This dealer is already linked to another login");
      }
    }

    const updateData: Record<string, unknown> = {
      name: data.name,
      phone: data.phone || null,
      adminRoleId: data.adminRoleId,
      status: data.status,
    };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: { id: true, name: true, email: true, status: true, adminRoleId: true },
      });
      if (data.dealerId !== undefined && data.dealerId !== existing.dealer?.id) {
        if (existing.dealer) {
          await tx.dealer.update({ where: { id: existing.dealer.id }, data: { userId: null } });
        }
        if (data.dealerId != null) {
          await tx.dealer.update({ where: { id: data.dealerId }, data: { userId: id } });
        }
      }
      return updated;
    });

    await recordAudit({
      actorId: admin.id,
      action: "admin_user.update",
      entityType: "User",
      entityId: id,
      oldValue: { adminRoleId: existing.adminRoleId, status: existing.status },
      newValue: { adminRoleId: data.adminRoleId, status: data.status },
    });

    return ok(user, "User updated");
  } catch (error) {
    return handleApiError(error);
  }
}
