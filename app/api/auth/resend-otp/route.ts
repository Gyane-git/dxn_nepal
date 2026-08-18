import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resendOtpSchema } from "@/schemas/auth";
import { sendMailBestEffort, otpVerificationEmail } from "@/lib/mail";
import { issueEmailOtp, OTP_RESEND_COOLDOWN_MS } from "@/lib/otp";

const GENERIC_MESSAGE = "If that account needs verification, we've sent a new code.";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = resendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    const latest = await prisma.emailOtp.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    const onCooldown = latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS;

    if (!onCooldown) {
      const code = await issueEmailOtp(user.id);
      await sendMailBestEffort({ to: user.email, ...otpVerificationEmail(code) });
    }
  }

  return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
}
