import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/session";

/**
 * Sentinel wardNo representing "the whole city" rather than one specific ward — used by dealer
 * assignment/shipping-charge overrides now that dealer matching is city-level (see
 * lib/dealerSelection.ts), while reusing the existing Ward/DealerWardAssignment/
 * DealerShippingCharge tables instead of adding parallel municipality-keyed ones. Never a valid
 * value on a customer's own Address (real addresses always use wardNo 1..wardCount).
 */
export const CITYWIDE_WARD_NO = 0;

/**
 * Wards aren't pre-seeded — a municipality only knows its total `wardCount`. This lazily
 * materializes the (municipality, wardNo) row the first time anything needs to reference it
 * as a real entity (a dealer assignment, a distributor application, an order). Validates the
 * ward number against the municipality's seeded wardCount first, same rule checkoutCore uses.
 * `CITYWIDE_WARD_NO` (0) always bypasses that upper-bound check.
 */
export async function resolveOrCreateWard(
  municipalityId: number,
  wardNo: number,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ id: number; municipalityId: number; wardNo: number }> {
  const municipality = await client.addressBook.findUnique({ where: { id: municipalityId } });
  if (!municipality || municipality.level !== "MUNICIPALITY") {
    throw new ApiError(400, "Invalid city");
  }
  if (wardNo !== CITYWIDE_WARD_NO && municipality.wardCount && wardNo > municipality.wardCount) {
    throw new ApiError(400, `Ward number must be between 1 and ${municipality.wardCount}`);
  }
  if (wardNo < CITYWIDE_WARD_NO) throw new ApiError(400, "Invalid ward number");

  return client.ward.upsert({
    where: { municipalityId_wardNo: { municipalityId, wardNo } },
    create: { municipalityId, wardNo },
    update: {},
  });
}
