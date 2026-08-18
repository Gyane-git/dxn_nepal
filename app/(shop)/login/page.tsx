"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { loginSchema, type LoginInput } from "@/schemas/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const justVerified = searchParams.get("verified") === "1";
  const [formError, setFormError] = useState<ReactNode>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const result = await signIn("credentials", {
      ...values,
      redirect: false,
    });

    if (result?.error === "EMAIL_NOT_VERIFIED") {
      setFormError(
        <>
          Please verify your email before logging in.{" "}
          <Link href={`/verify-email?email=${encodeURIComponent(values.email)}`} className="font-medium underline">
            Enter your code
          </Link>
        </>
      );
      return;
    }
    if (result?.error) {
      setFormError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <Logo showText={false} iconSize={48} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-gray-500">Log in to continue to DXN</p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
        {justVerified && (
          <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">
            Email verified — you can now log in.
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Email or Distributor ID"
            type="text"
            autoComplete="username"
            error={errors.email?.message}
            {...register("email")}
          />
          <div className="flex flex-col gap-1.5">
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Link href="/forgot-password" className="self-end text-xs font-medium text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" size="lg" isLoading={isSubmitting}>
            Log In
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
