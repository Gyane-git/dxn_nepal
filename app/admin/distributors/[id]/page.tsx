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
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  distributorId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: number; name: string; email: string; phone: string | null; createdAt: string };
  reviewedBy: { id: number; name: string } | null;
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
  if (!application) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <button type="button" onClick={() => router.push("/admin/distributors")} className="text-sm text-slate-600 hover:underline">
        ← Back to Distributors
      </button>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Distributor Application</h1>
        <StatusBadge status={application.status} />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Applicant</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{application.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Account</dt>
            <dd className="mt-1 text-sm text-gray-700">
              <Link href={`/admin/orders?search=${encodeURIComponent(application.user.email)}`} className="hover:underline">
                {application.user.email}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Phone</dt>
            <dd className="mt-1 text-sm text-gray-700">{application.phone || application.user.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Submitted</dt>
            <dd className="mt-1 text-sm text-gray-700">{new Date(application.createdAt).toLocaleString()}</dd>
          </div>
          {application.reason && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Reason for applying</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{application.reason}</dd>
            </div>
          )}
          {application.status === "APPROVED" && application.distributorId && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Distributor ID</dt>
              <dd className="mt-1 text-lg font-bold tracking-wide text-slate-800">{application.distributorId}</dd>
            </div>
          )}
          {application.status === "REJECTED" && application.rejectionReason && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Rejection reason</dt>
              <dd className="mt-1 text-sm text-gray-700">{application.rejectionReason}</dd>
            </div>
          )}
          {application.reviewedBy && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Reviewed by</dt>
              <dd className="mt-1 text-sm text-gray-700">
                {application.reviewedBy.name} · {application.reviewedAt && new Date(application.reviewedAt).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {application.status === "PENDING" && (
          <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5">
            {showRejectForm ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  rows={3}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
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
