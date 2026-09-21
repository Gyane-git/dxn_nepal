import { requirePermission } from "@/lib/session";
import { fail, handleApiError } from "@/lib/api";

export async function POST() {
  try {
    await requirePermission("categories.edit");
    return fail(403, "Categories are managed by OMS.");
  } catch (error) {
    return handleApiError(error);
  }
}
