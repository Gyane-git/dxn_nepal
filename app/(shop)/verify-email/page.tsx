"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifyOtpSchema, type VerifyOtpInput } from "@/schemas/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpInput>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { email, code: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function onSubmit(values: VerifyOtpInput) {
    setFormError(null);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json();

    if (!res.ok) {
      setFormError(json.message ?? "Something went wrong");
      return;
    }

    router.push("/login?verified=1");
  }

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setIsResending(true);
    setResendMessage(null);
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    setIsResending(false);
    setResendMessage(json.message ?? "If that account needs verification, we've sent a new code.");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <Logo showText={false} iconSize={48} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">Verify your email</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        {email ? (
          <>
            Enter the 6-digit code we sent to <span className="font-medium text-gray-700">{email}</span>
          </>
        ) : (
          "Enter the 6-digit code we emailed you"
        )}
      </p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <input type="hidden" {...register("email")} />
          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={errors.code?.message}
            {...register("code")}
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" size="lg" isLoading={isSubmitting}>
            Verify
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-500">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            className="font-medium text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
        {resendMessage && <p className="mt-2 text-center text-xs text-gray-500">{resendMessage}</p>}
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
