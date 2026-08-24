"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { distributorApplicationSchema, type DistributorApplicationInput } from "@/schemas/distributor";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useAddressBookTree } from "@/hooks/useAddressBookTree";

interface ExistingApplication {
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
  createdAt: string;
}

interface Props {
  defaultName: string;
  defaultPhone: string;
  defaultEmail: string;
  application: ExistingApplication | null;
}

export function DistributorApplicationForm({ defaultName, defaultPhone, defaultEmail, application }: Props) {
  const router = useRouter();
  const tree = useAddressBookTree();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showBusiness, setShowBusiness] = useState(false);
  const [sponsorStatus, setSponsorStatus] = useState<{ state: "idle" | "checking" | "found" | "not-found"; name?: string }>({
    state: "idle",
  });
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DistributorApplicationInput>({
    resolver: zodResolver(distributorApplicationSchema),
    defaultValues: { fullName: defaultName, phone: defaultPhone, email: defaultEmail, reason: "" },
  });

  const provinceId = watch("address.provinceId");
  const districtId = watch("address.districtId");
  const municipalityId = watch("address.municipalityId");
  const sponsorId = watch("sponsorId");

  const districts = useMemo(() => {
    if (!tree || !provinceId) return [];
    return tree.provinces.find((p) => p.id === Number(provinceId))?.districts ?? [];
  }, [tree, provinceId]);

  const municipalities = useMemo(() => {
    if (!districtId) return [];
    return districts.find((d) => d.id === Number(districtId))?.municipalities ?? [];
  }, [districts, districtId]);

  const selectedMunicipality = municipalities.find((m) => m.id === Number(municipalityId));
  const wardOptions = selectedMunicipality ? Array.from({ length: selectedMunicipality.wardCount }, (_, i) => i + 1) : [];

  useEffect(() => {
    setValue("address.districtId", undefined as unknown as number);
    setValue("address.municipalityId", undefined as unknown as number);
    setValue("address.wardNo", undefined as unknown as number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceId]);

  useEffect(() => {
    setValue("address.municipalityId", undefined as unknown as number);
    setValue("address.wardNo", undefined as unknown as number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtId]);

  useEffect(() => {
    if (!sponsorId || !sponsorId.trim()) {
      setSponsorStatus({ state: "idle" });
      return;
    }
    let cancelled = false;
    setSponsorStatus({ state: "checking" });
    const timer = setTimeout(() => {
      fetch(`/api/distributor-applications/sponsor?id=${encodeURIComponent(sponsorId.trim())}`)
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (json.success) setSponsorStatus({ state: "found", name: json.data.name });
          else setSponsorStatus({ state: "not-found" });
        })
        .catch(() => !cancelled && setSponsorStatus({ state: "not-found" }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sponsorId]);

  async function onSubmit(values: DistributorApplicationInput) {
    setFormError(null);
    if (sponsorId && sponsorId.trim() && sponsorStatus.state === "not-found") {
      setFormError("The Sponsor ID you entered doesn't match any distributor");
      return;
    }
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

  async function cancelApplication() {
    setIsCancelling(true);
    await fetch("/api/distributor-applications/cancel", { method: "POST" });
    setIsCancelling(false);
    router.refresh();
  }

  if (application?.status === "PENDING" && !submitted) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Application Pending</h2>
        <p className="mt-2 text-sm text-amber-800">
          Thanks for applying! Our team is reviewing your distributor application and will notify you once it&apos;s
          been decided.
        </p>
        <Button variant="outline" size="sm" className="mt-4" isLoading={isCancelling} onClick={cancelApplication}>
          Withdraw Application
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Application Submitted</h2>
        <p className="mt-2 text-sm text-amber-800">
          Thanks for applying! Our team is reviewing your distributor application and will notify you once it&apos;s
          been decided.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft">
      {(application?.status === "REJECTED" || application?.status === "CANCELLED") && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {application.status === "REJECTED"
            ? `Your previous application was not approved${application.rejectionReason ? `: ${application.rejectionReason}` : "."}`
            : "You withdrew your previous application."}{" "}
          You&apos;re welcome to apply again below.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Applicant Information</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Full name" error={errors.fullName?.message} {...register("fullName")} />
            <Input label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
            <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
            <Input label="Alternate phone (optional)" type="tel" error={errors.alternatePhone?.message} {...register("alternatePhone")} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Address</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Province" disabled={!tree} error={errors.address?.provinceId?.message} {...register("address.provinceId", { valueAsNumber: true })}>
              <option value="">Select province</option>
              {tree?.provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select label="District" disabled={!provinceId} error={errors.address?.districtId?.message} {...register("address.districtId", { valueAsNumber: true })}>
              <option value="">Select district</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Select label="City" disabled={!districtId} error={errors.address?.municipalityId?.message} {...register("address.municipalityId", { valueAsNumber: true })}>
              <option value="">Select city</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
            <Select label="Ward" disabled={!selectedMunicipality} error={errors.address?.wardNo?.message} {...register("address.wardNo", { valueAsNumber: true })}>
              <option value="">Select ward</option>
              {wardOptions.map((w) => (
                <option key={w} value={w}>Ward {w}</option>
              ))}
            </Select>
            <Input label="Tole / Area" error={errors.address?.toleArea?.message} {...register("address.toleArea")} />
            <Input label="Landmark (optional)" error={errors.address?.landmark?.message} {...register("address.landmark")} />
            <Input label="Full address" className="sm:col-span-2" error={errors.address?.fullAddress?.message} {...register("address.fullAddress")} />
          </div>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setShowBusiness((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold text-gray-900"
          >
            Business Information (optional)
            <span className="text-xs font-normal text-primary-600">{showBusiness ? "Hide" : "Show"}</span>
          </button>
          {showBusiness && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Business name" error={errors.business?.businessName?.message} {...register("business.businessName")} />
              <Input label="Business type" error={errors.business?.businessType?.message} {...register("business.businessType")} />
              <Input label="PAN / VAT number" error={errors.business?.panVatNumber?.message} {...register("business.panVatNumber")} />
              <Input label="Registration number" error={errors.business?.registrationNumber?.message} {...register("business.registrationNumber")} />
              <Input label="Business phone" error={errors.business?.businessPhone?.message} {...register("business.businessPhone")} />
              <Input label="Business email" type="email" error={errors.business?.businessEmail?.message} {...register("business.businessEmail")} />
              <Input label="Years in business" type="number" min={0} error={errors.business?.yearsInBusiness?.message} {...register("business.yearsInBusiness", { valueAsNumber: true })} />
              <Input label="Number of employees" type="number" min={0} error={errors.business?.numberOfEmployees?.message} {...register("business.numberOfEmployees", { valueAsNumber: true })} />
              <Input label="Estimated monthly sales (Rs)" type="number" min={0} error={errors.business?.estimatedMonthlySales?.message} {...register("business.estimatedMonthlySales", { valueAsNumber: true })} />
              <Input label="Business address" className="sm:col-span-2" error={errors.business?.businessAddress?.message} {...register("business.businessAddress")} />
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Sponsor (optional)</h3>
          <Input
            label="Sponsor's Distributor ID"
            placeholder="e.g. DXN-100001"
            error={errors.sponsorId?.message}
            {...register("sponsorId")}
          />
          {sponsorStatus.state === "checking" && <p className="mt-1 text-xs text-gray-500">Checking…</p>}
          {sponsorStatus.state === "found" && <p className="mt-1 text-xs text-accent-700">Sponsor: {sponsorStatus.name}</p>}
          {sponsorStatus.state === "not-found" && <p className="mt-1 text-xs text-red-600">No distributor found with that ID</p>}
        </section>

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
