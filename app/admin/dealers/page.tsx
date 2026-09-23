"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { usePermissions } from "@/providers/PermissionsProvider";

interface DealerRow {
  id: number;
  name: string;
  salesCenterCode: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  shippingCharge: string;
  user: { id: number; name: string; email: string; distributorId: string | null } | null;
  _count: { wardAssignments: number; inventory: number; orders: number };
}

const PAGE_SIZE = 20;

export default function AdminDealersPage() {
  const { dealerId: ownDealerId } = usePermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DealerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    fetch(`/api/admin/dealers?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.data?.dealers ?? []);
        setTotal(json.data?.total ?? 0);
      })
      .finally(() => setIsLoading(false));
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function syncDealers() {
    setIsSyncing(true);
    setSyncMessage(null);
    const res = await fetch("/api/admin/oms/sales-centers/sync", { method: "POST" });
    const json = await res.json();
    setIsSyncing(false);
    if (!res.ok) return setSyncMessage(json.message ?? "OMS dealer sync failed.");
    const data = json.data;
    setSyncMessage(`OMS synced: ${data.createdDealers} added and ${data.updatedDealers} updated.`);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dealers</h1>
          <p className="mt-1 text-sm text-gray-500">Fulfillment points serving one or more cities.</p>
        </div>
        {ownDealerId == null && <Button variant="admin" size="sm" onClick={syncDealers} isLoading={isSyncing}><RefreshCw size={15} /> Sync Dealers</Button>}
      </div>

      {syncMessage && <p className="mt-3 text-sm text-gray-600">{syncMessage}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search dealers..." className="w-full sm:w-64" />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No dealers found.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Dealer</th>
                    <th className="px-4 py-3">Linked Distributor</th>
                    <th className="px-4 py-3">Cities</th>
                    <th className="px-4 py-3">Shipping</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/dealers/${d.id}`} className="font-medium text-gray-900 hover:text-slate-600">
                          {d.name}
                        </Link>
                        <div className="text-xs text-gray-400">{d.salesCenterCode ?? d.phone ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {d.user ? (
                          <>
                            {d.user.name}
                            <div className="text-xs text-gray-400">{d.user.distributorId ?? "—"}</div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Standalone</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{d._count.wardAssignments}</td>
                      <td className="px-4 py-3 text-gray-500">Rs {Number(d.shippingCharge).toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/dealers/${d.id}`} className="font-medium text-slate-600 hover:text-slate-800">
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-gray-100 md:hidden">
              {rows.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link href={`/admin/dealers/${d.id}`} className="text-sm font-medium text-gray-900">{d.name}</Link>
                    <p className="text-xs text-gray-400">{d.salesCenterCode ?? d.user?.distributorId ?? "Standalone"} · {d._count.wardAssignments} cities</p>
                  </div>
                  <StatusBadge status={d.status} />
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
