"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RoleForm, type RoleFormValues } from "@/components/admin/roles/RoleForm";

export default function EditRolePage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<RoleFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/roles/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setNotFound(true);
          return;
        }
        const r = json.data;
        setInitial({
          id: r.id,
          name: r.name,
          description: r.description ?? "",
          permissions: r.permissions,
          isSuperAdmin: r.isSuperAdmin,
        });
      });
  }, [id]);

  async function handleSubmit(values: RoleFormValues) {
    const res = await fetch(`/api/admin/roles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description, permissions: values.permissions }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, message: json.message };
    return { ok: true };
  }

  if (notFound) {
    return <p className="text-sm text-gray-500">Role not found.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Edit Role</h1>
      <p className="mt-1 text-sm text-gray-500">Update this role&apos;s name, description and permissions.</p>
      <div className="mt-6">
        {initial && <RoleForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />}
      </div>
    </div>
  );
}
