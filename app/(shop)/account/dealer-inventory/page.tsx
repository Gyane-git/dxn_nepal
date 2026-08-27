"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface InventoryItem {
  productId: number;
  name: string;
  sku: string | null;
  image: string | null;
  globalStock: number;
  dealerStock: number;
}

interface Summary {
  assignedCount: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export default function DealerInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [canUpdate, setCanUpdate] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dealer/me")
      .then((res) => res.json())
      .then((json) => setCanUpdate((json.data?.permissions ?? []).includes("dealer_inventory.update")));
  }, []);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/dealer/inventory?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setItems(json.data?.items ?? []);
        setSummary(json.data?.summary ?? null);
      })
      .finally(() => setIsLoading(false));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function saveStock(productId: number) {
    const value = Number(drafts[productId]);
    if (Number.isNaN(value) || value < 0) return;
    setSavingId(productId);
    setError(null);
    const res = await fetch("/api/dealer/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, stock: value }),
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setError(json.message ?? "Failed to update stock");
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Inventory</h1>
      <p className="mt-1 text-sm text-gray-500">Products you&apos;re authorized to sell, and how many units you currently have on hand.</p>

      {summary && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Assigned Products", value: summary.assignedCount },
            { label: "Total Stock", value: summary.totalStock },
            { label: "Low Stock", value: summary.lowStockCount },
            { label: "Out of Stock", value: summary.outOfStockCount },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-soft">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 max-w-xs">
        <Input placeholder="Search your products..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="mt-8 text-center text-sm text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white p-16 text-center text-gray-500">
          No products have been assigned to you yet. Contact the store admin to get products assigned.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">My Stock</th>
                  {canUpdate && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3">
                      {canUpdate ? (
                        <input
                          type="number"
                          min={0}
                          value={drafts[item.productId] ?? item.dealerStock}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary-400"
                        />
                      ) : (
                        <span className="text-gray-900">{item.dealerStock}</span>
                      )}
                    </td>
                    {canUpdate && (
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" isLoading={savingId === item.productId} onClick={() => saveStock(item.productId)}>
                          Save
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
