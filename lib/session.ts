import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "You must be logged in");
  return user;
}

/**
 * Resolves the signed-in admin plus their effective RBAC state. `adminRoleId == null` (the
 * default for every admin created before this feature) means "legacy/unmanaged admin — full
 * unrestricted access", so this can never lock out an existing admin account. Adds one DB
 * lookup per call, which is also where the account-disabled check lives.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Admin access required");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      status: true,
      adminRoleId: true,
      adminRole: {
        select: { isSuperAdmin: true, permissions: { select: { permission: { select: { key: true } } } } },
      },
      permissionOverrides: { select: { granted: true, permission: { select: { key: true } } } },
      dealer: { select: { id: true } },
    },
  });
  if (!dbUser || dbUser.status === "DISABLED") throw new ApiError(403, "This account has been disabled");

  const isSuperAdmin = dbUser.adminRoleId == null || dbUser.adminRole?.isSuperAdmin === true;
  const permissions = new Set<string>();
  if (!isSuperAdmin) {
    dbUser.adminRole?.permissions.forEach((rp) => permissions.add(rp.permission.key));
    dbUser.permissionOverrides.forEach((o) => {
      if (o.granted) permissions.add(o.permission.key);
      else permissions.delete(o.permission.key);
    });
  }

  // Non-null only when this admin-panel login is also linked to one specific Dealer record
  // (see Dealer.userId / app/api/admin/users). Used to scope /admin/dealers down to "just mine"
  // for a dealer-persona login, regardless of role — a dealer must never browse other dealers.
  const dealerId = dbUser.dealer?.id ?? null;

  return { ...user, isSuperAdmin, permissions, dealerId };
}

/** Like requireAdmin(), but also requires a specific permission key unless the caller is a Super Admin. */
export async function requirePermission(key: string) {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin && !admin.permissions.has(key)) {
    throw new ApiError(403, `Missing permission: ${key}`);
  }
  return admin;
}

/** A dealer is a capability granted to a Distributor account (see Dealer.userId), not a separate role. */
export async function requireDealer() {
  const user = await requireUser();
  const dealer = await prisma.dealer.findUnique({ where: { userId: user.id } });
  if (!dealer || dealer.status !== "ACTIVE") throw new ApiError(403, "Dealer access required");
  return { user, dealer };
}

/**
 * Like requireDealer(), but also requires a specific permission key, resolved against
 * Dealer.adminRoleId — reusing the same AdminRole/Permission tables as requireAdmin(), but never
 * the "null = Super Admin" shortcut (a Dealer must never be treated as an admin-panel Super
 * Admin). `adminRoleId == null` (every dealer before this feature) instead means "full
 * unrestricted access to dealer-portal capabilities", matching prior behavior exactly.
 */
export async function requireDealerPermission(key: string) {
  const { user, dealer } = await requireDealer();
  if (dealer.adminRoleId == null) return { user, dealer };

  const role = await prisma.adminRole.findUnique({
    where: { id: dealer.adminRoleId },
    select: { isSuperAdmin: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  const hasPermission = role?.isSuperAdmin === true || (role?.permissions.some((rp) => rp.permission.key === key) ?? false);
  if (!hasPermission) throw new ApiError(403, `Missing permission: ${key}`);
  return { user, dealer };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
