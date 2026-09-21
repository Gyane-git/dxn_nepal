import { handleApiError, ok } from "@/lib/api";
import { syncOmsCatalog } from "@/lib/oms";
import { requirePermission } from "@/lib/session";

/** Starts a manual OMS catalog sync. This route never returns OMS credentials or tokens. */
export async function POST() {
  try {
    await requirePermission("products.edit");
    const result = await syncOmsCatalog();
    return ok(result, "OMS catalog synced successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
