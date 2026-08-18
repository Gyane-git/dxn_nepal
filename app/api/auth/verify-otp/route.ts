import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtpSchema } from "@/schemas/auth";
import { sendMailBestEffort, welcomeEmail } from "@/lib/mail";
import { hashOtpCode, MAX_OTP_ATTEMPTS } from "@/lib/otp";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ success: false, message: "Invalid or expired code" }, { status: 400 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true, message: "Email already verified" });
  }

  const record = await prisma.emailOtp.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ success: false, message: "Code expired — request a new one" }, { status: 400 });
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    return NextResponse.json({ success: false, message: "Too many attempts — request a new code" }, { status: 400 });
  }

  if (hashOtpCode(parsed.data.code) !== record.codeHash) {
    await prisma.emailOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ success: false, message: "Invalid code" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
    prisma.emailOtp.deleteMany({ where: { userId: user.id } }),
  ]);

  await sendMailBestEffort({ to: user.email, ...welcomeEmail(user) });

  return NextResponse.json({ success: true, message: "Email verified — you can now log in" });
}
