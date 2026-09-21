import { requirePermission } from "@/lib/session";
import { fail, handleApiError } from "@/lib/api";

export async function POST() {
  try {
    await requirePermission("products.edit");
    return fail(403, "Products are managed by OMS. Only product images can be updated locally.");
  } catch (error) {
    return handleApiError(error);
  }
}
