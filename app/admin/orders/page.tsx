"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { OrderFilterBar, EMPTY_FILTERS, type OrderFilters } from "@/components/admin/OrderFilterBar";
import { formatPrice, formatDate } from "@/lib/format";
import { usePermissions } from "@/providers/PermissionsProvider";

interface AdminOrderRow {
  id: string;
  orderNumber: string;
  fullName: string;
  email: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  itemCount: number;
  placedAt: string;
  dealer: { id: number; name: string; salesCenterCode: string | null } | null;
  omsSyncStatus: "PENDING" | "SUCCESS" | "FAILED";
  omsSyncError: string | null;
}

interface DealerOption {
  id: number;
  name: string;
  salesCenterCode: string | null;
}

function orderAge(placedAt: string) {
  const elapsedMs = Date.now() - new Date(placedAt).getTime();
  const days = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  return days === 0 ? "today" : `${days}d ago`;
}

function TransferOrderButton({ order, onTransferred }: { order: AdminOrderRow; onTransferred: () => void }) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [dealerId, setDealerId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!can("orders.transfer") || order.status !== "PROCESSING" || order.omsSyncStatus === "SUCCESS") return <span className="text-xs text-gray-400">—</span>;

  async function openTransfer() {
    setOpen(true);
    setError(null);
    const res = await fetch("/api/admin/orders/dealers");
    const json = await res.json();
    if (!res.ok) return setError(json.message ?? "Unable to load dealers");
    setDealers(json.data ?? []);
  }

  async function transfer() {
    if (!dealerId) return setError("Select a dealer branch");
    setIsSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/orders/${order.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId: Number(dealerId) }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) return setError(json.message ?? "Transfer failed");
    setOpen(false);
    onTransferred();
  }

  return (
    <>
      <Button variant="adminOutline" size="sm" onClick={openTransfer}>Transfer</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Transfer order</h2>
            <p className="mt-1 text-sm text-gray-500">Move {order.orderNumber} to another dealer. Stock is checked before the transfer.</p>
            <select value={dealerId} onChange={(e) => setDealerId(e.target.value)} className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Select dealer branch</option>
              {dealers.filter((d) => d.id !== order.dealer?.id).map((d) => <option key={d.id} value={d.id}>{d.name}{d.salesCenterCode ? ` (${d.salesCenterCode})` : ""}</option>)}
            </select>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="adminOutline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="admin" size="sm" isLoading={isSaving} onClick={transfer}>Transfer order</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SendOmsButton({ order, onSent }: { order: AdminOrderRow; onSent: () => void }) {
  const { can } = usePermissions();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(order.omsSyncError);
  if (!can("orders.edit")) return <span className="text-xs text-gray-400">—</span>;
  if (order.omsSyncStatus === "SUCCESS") return <span className="text-xs font-medium text-emerald-700">Success</span>;

  async function send() {
    setIsSending(true);
    setError(null);
    const res = await fetch(`/api/admin/orders/${order.id}/send-oms`, { method: "POST" });
    const json = await res.json();
    setIsSending(false);
    if (!res.ok) return setError(json.message ?? "OMS send failed");
    onSent();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="adminOutline" size="sm" isLoading={isSending} onClick={send}>{order.omsSyncStatus === "FAILED" ? "Retry OMS" : "Send to OMS"}</Button>
      {error && <p className="max-w-64 break-words text-xs leading-5 text-red-600">OMS error: {error}</p>}
    </div>
  );
}

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const pageSize = 20;

  function loadOrders() {
    setFilters((current) => ({ ...current }));
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
      if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
      if (filters.dealerId) params.set("dealerId", filters.dealerId);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.search) params.set("search", filters.search);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      fetch(`/api/admin/orders?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          setOrders(json.data?.orders ?? []);
          setTotal(json.data?.total ?? 0);
          setIsLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, page]);

  useEffect(() => {
    fetch("/api/admin/dealers?pageSize=100")
      .then((res) => res.json())
      .then((json) => setDealers(json.data?.dealers ?? []));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function paymentMethodLabel(method: string) {
    return method === "COD" ? "COD" : "eSewa";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Manage Orders</h1>

      <div className="mt-5">
        <OrderFilterBar
          filters={filters}
          dealers={dealers}
          onChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-soft">
          Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-soft">
          No orders found.
        </div>
      ) : (
        <>
          {/* Card list — small screens */}
          <div className="mt-5 space-y-3 md:hidden">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-soft transition-shadow hover:shadow-soft-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-sm text-gray-800">{order.fullName}</p>
                <p className="text-xs text-gray-500">{order.email}</p>
                <p className="mt-1 text-xs text-gray-500">Branch: {order.dealer?.name ?? "Unassigned"}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {formatDate(order.placedAt)} ({orderAge(order.placedAt)}) · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                  </span>
                  <span className="font-semibold text-gray-900">{formatPrice(order.total)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={order.paymentStatus} />
                  <span className="text-xs text-gray-500">{paymentMethodLabel(order.paymentMethod)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Table — medium screens and up */}
          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-soft md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">OMS</th>
                  <th className="px-4 py-3">Transfer</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-sky-600 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{order.fullName}</p>
                      <p className="text-xs text-gray-500">{order.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(order.placedAt)} <span className="text-xs text-gray-400">({orderAge(order.placedAt)})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{order.itemCount}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(order.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.paymentStatus} />{" "}
                      <span className="text-xs text-gray-500">{paymentMethodLabel(order.paymentMethod)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.dealer ? (
                        <>
                          {order.dealer.name}
                          {order.dealer.salesCenterCode && <span className="block text-xs text-gray-400">{order.dealer.salesCenterCode}</span>}
                        </>
                      ) : "Unassigned"}
                    </td>
                    <td className="px-4 py-3"><SendOmsButton order={order} onSent={loadOrders} /></td>
                    <td className="px-4 py-3"><TransferOrderButton order={order} onTransferred={loadOrders} /></td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-gray-600 sm:flex-row">
        <span>
          Page {page} of {totalPages} · {total} order{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Button variant="adminOutline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="adminOutline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
