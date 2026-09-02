"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ApplicationDetail {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  alternatePhone: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  distributorId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  toleArea: string | null;
  fullAddress: string | null;
  landmark: string | null;
  wardNoDisplay?: string;
  businessName: string | null;
  businessType: string | null;
  panVatNumber: string | null;
  registrationNumber: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  yearsInBusiness: number | null;
  estimatedMonthlySales: string | null;
  numberOfEmployees: number | null;
  user: { id: number; name: string; email: string; phone: string | null; createdAt: string };
  reviewedBy: { id: number; name: string } | null;
  sponsor: { id: number; name: string; distributorId: string | null } | null;
  province: { id: number; name: string } | null;
  district: { id: number; name: string } | null;
  municipality: { id: number; name: string } | null;
  ward: { id: number; wardNo: number } | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-700">{value}</dd>
    </div>
  );
}

export default function AdminDistributorApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/distributor-applications/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setNotFound(true);
          return;
        }
        setApplication(json.data);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    setIsBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/distributor-applications/${id}/approve`, { method: "POST" });
    const json = await res.json();
    setIsBusy(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to approve application");
      return;
    }
    load();
  }

  async function reject() {
    if (rejectionReason.trim().length < 5) {
      setError("A rejection reason of at least 5 characters is required");
      return;
    }
    setIsBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/distributor-applications/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason }),
    });
    const json = await res.json();
    setIsBusy(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to reject application");
      return;
    }
    load();
  }

  if (notFound) return <p className="text-sm text-gray-500">Application not found.</p>;
  // if (!application) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!application) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Spinner */}
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-48 animate-pulse rounded bg-gray-100" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-gray-100" />
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">Loading application...</p>
        </div>
      </div>
    );
  }

  const addressLine = [application.fullAddress, application.toleArea, application.ward ? `Ward ${application.ward.wardNo}` : null, application.municipality?.name, application.district?.name, application.province?.name].filter(Boolean).join(", ");

  return (
    <div className="max-w-3xl">
      <button type="button" onClick={() => router.push("/admin/distributors")} className="text-sm text-slate-600 hover:underline">
        ← Back to Distributors
      </button>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Distributor Application</h1>
        <StatusBadge status={application.status} />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <h2 className="text-sm font-semibold text-gray-900">Applicant</h2>
        <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" value={application.fullName} />
          <Field
            label="Account"
            value={
              <Link href={`/admin/orders?search=${encodeURIComponent(application.user.email)}`} className="hover:underline">
                {application.user.email}
              </Link>
            }
          />
          <Field label="Phone" value={application.phone || application.user.phone} />
          <Field label="Alternate phone" value={application.alternatePhone} />
          <Field label="Email" value={application.email} />
          <Field label="Submitted" value={new Date(application.createdAt).toLocaleString()} />
          <Field label="Address" value={addressLine || null} />
          <Field label="Landmark" value={application.landmark} />
          {application.sponsor && <Field label="Sponsor" value={`${application.sponsor.name} (${application.sponsor.distributorId ?? "—"})`} />}
        </dl>

        {(application.businessName || application.panVatNumber || application.businessType) && (
          <>
            <h2 className="mt-6 text-sm font-semibold text-gray-900">Business Information</h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Business name" value={application.businessName} />
              <Field label="Business type" value={application.businessType} />
              <Field label="PAN / VAT number" value={application.panVatNumber} />
              <Field label="Registration number" value={application.registrationNumber} />
              <Field label="Business phone" value={application.businessPhone} />
              <Field label="Business email" value={application.businessEmail} />
              <Field label="Years in business" value={application.yearsInBusiness} />
              <Field label="Number of employees" value={application.numberOfEmployees} />
              <Field label="Estimated monthly sales" value={application.estimatedMonthlySales ? `Rs ${Number(application.estimatedMonthlySales).toLocaleString()}` : null} />
              <Field label="Business address" value={application.businessAddress} />
            </dl>
          </>
        )}

        {application.reason && (
          <>
            <h2 className="mt-6 text-sm font-semibold text-gray-900">Reason for applying</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{application.reason}</p>
          </>
        )}

        {application.status === "APPROVED" && application.distributorId && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Distributor ID</dt>
            <dd className="mt-1 text-lg font-bold tracking-wide text-slate-800">{application.distributorId}</dd>
          </div>
        )}
        {application.status === "REJECTED" && application.rejectionReason && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Rejection reason</dt>
            <dd className="mt-1 text-sm text-gray-700">{application.rejectionReason}</dd>
          </div>
        )}
        {application.reviewedBy && (
          <div className="mt-4">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Reviewed by</dt>
            <dd className="mt-1 text-sm text-gray-700">
              {application.reviewedBy.name} · {application.reviewedAt && new Date(application.reviewedAt).toLocaleString()}
            </dd>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {application.status === "PENDING" && (
          <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5">
            {showRejectForm ? (
              <div className="flex flex-col gap-2">
                <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Reason for rejection (required)" rows={3} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                <div className="flex gap-2">
                  <Button variant="adminOutline" onClick={() => setShowRejectForm(false)} disabled={isBusy}>
                    Cancel
                  </Button>
                  <Button variant="admin" onClick={reject} isLoading={isBusy}>
                    Confirm Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="admin" onClick={approve} isLoading={isBusy}>
                  Approve
                </Button>
                <Button variant="adminOutline" onClick={() => setShowRejectForm(true)} disabled={isBusy}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
