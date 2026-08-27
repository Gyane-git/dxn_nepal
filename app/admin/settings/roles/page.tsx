"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { usePermissions } from "@/providers/PermissionsProvider";

interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  isSuperAdmin: boolean;
  isSystem: boolean;
  createdAt: string;
  _count: { users: number; permissions: number };
}

const PAGE_SIZE = 20;

export default function RolesPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<RoleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    fetch(`/api/admin/roles?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.data?.roles ?? []);
        setTotal(json.data?.total ?? 0);
      })
      .finally(() => setIsLoading(false));
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsBusy(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/roles/${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    setIsBusy(false);
    if (!res.ok) {
      setDeleteError(json.message ?? "Could not delete role");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-500">Control which admin modules, pages and actions each role can access.</p>
        </div>
        {can("roles.create") && (
          <Link href="/admin/settings/roles/new">
            <Button variant="admin" size="sm">New Role</Button>
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search roles..." className="w-full sm:w-64" />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-soft">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-soft">No roles found.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Role Name</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Users</th>
                    <th className="px-4 py-3">Permissions</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/settings/roles/${r.id}`} className="font-medium text-gray-900 hover:text-slate-600">
                          {r.name}
                        </Link>
                        {r.isSuperAdmin && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            System
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-gray-500">{r.description ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{r._count.users}</td>
                      <td className="px-4 py-3 text-gray-500">{r.isSuperAdmin ? "All" : r._count.permissions}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {can("roles.edit") && (
                            <Link
                              href={`/admin/settings/roles/${r.id}`}
                              title="View / Manage Permissions"
                              aria-label="Edit"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-slate-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {!r.isSystem && can("roles.delete") && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(r)}
                              title="Delete role"
                              aria-label="Delete"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
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
            <div className="px-2">
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name}"?`}
        description={deleteError ?? "This cannot be undone. Roles that still have users assigned cannot be deleted."}
        confirmLabel="Delete role"
        danger
        isBusy={isBusy}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
      />
    </div>
  );
}
