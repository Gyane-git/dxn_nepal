import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

/** Shared by registration OTP verification and the password-reset link. */
export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

/** Always 6 digits — `randomInt`'s upper bound is exclusive. */
export function generateOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

/** Same hashing convention as the password-reset token in forgot-password/route.ts. */
export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Deletes any prior OTPs for the user and issues a fresh one. Returns the raw code to email. */
export async function issueEmailOtp(userId: number): Promise<string> {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.emailOtp.deleteMany({ where: { userId } });
  await prisma.emailOtp.create({ data: { userId, codeHash, expiresAt } });

  return code;
}
