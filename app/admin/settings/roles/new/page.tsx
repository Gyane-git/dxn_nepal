"use client";

import { RoleForm, EMPTY_ROLE, type RoleFormValues } from "@/components/admin/roles/RoleForm";

export default function NewRolePage() {
  async function handleSubmit(values: RoleFormValues) {
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description, permissions: values.permissions }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, message: json.message };
    return { ok: true };
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Role</h1>
      <p className="mt-1 text-sm text-gray-500">Create a custom role and choose which modules and actions it can access.</p>
      <div className="mt-6">
        <RoleForm initial={EMPTY_ROLE} onSubmit={handleSubmit} submitLabel="Create role" />
      </div>
    </div>
  );
}
