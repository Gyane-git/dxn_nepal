import { describe, expect, it } from "vitest";
import { isDistributorId } from "@/lib/distributorId";

describe("isDistributorId", () => {
  it("recognizes a well-formed Distributor ID", () => {
    expect(isDistributorId("DXN-100001")).toBe(true);
    expect(isDistributorId("dxn-100001")).toBe(true);
    expect(isDistributorId("  DXN-100042  ")).toBe(true);
  });

  it("rejects emails and other identifiers", () => {
    expect(isDistributorId("someone@example.com")).toBe(false);
    expect(isDistributorId("DXN-")).toBe(false);
    expect(isDistributorId("DXN100001")).toBe(false);
    expect(isDistributorId("garbage")).toBe(false);
    expect(isDistributorId("")).toBe(false);
  });
});
