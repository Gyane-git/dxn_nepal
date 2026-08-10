"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "@/components/orders/ReviewForm";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { ProductImage } from "@/components/product/ProductImage";
import { formatPrice, formatDate } from "@/lib/format";

interface OrderItem {
  id: string;
  productId: string;
  productSlug: string | null;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  reviewed: boolean;
}

interface HistoryEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED";
  placedAt: string;
  total: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  trackingNumber: string | null;
  courierName: string | null;
  returnRequested: boolean;
  returnReason: string | null;
  refunded: boolean;
  items: OrderItem[];
  history: HistoryEntry[];
}

export function OrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cancelNote = [...order.history].reverse().find((h) => h.status === "CANCELLED")?.note;

  async function handleCancel() {
    if (!confirm("Cancel this order?")) return;
    const reason = prompt("Reason for cancelling (optional):") ?? "";
    setIsSubmitting(true);
    setError(null);
    const res = await fetch(`/api/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setError(json.message ?? "Could not cancel order");
      return;
    }
    onChanged();
  }

  async function handleRequestReturn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const res = await fetch(`/api/orders/${order.id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: returnReason }),
    });
    const json = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setError(json.message ?? "Could not submit return request");
      return;
    }
    setShowReturnForm(false);
    onChanged();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{order.orderNumber}</p>
          <p className="text-xs text-gray-500">Placed {formatDate(order.placedAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <ul className="mt-4 divide-y divide-gray-50 text-sm">
        {order.items.map((item) =>
          item.productSlug ? (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <Link href={`/product/${item.productSlug}`} className="shrink-0 w-12">
                <ProductImage src={item.image} alt={item.name} />
              </Link>
              <Link href={`/product/${item.productSlug}`} className="min-w-0 flex-1 truncate text-gray-800 hover:text-primary-600">
                {item.name} × {item.quantity}
              </Link>
              <span className="shrink-0 text-gray-600">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ) : (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="shrink-0 w-12">
                <ProductImage src={item.image} alt={item.name} />
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-500">{item.name} × {item.quantity}</span>
              <span className="shrink-0 text-gray-600">{formatPrice(item.price * item.quantity)}</span>
            </li>
          )
        )}
      </ul>

      <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatPrice(order.total)}</span>
      </div>

      <a
        href={`/api/orders/${order.id}/invoice`}
        className="mt-3 inline-block text-xs font-medium text-primary-600 hover:underline"
      >
        Download Invoice
      </a>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {order.status === "PROCESSING" && (
          <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleCancel}>
            Cancel Order
          </Button>
        )}

        {order.status === "SHIPPED" && (
          <div className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
            {order.courierName || order.trackingNumber
              ? `Shipped via ${order.courierName ?? "courier"}${order.trackingNumber ? ` — Tracking #${order.trackingNumber}` : ""}`
              : "Preparing for dispatch"}
          </div>
        )}

        {order.status === "DELIVERED" && (
          <div className="space-y-3">
            {order.items
              .filter((item) => !item.reviewed)
              .map((item) => (
                <div key={item.id}>
                  {reviewingItemId === item.id ? (
                    <ReviewForm
                      orderItemId={item.id}
                      onSubmitted={() => {
                        setReviewingItemId(null);
                        onChanged();
                      }}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewingItemId(item.id)}
                    >
                      Leave a Review for &quot;{item.name}&quot;
                    </Button>
                  )}
                </div>
              ))}

            {order.returnRequested ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Return requested — pending admin review.
              </p>
            ) : showReturnForm ? (
              <form onSubmit={handleRequestReturn} className="space-y-2 rounded-lg border border-gray-200 p-3">
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Why are you returning this order?"
                  rows={2}
                  required
                  minLength={5}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-primary-400"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" isLoading={isSubmitting}>
                    Submit Request
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowReturnForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowReturnForm(true)}>
                Request Return
              </Button>
            )}
          </div>
        )}

        {order.status === "RETURNED" && (
          <div className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
            {order.returnReason && <p>Reason: {order.returnReason}</p>}
            <p>{order.refunded ? "Refund processed." : "Refund pending."}</p>
          </div>
        )}

        {order.status === "CANCELLED" && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {cancelNote && <p>Reason: {cancelNote}</p>}
            {order.paymentStatus === "PAID" && <p>{order.refunded ? "Refund processed." : "Refund pending."}</p>}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowTimeline((v) => !v)}
        className="mt-4 text-xs font-medium text-primary-600 hover:underline"
      >
        {showTimeline ? "Hide" : "View"} order timeline
      </button>
      {showTimeline && (
        <div className="mt-3">
          <OrderStatusTimeline history={order.history} />
        </div>
      )}
    </div>
  );
}
