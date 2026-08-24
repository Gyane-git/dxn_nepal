"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice, formatDate } from "@/lib/format";

interface DealerOrder {
  id: number;
  orderNumber: string;
  status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED";
  placedAt: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  trackingNumber: string | null;
  courierName: string | null;
  items: { id: number; name: string; quantity: number; price: number }[];
}

const TABS: { label: string; value: DealerOrder["status"] | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
];

export default function DealerOrdersPage() {
  const [orders, setOrders] = useState<DealerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<DealerOrder["status"] | "ALL">("ALL");
  const [shipTarget, setShipTarget] = useState<DealerOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (tab !== "ALL") params.set("status", tab);
    fetch(`/api/dealer/orders?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => setOrders(json.data?.orders ?? []))
      .finally(() => setIsLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitShip() {
    if (!shipTarget) return;
    if (!trackingNumber.trim() || !courierName.trim()) {
      setError("Tracking number and courier name are both required");
      return;
    }
    setIsSaving(true);
    setError(null);
    const res = await fetch(`/api/dealer/orders/${shipTarget.id}/ship`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingNumber, courierName }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to update order");
      return;
    }
    setShipTarget(null);
    setTrackingNumber("");
    setCourierName("");
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orders Assigned to You</h1>
      <p className="mt-1 text-sm text-gray-500">Orders customers have routed to you for fulfillment as a dealer.</p>

      <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-8 text-center text-sm text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white p-16 text-center text-gray-500">
          No orders here yet.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{formatDate(order.placedAt)}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Deliver to</p>
                  <p className="mt-1 text-gray-800">{order.fullName}</p>
                  <p className="text-gray-600">
                    {order.line1}
                    {order.line2 ? `, ${order.line2}` : ""}, {order.city}
                  </p>
                  <p className="text-gray-500">{order.phone}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Items</p>
                  <ul className="mt-1 space-y-0.5 text-gray-700">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.name} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
                <div className="text-gray-600">
                  Total <span className="font-semibold text-gray-900">{formatPrice(order.total)}</span>
                  {" · "}
                  {order.paymentMethod === "COD" ? "Cash on Delivery" : `Paid online (${order.paymentStatus})`}
                </div>
                {order.status === "PROCESSING" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setShipTarget(order);
                      setTrackingNumber("");
                      setCourierName("");
                      setError(null);
                    }}
                  >
                    Mark Shipped
                  </Button>
                ) : order.trackingNumber ? (
                  <span className="text-xs text-gray-400">
                    Shipped via {order.courierName} · {order.trackingNumber}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {shipTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-soft-lg">
            <h3 className="text-base font-semibold text-gray-900">Mark {shipTarget.orderNumber} as shipped</h3>
            <div className="mt-4 flex flex-col gap-3">
              <Input label="Courier name" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
              <Input label="Tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="mt-2 flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShipTarget(null)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" isLoading={isSaving} onClick={submitShip}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
