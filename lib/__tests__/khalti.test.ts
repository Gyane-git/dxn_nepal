import { describe, expect, it } from "vitest";
import { resolveKhaltiConfig } from "@/lib/khalti";

describe("resolveKhaltiConfig", () => {
  it("falls back to sandbox base URL when nothing is configured", () => {
    const config = resolveKhaltiConfig();
    expect(config.baseUrl).toBe("https://dev.khalti.com");
    expect(config.secretKey).toBe("");
  });

  it("admin-configured Payment Settings take precedence over defaults", () => {
    const config = resolveKhaltiConfig({ khaltiSecretKey: "live_secret_abc", khaltiBaseUrl: "https://khalti.com" });
    expect(config.secretKey).toBe("live_secret_abc");
    expect(config.baseUrl).toBe("https://khalti.com");
  });

  it("ignores null/empty overrides and falls back to defaults", () => {
    const config = resolveKhaltiConfig({ khaltiSecretKey: null, khaltiBaseUrl: "" });
    expect(config.secretKey).toBe("");
    expect(config.baseUrl).toBe("https://dev.khalti.com");
  });
});
