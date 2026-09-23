import { handleApiError, ok } from "@/lib/api";
import { syncOmsSalesCenters } from "@/lib/oms";
import { requirePermission } from "@/lib/session";

export async function POST() {
  try {
    await requirePermission("dealers.edit");
    const result = await syncOmsSalesCenters();
    return ok(result, "OMS dealers synced successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
