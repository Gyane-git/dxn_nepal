import { prisma } from "@/lib/prisma";
import { requireDealer } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";
import { ALL_PERMISSION_KEYS, DEALER_PORTAL_PERMISSION_KEYS } from "@/lib/permissions";

/** Drives the account nav link and the dealer-inventory page's view-vs-edit rendering. */
export async function GET() {
  try {
    const { dealer } = await requireDealer();

    let permissions: string[];
    if (dealer.adminRoleId == null) {
      permissions = DEALER_PORTAL_PERMISSION_KEYS;
    } else {
      const role = await prisma.adminRole.findUnique({
        where: { id: dealer.adminRoleId },
        select: { isSuperAdmin: true, permissions: { select: { permission: { select: { key: true } } } } },
      });
      permissions = role?.isSuperAdmin ? ALL_PERMISSION_KEYS : (role?.permissions.map((rp) => rp.permission.key) ?? []);
    }

    return ok({ dealerId: dealer.id, dealerName: dealer.name, permissions });
  } catch (error) {
    return handleApiError(error);
  }
}
