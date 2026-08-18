import type { Prisma } from "@prisma/client";
import { computeAutoPv, computeDiscountedUnitPrice } from "@/lib/pricing";

export async function syncDistributorDiscounts(
  tx: Prisma.TransactionClient,
  productId: number,
  rules: { distributorId: number; discountPercent: number }[]
) {
  await tx.productDistributorDiscount.deleteMany({ where: { productId } });
  if (rules.length > 0) {
    await tx.productDistributorDiscount.createMany({
      data: rules.map((r) => ({ productId, distributorId: r.distributorId, discountPercent: r.discountPercent })),
    });
  }
}

/**
 * PV is never accepted from the client — it's always auto-computed as 0.2% of the price the
 * distributor actually pays (their own discounted price, when they have one; the list price
 * otherwise), so distributorIds is just the set of distributors eligible for PV on this product.
 * The stored pvValue is a display snapshot; resolveCartPricing/resolveViewerProductPricing
 * recompute it live from the current price/discount at checkout so it never drifts from a later
 * price or discount edit.
 */
export async function syncDistributorPv(
  tx: Prisma.TransactionClient,
  productId: number,
  distributorIds: number[],
  price: number,
  discountRules: { distributorId: number; discountPercent: number }[] = []
) {
  await tx.productDistributorPv.deleteMany({ where: { productId } });
  if (distributorIds.length > 0) {
    const discountByDistributor = new Map(discountRules.map((r) => [r.distributorId, r.discountPercent]));
    await tx.productDistributorPv.createMany({
      data: distributorIds.map((distributorId) => {
        const discountPercent = discountByDistributor.get(distributorId);
        const effectivePrice = discountPercent != null ? computeDiscountedUnitPrice(price, discountPercent) : price;
        return { productId, distributorId, pvValue: computeAutoPv(effectivePrice) };
      }),
    });
  }
}
