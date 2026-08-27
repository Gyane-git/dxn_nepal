"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PERMISSION_MODULES } from "@/lib/permissions";

export interface RoleFormValues {
  id?: number;
  name: string;
  description: string;
  permissions: string[];
  isSuperAdmin?: boolean;
}

export const EMPTY_ROLE: RoleFormValues = { name: "", description: "", permissions: [] };

interface RoleFormProps {
  initial: RoleFormValues;
  onSubmit: (values: RoleFormValues) => Promise<{ ok: boolean; message?: string }>;
  submitLabel: string;
}

export function RoleForm({ initial, onSubmit, submitLabel }: RoleFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<RoleFormValues>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const permissionSet = new Set(values.permissions);
  const readOnly = Boolean(values.isSuperAdmin);

  function set<K extends keyof RoleFormValues>(key: K, value: RoleFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function togglePermission(key: string) {
    setValues((v) => {
      const next = new Set(v.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...v, permissions: Array.from(next) };
    });
  }

  function toggleModule(moduleKeys: string[], select: boolean) {
    setValues((v) => {
      const next = new Set(v.permissions);
      moduleKeys.forEach((k) => (select ? next.add(k) : next.delete(k)));
      return { ...v, permissions: Array.from(next) };
    });
  }

  function selectAll(select: boolean) {
    const all = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.key));
    setValues((v) => ({ ...v, permissions: select ? all : [] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }
    router.push("/admin/settings/roles");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Role name" value={values.name} onChange={(e) => set("name", e.target.value)} required disabled={readOnly} />
          <Input
            label="Description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={readOnly}
          />
        </div>
        {readOnly && (
          <p className="mt-3 text-xs text-amber-600">
            The Super Admin role always has full access and cannot be edited.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions</h2>
          {!readOnly && (
            <div className="flex gap-2">
              <Button type="button" variant="adminOutline" size="sm" onClick={() => selectAll(true)}>
                Select All
              </Button>
              <Button type="button" variant="adminOutline" size="sm" onClick={() => selectAll(false)}>
                Deselect All
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col divide-y divide-gray-100">
          {PERMISSION_MODULES.map((mod) => {
            const moduleKeys = mod.permissions.map((p) => p.key);
            const allSelected = moduleKeys.every((k) => permissionSet.has(k));
            return (
              <div key={mod.module} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">{mod.label}</h3>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => toggleModule(moduleKeys, !allSelected)}
                      className="text-xs font-medium text-slate-600 hover:underline"
                    >
                      {allSelected ? "Deselect module" : "Select module"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {mod.permissions.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={readOnly || permissionSet.has(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        disabled={readOnly}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" variant="admin" isLoading={isSubmitting} disabled={readOnly} className="sm:flex-none">
          {submitLabel}
        </Button>
        <Button type="button" variant="adminOutline" onClick={() => router.push("/admin/settings/roles")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
