import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { buildFonepayRedirectUrl, resolveFonepayConfig } from "@/lib/fonepay";

describe("resolveFonepayConfig", () => {
  it("falls back to sandbox URLs when nothing is configured", () => {
    const config = resolveFonepayConfig();
    expect(config.checkoutUrl).toBe("https://dev-clientapi.fonepay.com/api/merchantRequest");
    expect(config.verificationUrl).toBe("https://dev-clientapi.fonepay.com/api/merchantRequest/verificationMerchant");
  });

  it("admin-configured Payment Settings take precedence over defaults", () => {
    const config = resolveFonepayConfig({ fonepayMerchantCode: "PID999", fonepaySecretKey: "shh" });
    expect(config.merchantCode).toBe("PID999");
    expect(config.secretKey).toBe("shh");
  });
});

describe("buildFonepayRedirectUrl", () => {
  const config = resolveFonepayConfig({
    fonepayMerchantCode: "PID123",
    fonepaySecretKey: "test-secret",
    fonepayCheckoutUrl: "https://dev-clientapi.fonepay.com/api/merchantRequest",
  });

  it("builds the expected query params with correct defaults", () => {
    const url = new URL(
      buildFonepayRedirectUrl(
        { prn: "TESTPRN001", amount: 100, remarks1: "Order TESTPRN001", returnUrl: "https://example.com/return" },
        config
      )
    );
    expect(url.searchParams.get("PID")).toBe("PID123");
    expect(url.searchParams.get("MD")).toBe("P");
    expect(url.searchParams.get("PRN")).toBe("TESTPRN001");
    expect(url.searchParams.get("AMT")).toBe("100.00");
    expect(url.searchParams.get("CRN")).toBe("NPR");
    expect(url.searchParams.get("R2")).toBe("N/A");
    expect(url.searchParams.get("RU")).toBe("https://example.com/return");
    expect(url.searchParams.get("DV")).toBeTruthy();
  });

  it("signs with HMAC-SHA512 over PID,MD,PRN,AMT,CRN,DT,R1,R2,RU in that exact order", () => {
    const url = new URL(
      buildFonepayRedirectUrl(
        { prn: "TESTPRN001", amount: 100, remarks1: "Order TESTPRN001", returnUrl: "https://example.com/return" },
        config
      )
    );
    const p = url.searchParams;
    const expectedDv = createHmac("sha512", "test-secret")
      .update([p.get("PID"), p.get("MD"), p.get("PRN"), p.get("AMT"), p.get("CRN"), p.get("DT"), p.get("R1"), p.get("R2"), p.get("RU")].join(","))
      .digest("hex");
    expect(p.get("DV")).toBe(expectedDv);
  });

  it("produces a different signature for a different secret key", () => {
    const otherConfig = resolveFonepayConfig({ fonepayMerchantCode: "PID123", fonepaySecretKey: "different-secret" });
    const url1 = new URL(
      buildFonepayRedirectUrl({ prn: "X", amount: 50, remarks1: "r", returnUrl: "https://a.com" }, config)
    );
    const url2 = new URL(
      buildFonepayRedirectUrl({ prn: "X", amount: 50, remarks1: "r", returnUrl: "https://a.com" }, otherConfig)
    );
    expect(url1.searchParams.get("DV")).not.toBe(url2.searchParams.get("DV"));
  });
});
