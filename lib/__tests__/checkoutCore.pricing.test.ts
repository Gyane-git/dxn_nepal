import { describe, expect, it } from "vitest";
import { computeDiscountedUnitPrice, selectItemPricing } from "@/lib/checkoutCore";
import { computeAutoPv } from "@/lib/pricing";

describe("computeDiscountedUnitPrice", () => {
  it("returns the base price when there is no discount", () => {
    expect(computeDiscountedUnitPrice(100, null)).toBe(100);
    expect(computeDiscountedUnitPrice(100, 0)).toBe(100);
  });

  it("applies a partial discount", () => {
    expect(computeDiscountedUnitPrice(100, 50)).toBe(50);
    expect(computeDiscountedUnitPrice(199.99, 10)).toBeCloseTo(179.99, 2);
  });

  it("applies a full discount", () => {
    expect(computeDiscountedUnitPrice(100, 100)).toBe(0);
  });
});

describe("computeAutoPv", () => {
  it("is always 0.2% of price", () => {
    expect(computeAutoPv(100)).toBe(0.2);
    expect(computeAutoPv(1000)).toBe(2);
    expect(computeAutoPv(5000)).toBe(10);
    expect(computeAutoPv(0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeAutoPv(199.99)).toBeCloseTo(0.4, 2);
    expect(computeAutoPv(33.33)).toBeCloseTo(0.07, 2);
  });
});

describe("selectItemPricing", () => {
  const noDiscountProduct = {
    hasDiscount: false,
    forCustomer: false,
    customerDiscountPercent: null,
    forDistributor: false,
    hasPointValue: false,
  };

  it("gives a plain customer the customer discount only when forCustomer is enabled", () => {
    const withCustomerDiscount = { ...noDiscountProduct, hasDiscount: true, forCustomer: true, customerDiscountPercent: 10 };
    const result = selectItemPricing(1, 100, withCustomerDiscount, false, new Map(), new Set());
    expect(result.discountPercent).toBe(10);
    expect(result.unitPrice).toBe(90);
    expect(result.pvPerUnit).toBe(0);
  });

  it("gives a customer 0 discount when forCustomer is disabled, even if hasDiscount is on", () => {
    const distributorOnlyDiscount = { ...noDiscountProduct, hasDiscount: true, forDistributor: true };
    const result = selectItemPricing(1, 100, distributorOnlyDiscount, false, new Map([[1, 20]]), new Set());
    expect(result.discountPercent).toBeNull();
    expect(result.unitPrice).toBe(100);
  });

  it("gives each distributor only their own configured discount, never another distributor's or the customer discount", () => {
    const product = { ...noDiscountProduct, hasDiscount: true, forCustomer: true, customerDiscountPercent: 5, forDistributor: true };
    const rulesForProduct1 = new Map([[1, 15]]); // distributor's own rule keyed by productId

    const distributor1Result = selectItemPricing(1, 100, product, true, rulesForProduct1, new Set());
    expect(distributor1Result.discountPercent).toBe(15);
    expect(distributor1Result.unitPrice).toBe(85);

    // A distributor with no rule for this product gets 0 discount, not the customer discount and not another distributor's rule
    const distributor2Result = selectItemPricing(1, 100, product, true, new Map(), new Set());
    expect(distributor2Result.discountPercent).toBeNull();
    expect(distributor2Result.unitPrice).toBe(100);
  });

  it("gives 0 PV to customers, and auto-computed PV (0.2% of price) only for an eligible distributor", () => {
    const product = { ...noDiscountProduct, hasPointValue: true };
    const eligible = new Set([1]);

    const customerResult = selectItemPricing(1, 100, product, false, new Map(), eligible);
    expect(customerResult.pvPerUnit).toBe(0);

    const eligibleDistributor = selectItemPricing(1, 100, product, true, new Map(), eligible);
    expect(eligibleDistributor.pvPerUnit).toBe(0.2);

    const ineligibleDistributor = selectItemPricing(1, 100, product, true, new Map(), new Set());
    expect(ineligibleDistributor.pvPerUnit).toBe(0);
  });

  it("gives 0 PV when hasPointValue is disabled, even if the distributor is eligible", () => {
    const product = { ...noDiscountProduct, hasPointValue: false };
    const result = selectItemPricing(1, 100, product, true, new Map(), new Set([1]));
    expect(result.pvPerUnit).toBe(0);
  });

  it("handles all four hasDiscount/hasPointValue combinations", () => {
    const neither = selectItemPricing(1, 100, noDiscountProduct, true, new Map([[1, 10]]), new Set([1]));
    expect(neither.discountPercent).toBeNull();
    expect(neither.pvPerUnit).toBe(0);

    const discountOnly = selectItemPricing(
      1,
      100,
      { ...noDiscountProduct, hasDiscount: true, forDistributor: true },
      true,
      new Map([[1, 10]]),
      new Set([1])
    );
    expect(discountOnly.discountPercent).toBe(10);
    expect(discountOnly.pvPerUnit).toBe(0);

    const pvOnly = selectItemPricing(
      1,
      100,
      { ...noDiscountProduct, hasPointValue: true },
      true,
      new Map([[1, 10]]),
      new Set([1])
    );
    expect(pvOnly.discountPercent).toBeNull();
    expect(pvOnly.pvPerUnit).toBe(0.2);

    const both = selectItemPricing(
      1,
      100,
      { ...noDiscountProduct, hasDiscount: true, forDistributor: true, hasPointValue: true },
      true,
      new Map([[1, 10]]),
      new Set([1])
    );
    expect(both.discountPercent).toBe(10);
    expect(both.unitPrice).toBe(90);
    // PV is 0.2% of the DISCOUNTED price (90), not the base price (100) — 0.18, not 0.2.
    expect(both.pvPerUnit).toBe(0.18);
  });

  it("computes PV from the distributor's discounted price, not the list price", () => {
    const product = { ...noDiscountProduct, hasDiscount: true, forDistributor: true, hasPointValue: true };
    const bigDiscount = selectItemPricing(1, 1000, product, true, new Map([[1, 50]]), new Set([1]));
    expect(bigDiscount.unitPrice).toBe(500);
    expect(bigDiscount.pvPerUnit).toBe(1); // 0.2% of 500, not 0.2% of 1000 (which would be 2)
  });
});
