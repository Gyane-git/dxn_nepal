"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Copy, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { BulkActionBar } from "@/components/admin/BulkActionBar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { usePermissions } from "@/providers/PermissionsProvider";

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "ON_BACKORDER";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured: boolean;
  category: { id: string; name: string };
  brand: { id: string; name: string } | null;
  images: { url: string | null }[];
  _count: { variants: number };
}

interface Option {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [featured, setFeatured] = useState("");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/categories?tree=true").then((res) => res.json()).then((json) => setCategories(json.data?.categories ?? []));
    fetch("/api/admin/brands?pageSize=100").then((res) => res.json()).then((json) => setBrands(json.data?.brands ?? []));
  }, []);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", categoryId);
    if (brandId) params.set("brandId", brandId);
    if (status) params.set("status", status);
    if (stockStatus) params.set("stockStatus", stockStatus);
    if (featured) params.set("featured", featured);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    fetch(`/api/admin/products?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.data?.products ?? []);
        setTotal(json.data?.total ?? 0);
      })
      .finally(() => setIsLoading(false));
  }, [search, categoryId, brandId, status, stockStatus, featured, page]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkAction(action: string) {
    setIsBusy(true);
    await fetch("/api/admin/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), action }),
    });
    setIsBusy(false);
    setSelectedIds(new Set());
    load();
  }

  async function handleDuplicate(id: string) {
    setIsBusy(true);
    await fetch(`/api/admin/products/${id}/duplicate`, { method: "POST" });
    setIsBusy(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsBusy(true);
    await fetch(`/api/admin/products/${deleteTarget}`, { method: "DELETE" });
    setIsBusy(false);
    setDeleteTarget(null);
    load();
  }

  async function syncOms() {
    setIsBusy(true);
    setSyncMessage(null);
    const res = await fetch("/api/admin/oms/sync", { method: "POST" });
    const json = await res.json();
    setIsBusy(false);
    if (!res.ok) {
      setSyncMessage(json.message ?? "OMS sync failed.");
      return;
    }
    const data = json.data;
    setSyncMessage(`OMS synced: ${data.createdProducts} added, ${data.updatedProducts} updated, ${data.createdCategories + data.updatedCategories} categories processed.`);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">Products, prices, stock, and categories are managed by OMS. Images can be updated locally.</p>
        </div>
        <div className="flex gap-2">
          {false && <Link href="/admin/products/trash">
            <Button variant="adminOutline" size="sm">Trash</Button>
          </Link>}
          {can("products.edit") && <Button variant="admin" size="sm" onClick={syncOms} isLoading={isBusy}><RefreshCw size={15} /> Sync OMS Catalog</Button>}
        </div>
      </div>

      {syncMessage && <p className="mt-4 text-sm text-gray-600">{syncMessage}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or SKU..." className="w-full sm:w-64" />
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/* <select value={brandId} onChange={(e) => { setBrandId(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select> */}
        {/* <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select> */}
        {/* <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All stock</option>
          <option value="IN_STOCK">In stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
          <option value="ON_BACKORDER">On backorder</option>
        </select> */}
        {/* <select value={featured} onChange={(e) => { setFeatured(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">Featured & non-featured</option>
          <option value="true">Featured only</option>
        </select> */}
      </div>

      {false && <div className="mt-4">
        <BulkActionBar
          selectedCount={selectedIds.size}
          isBusy={isBusy}
          onClear={() => setSelectedIds(new Set())}
          onAction={handleBulkAction}
          actions={[
            ...(can("products.edit")
              ? [
                  { key: "publish", label: "Publish" },
                  { key: "unpublish", label: "Unpublish" },
                  { key: "archive", label: "Archive" },
                  { key: "feature", label: "Feature" },
                  { key: "unfeature", label: "Unfeature" },
                ]
              : []),
            ...(can("products.delete") ? [{ key: "delete", label: "Delete", variant: "danger" as const }] : []),
          ]}
        />
      </div>}

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No products found.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
  <tr>
    <th className="px-4 py-3 text-left font-semibold text-gray-700">
      Product
    </th>
    <th className="px-4 py-3 text-left font-semibold text-gray-700">
      SKU
    </th>
    <th className="px-4 py-3 text-left font-semibold text-gray-700">
      Category
    </th>
    <th className="px-4 py-3 text-left font-semibold text-gray-700">
      Price
    </th>
    <th className="px-4 py-3 text-left font-semibold text-gray-700">
      Stock
    </th>
    <th className="px-4 py-3 text-left font-semibold text-gray-700">
      Status
    </th>

    <th className="px-4 py-3 text-right font-semibold text-gray-700">
      Actions
    </th>
  </tr>
</thead>

<tbody className="divide-y divide-gray-100">
  {rows.map((p) => (
    <tr key={p.id}>

      {/* Product */}
      <td className="px-4 py-3">
        {can("products.edit") ? (
          <Link
            href={`/admin/products/${p.id}`}
            className="flex items-center gap-3 font-medium text-gray-900 hover:text-slate-600"
          >
            {p.images[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.images[0].url}
                alt={p.name}
                className="h-9 w-9 rounded-lg object-cover"
              />
            )}

            <span className="min-w-0">
              <span className="block truncate">
                {p.name}
              </span>

              <span className="mt-0.5 flex items-center gap-2">
                {p.isFeatured && (
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Featured
                  </span>
                )}

                {p._count.variants > 0 && (
                  <span className="text-xs font-normal text-gray-400">
                    {p._count.variants} variants
                  </span>
                )}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 font-medium text-gray-900">
            {p.images[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.images[0].url}
                alt={p.name}
                className="h-9 w-9 rounded-lg object-cover"
              />
            )}

            <span className="min-w-0">
              <span className="block truncate">
                {p.name}
              </span>

              <span className="mt-0.5 flex items-center gap-2">
                {p.isFeatured && (
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Featured
                  </span>
                )}

                {p._count.variants > 0 && (
                  <span className="text-xs font-normal text-gray-400">
                    {p._count.variants} variants
                  </span>
                )}
              </span>
            </span>
          </div>
        )}
      </td>

      {/* SKU */}
      <td className="px-4 py-3 text-gray-500">
        {p.sku || "-"}
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-gray-500">
        {p.category?.name || "-"}
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-gray-700">
        Rs {p.price?.toLocaleString() || "0"}
      </td>

      {/* Stock */}
      <td className="px-4 py-3 text-gray-500">
        {p.stock ?? 0}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={p.status} />
      </td>



      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {can("products.edit") && (
            <Link
              href={`/admin/products/${p.id}`}
              title="Edit"
              aria-label="Edit"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}

          {false && can("products.create") && (
            <button
              type="button"
              onClick={() => handleDuplicate(p.id)}
              title="Duplicate"
              aria-label="Duplicate"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-slate-700"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}

          {false && can("products.delete") && (
            <button
              type="button"
              onClick={() => setDeleteTarget(p.id)}
              title="Move to trash"
              aria-label="Move to trash"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>


    </tr>
  ))}
</tbody>

              </table>
            </div>
            <ul className="divide-y divide-gray-100 md:hidden">
              {rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {false && <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="h-4 w-4 shrink-0 rounded border-gray-300" />}
                  {can("products.edit") ? (
                    <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{p.name}</Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{p.name}</span>
                  )}
                  <StatusBadge status={p.status} />
                  {can("products.edit") && (
                    <Link href={`/admin/products/${p.id}`} title="Edit" aria-label="Edit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  )}
                  {false && can("products.create") && (
                    <button type="button" onClick={() => handleDuplicate(p.id)} title="Duplicate" aria-label="Duplicate" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  {false && can("products.delete") && (
                    <button type="button" onClick={() => setDeleteTarget(p.id)} title="Move to trash" aria-label="Move to trash" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="px-2">
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Move product to trash?"
        description="You can restore it later from the trash."
        confirmLabel="Move to trash"
        danger
        isBusy={isBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
