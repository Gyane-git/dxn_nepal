import { describe, expect, it } from "vitest";
import { distributorApplicationSchema, reviewApplicationSchema } from "@/schemas/distributor";

describe("distributorApplicationSchema", () => {
  it("accepts a minimal valid application", () => {
    expect(distributorApplicationSchema.safeParse({ fullName: "Jane Doe" }).success).toBe(true);
  });

  it("accepts a full application", () => {
    const result = distributorApplicationSchema.safeParse({
      fullName: "Jane Doe",
      phone: "9800000000",
      reason: "I want to sell DXN products in my area.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing/too-short name", () => {
    expect(distributorApplicationSchema.safeParse({ fullName: "J" }).success).toBe(false);
    expect(distributorApplicationSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an invalid phone number", () => {
    expect(distributorApplicationSchema.safeParse({ fullName: "Jane Doe", phone: "123" }).success).toBe(false);
  });
});

describe("reviewApplicationSchema", () => {
  it("accepts an empty rejection reason", () => {
    expect(reviewApplicationSchema.safeParse({}).success).toBe(true);
    expect(reviewApplicationSchema.safeParse({ rejectionReason: "" }).success).toBe(true);
  });

  it("accepts a provided rejection reason", () => {
    expect(reviewApplicationSchema.safeParse({ rejectionReason: "Incomplete documentation" }).success).toBe(true);
  });
});
