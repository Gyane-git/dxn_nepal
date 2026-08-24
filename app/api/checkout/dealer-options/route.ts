import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, fail, handleApiError } from "@/lib/api";
import { loadValidatedCart, parseSelectedItems } from "@/lib/checkoutCore";
import { getDealerOptions } from "@/lib/dealerSelection";

/**
 * Given a City (municipality) — from a saved address, a plain `municipalityId` (the customer has
 * only picked a city so far, before finishing the rest of the address form), or a full address
 * object — plus the current cart, returns the primary dealer for that city plus up to 5 ranked
 * alternatives. Dealer matching is city-wide (see lib/dealerSelection.ts); passing `wardNo`
 * (available once the customer has also picked their ward) refines the result to prefer a dealer
 * assigned to that exact ward, and its ward-specific shipping charge, over a merely city-wide one.
 * Recomputed on every call — the client should re-request this whenever the city, ward, or cart
 * contents change (per AGENTS brief section 48).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    let municipalityId: number;
    let wardNo: number | undefined;

    if (body.addressId) {
      const saved = await prisma.address.findUnique({ where: { id: Number(body.addressId) } });
      if (!saved || saved.userId !== user.id) return fail(404, "Address not found");
      municipalityId = saved.municipalityId;
      wardNo = saved.wardNo;
    } else if (body.municipalityId) {
      const id = Number(body.municipalityId);
      const municipality = await prisma.addressBook.findUnique({ where: { id } });
      if (!municipality || municipality.level !== "MUNICIPALITY") return fail(400, "Invalid city");
      municipalityId = id;
      wardNo = body.wardNo ? Number(body.wardNo) : undefined;
    } else if (body.address?.municipalityId) {
      const id = Number(body.address.municipalityId);
      const municipality = await prisma.addressBook.findUnique({ where: { id } });
      if (!municipality || municipality.level !== "MUNICIPALITY") return fail(400, "Invalid city");
      municipalityId = id;
      wardNo = body.address.wardNo ? Number(body.address.wardNo) : undefined;
    } else {
      return fail(400, "A city is required to look up dealer options");
    }

    const cart = await loadValidatedCart(user.id, parseSelectedItems(body));
    const lines = cart.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    const result = await getDealerOptions(municipalityId, lines, wardNo);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
