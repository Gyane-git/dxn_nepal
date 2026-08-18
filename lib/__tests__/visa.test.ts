import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { buildVisaFormFields, resolveVisaConfig } from "@/lib/visa";

describe("resolveVisaConfig", () => {
  it("has no defaults — disabled until real credentials are configured", () => {
    const config = resolveVisaConfig();
    expect(config.merchantId).toBe("");
    expect(config.secretKey).toBe("");
    expect(config.gatewayUrl).toBe("");
    expect(config.verificationUrl).toBe("");
  });

  it("admin-configured Payment Settings take precedence over defaults", () => {
    const config = resolveVisaConfig({
      visaMerchantId: "MER-1",
      visaSecretKey: "secret",
      visaGatewayUrl: "https://epg.example.com/checkout",
      visaVerificationUrl: "https://epg.example.com/verify",
    });
    expect(config.merchantId).toBe("MER-1");
    expect(config.secretKey).toBe("secret");
    expect(config.gatewayUrl).toBe("https://epg.example.com/checkout");
    expect(config.verificationUrl).toBe("https://epg.example.com/verify");
  });
});

describe("buildVisaFormFields", () => {
  const config = resolveVisaConfig({
    visaMerchantId: "MER-1",
    visaSecretKey: "test-secret",
    visaGatewayUrl: "https://epg.example.com/checkout",
    visaVerificationUrl: "https://epg.example.com/verify",
  });

  it("builds all required form fields with a verifiable signature", () => {
    const fields = buildVisaFormFields(
      { txnId: "TXN001", amount: 100, returnUrl: "https://dxn.example.com/checkout/visa/return?txn=TXN001" },
      config
    );

    expect(fields.merchant_id).toBe("MER-1");
    expect(fields.txn_id).toBe("TXN001");
    expect(fields.amount).toBe("100.00");
    expect(fields.signed_field_names).toBe("merchant_id,txn_id,amount");

    const message = `merchant_id=${fields.merchant_id},txn_id=${fields.txn_id},amount=${fields.amount}`;
    const expectedSignature = createHmac("sha256", "test-secret").update(message).digest("hex");
    expect(fields.signature).toBe(expectedSignature);
  });
});
