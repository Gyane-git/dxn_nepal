import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/schemas/auth";
import { sendMailBestEffort, otpVerificationEmail } from "@/lib/mail";
import { issueEmailOtp } from "@/lib/otp";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, phone, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing && existing.emailVerified) {
    return NextResponse.json(
      { success: false, message: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // An unverified leftover from a previous, never-completed signup isn't a real
  // account yet — treat a retry as re-registering rather than permanently locking
  // the email out.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, phone: phone || null, passwordHash },
      })
    : await prisma.user.create({
        data: { name, email: normalizedEmail, phone: phone || null, passwordHash, emailVerified: false },
      });

  const code = await issueEmailOtp(user.id);
  await sendMailBestEffort({ to: user.email, ...otpVerificationEmail(code) });

  return NextResponse.json({
    success: true,
    message: "Verification code sent",
    data: { email: user.email },
  });
}
