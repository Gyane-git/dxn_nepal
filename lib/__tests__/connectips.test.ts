import { generateKeyPairSync, createVerify } from "crypto";
import { describe, expect, it } from "vitest";
import { buildConnectipsFormFields, resolveConnectipsConfig, signConnectipsToken } from "@/lib/connectips";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("resolveConnectipsConfig", () => {
  it("falls back to sandbox URLs when nothing is configured", () => {
    const config = resolveConnectipsConfig();
    expect(config.gatewayUrl).toBe("https://uat.connectips.com/connectipswebgw/loginpage");
    expect(config.validationUrl).toBe("https://uat.connectips.com/connectipswebws/api/creditor/validatetxn");
  });

  it("admin-configured Payment Settings take precedence over defaults", () => {
    const config = resolveConnectipsConfig({ connectipsMerchantId: "MER-1", connectipsAppId: "MER-1-APP-1" });
    expect(config.merchantId).toBe("MER-1");
    expect(config.appId).toBe("MER-1-APP-1");
  });
});

describe("signConnectipsToken", () => {
  it("produces a signature verifiable with the matching public key", () => {
    const message = "MERCHANTID=MER-1,APPID=MER-1-APP-1,REFERENCEID=TXN001,TXNAMT=10000";
    const token = signConnectipsToken(message, privateKey);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(message);
    expect(verifier.verify(publicKey, token, "base64")).toBe(true);
  });

  it("fails verification if the message was tampered with", () => {
    const token = signConnectipsToken("MERCHANTID=MER-1,TXNAMT=10000", privateKey);
    const verifier = createVerify("RSA-SHA256");
    verifier.update("MERCHANTID=MER-1,TXNAMT=99999"); // tampered amount
    expect(verifier.verify(publicKey, token, "base64")).toBe(false);
  });
});

describe("buildConnectipsFormFields", () => {
  const config = resolveConnectipsConfig({
    connectipsMerchantId: "MER-1",
    connectipsAppId: "MER-1-APP-1",
    connectipsAppName: "DXN Store",
    connectipsPrivateKey: privateKey,
  });

  it("builds all required form fields with a verifiable token", () => {
    const fields = buildConnectipsFormFields({ txnId: "TXN001", amount: 100, remarks: "Order Payment", particulars: "Order TXN001" }, config);

    expect(fields.MERCHANTID).toBe("MER-1");
    expect(fields.APPID).toBe("MER-1-APP-1");
    expect(fields.TXNID).toBe("TXN001");
    expect(fields.REFERENCEID).toBe("TXN001");
    expect(fields.TXNCRNCY).toBe("NPR");
    expect(fields.TXNAMT).toBe("10000"); // 100 NPR -> 10000 paisa
    expect(fields.TXNDATE).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    const message =
      `MERCHANTID=${fields.MERCHANTID},APPID=${fields.APPID},APPNAME=${fields.APPNAME},` +
      `TXNID=${fields.TXNID},TXNDATE=${fields.TXNDATE},TXNCRNCY=${fields.TXNCRNCY},TXNAMT=${fields.TXNAMT},` +
      `REFERENCEID=${fields.REFERENCEID},REMARKS=${fields.REMARKS},PARTICULARS=${fields.PARTICULARS},TOKEN=TOKEN`;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(message);
    expect(verifier.verify(publicKey, fields.TOKEN, "base64")).toBe(true);
  });
});
