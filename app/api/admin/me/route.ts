import { requireAdmin } from "@/lib/session";
import { ok, handleApiError } from "@/lib/api";

/** Drives the admin sidebar and page-level permission guards — see providers/PermissionsProvider.tsx. */
export async function GET() {
  try {
    const admin = await requireAdmin();
    return ok({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isSuperAdmin: admin.isSuperAdmin,
      permissions: Array.from(admin.permissions),
      dealerId: admin.dealerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
