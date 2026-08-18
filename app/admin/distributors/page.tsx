"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/admin/Pagination";

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

interface ApplicationRow {
  id: number;
  fullName: string;
  status: ApplicationStatus;
  distributorId: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

const PAGE_SIZE = 20;
const TABS: ApplicationStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export default function AdminDistributorsPage() {
  const [status, setStatus] = useState<ApplicationStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
    fetch(`/api/admin/distributor-applications?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.data?.applications ?? []);
        setTotal(json.data?.total ?? 0);
      })
      .finally(() => setIsLoading(false));
  }, [status, page]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Distributors</h1>
        <p className="mt-1 text-sm text-gray-500">Review distributor applications and manage approved distributors.</p>
      </div>

      <div className="mt-6 flex flex-nowrap gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-soft w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setStatus(t);
              setPage(1);
            }}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              status === t ? "bg-slate-800 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No applications found.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Distributor ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{a.fullName}</div>
                        <div className="text-xs text-gray-400">{a.user.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-600">{a.distributorId ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/distributors/${a.id}`}
                          className="font-medium text-slate-600 hover:text-slate-800"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-gray-100 md:hidden">
              {rows.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.fullName}</p>
                      <p className="text-xs text-gray-400">{a.user.email}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                    <Link href={`/admin/distributors/${a.id}`} className="text-sm font-medium text-slate-600">
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-2">
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
