import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { generateOtpCode, hashOtpCode, OTP_EXPIRY_MS } from "@/lib/otp";

describe("generateOtpCode", () => {
  it("always produces a 6-digit numeric code", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode", () => {
  it("matches a plain SHA-256 digest of the code", () => {
    const code = "123456";
    expect(hashOtpCode(code)).toBe(createHash("sha256").update(code).digest("hex"));
  });

  it("produces different hashes for different codes", () => {
    expect(hashOtpCode("111111")).not.toBe(hashOtpCode("222222"));
  });
});

describe("OTP_EXPIRY_MS", () => {
  it("is 10 minutes", () => {
    expect(OTP_EXPIRY_MS).toBe(10 * 60 * 1000);
  });
});
