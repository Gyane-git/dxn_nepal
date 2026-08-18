"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";

interface Application {
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

interface Props {
  role: "USER" | "ADMIN" | "DISTRIBUTOR";
  distributorId: string | null;
  pvBalance: number;
}

export function DistributorStatusCard({ role, distributorId, pvBalance }: Props) {
  const [application, setApplication] = useState<Application | null | undefined>(undefined);

  useEffect(() => {
    if (role !== "USER") return;
    fetch("/api/distributor-applications/me")
      .then((res) => res.json())
      .then((json) => setApplication(json.data ?? null));
  }, [role]);

  if (role === "DISTRIBUTOR") {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Award className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Distributor ID</p>
            <p className="text-lg font-bold tracking-wide text-gray-900">{distributorId}</p>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">PV Balance</p>
          <p className="text-lg font-bold text-gray-900">{pvBalance} PV</p>
        </div>
      </div>
    );
  }

  if (role !== "USER" || application === undefined) return null;

  if (application?.status === "PENDING") {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Your distributor application is <strong>pending review</strong>. We&apos;ll notify you once it&apos;s been reviewed.
      </div>
    );
  }

  if (application?.status === "REJECTED") {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-soft">
        <p className="text-sm text-gray-600">Your previous distributor application was not approved.</p>
        <Link href="/distributor" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
          Apply again <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/distributor"
      className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-soft transition-colors hover:border-primary-200"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <Award className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Become a Distributor</p>
          <p className="text-xs text-gray-500">Unlock distributor pricing and PV rewards</p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-400" />
    </Link>
  );
}
