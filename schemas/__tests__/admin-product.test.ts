import { describe, expect, it } from "vitest";
import { productSchema } from "@/schemas/admin-product";

const base = {
  name: "Test Product",
  categoryId: 1,
  fullDescription: "A description",
  price: 100,
};

describe("productSchema — discount/PV validation", () => {
  it("accepts a product with neither discount nor PV (Product D)", () => {
    const result = productSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts discount-only (Product A)", () => {
    const result = productSchema.safeParse({
      ...base,
      hasDiscount: true,
      forCustomer: true,
      customerDiscountPercent: 10,
    });
    expect(result.success).toBe(true);
  });

  it("accepts PV-only (Product B)", () => {
    const result = productSchema.safeParse({
      ...base,
      hasPointValue: true,
      pvDistributorIds: [1],
    });
    expect(result.success).toBe(true);
  });

  it("accepts both discount and PV (Product C)", () => {
    const result = productSchema.safeParse({
      ...base,
      hasDiscount: true,
      forDistributor: true,
      distributorDiscounts: [{ distributorId: 1, discountPercent: 15 }],
      hasPointValue: true,
      pvDistributorIds: [1],
    });
    expect(result.success).toBe(true);
  });

  it("rejects forCustomer without a percentage", () => {
    const result = productSchema.safeParse({ ...base, hasDiscount: true, forCustomer: true });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range customer discount percentage", () => {
    const result = productSchema.safeParse({
      ...base,
      hasDiscount: true,
      forCustomer: true,
      customerDiscountPercent: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative customer discount percentage", () => {
    const result = productSchema.safeParse({
      ...base,
      hasDiscount: true,
      forCustomer: true,
      customerDiscountPercent: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects forDistributor enabled with an empty distributor list", () => {
    const result = productSchema.safeParse({ ...base, hasDiscount: true, forDistributor: true, distributorDiscounts: [] });
    expect(result.success).toBe(false);
  });

  it("rejects hasPointValue enabled with an empty distributor list", () => {
    const result = productSchema.safeParse({ ...base, hasPointValue: true, pvDistributorIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate distributor ids in the PV list", () => {
    const result = productSchema.safeParse({
      ...base,
      hasPointValue: true,
      pvDistributorIds: [1, 1],
    });
    expect(result.success).toBe(false);
  });

  it("ignores discount/PV sub-fields entirely when the parent toggle is off", () => {
    const result = productSchema.safeParse({ ...base, hasDiscount: false, forCustomer: true });
    expect(result.success).toBe(true);
  });
});
