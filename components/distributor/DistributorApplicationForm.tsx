"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { distributorApplicationSchema, type DistributorApplicationInput } from "@/schemas/distributor";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface ExistingApplication {
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
}

interface Props {
  defaultName: string;
  defaultPhone: string;
  application: ExistingApplication | null;
}

export function DistributorApplicationForm({ defaultName, defaultPhone, application }: Props) {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DistributorApplicationInput>({
    resolver: zodResolver(distributorApplicationSchema),
    defaultValues: { fullName: defaultName, phone: defaultPhone, reason: "" },
  });

  async function onSubmit(values: DistributorApplicationInput) {
    setFormError(null);
    const res = await fetch("/api/distributor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (!res.ok) {
      setFormError(json.message ?? "Something went wrong");
      return;
    }
    setSubmitted(true);
    router.refresh();
  }

  if (submitted || application?.status === "PENDING") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Application Pending</h2>
        <p className="mt-2 text-sm text-amber-800">
          Thanks for applying! Our team is reviewing your distributor application and will notify you once it&apos;s
          been decided.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
      {application?.status === "REJECTED" && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          Your previous application was not approved
          {application.rejectionReason ? `: ${application.rejectionReason}` : "."} You&apos;re welcome to apply again below.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Full name" error={errors.fullName?.message} {...register("fullName")} />
        <Input label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Why do you want to become a distributor?</label>
          <textarea
            rows={4}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            {...register("reason")}
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          Submit Application
        </Button>
      </form>
    </div>
  );
}
