"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface RoleOption {
  id: number;
  name: string;
}

interface DealerOption {
  id: number;
  name: string;
  user: { id: number } | null;
}

export default function EditAdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [adminRoleId, setAdminRoleId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/roles?pageSize=100")
      .then((res) => res.json())
      .then((json) => setRoles(json.data?.roles ?? []));
    fetch("/api/admin/dealers?pageSize=200")
      .then((res) => res.json())
      .then((json) => setDealers(json.data?.dealers ?? []));
  }, []);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setNotFound(true);
          return;
        }
        const u = json.data;
        setEmail(u.email);
        setName(u.name);
        setPhone(u.phone ?? "");
        setAdminRoleId(u.adminRoleId ? String(u.adminRoleId) : "");
        setDealerId(u.dealer?.id ? String(u.dealer.id) : "");
        setStatus(u.status);
      });
  }, [id]);

  const selectedRoleName = roles.find((r) => String(r.id) === adminRoleId)?.name ?? "";
  const showDealerField = selectedRoleName.toLowerCase().includes("dealer") || dealerId !== "";
  const availableDealers = dealers.filter((d) => d.user == null || String(d.user.id) === id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        adminRoleId: adminRoleId ? Number(adminRoleId) : null,
        status,
        password: password || undefined,
        dealerId: dealerId ? Number(dealerId) : null,
      }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Something went wrong");
      return;
    }
    router.push("/admin/users");
  }

  if (notFound) {
    return <p className="text-sm text-gray-500">User not found.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Edit User</h1>
      <p className="mt-1 text-sm text-gray-500">Update this admin user&apos;s details, role and status.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <Input label="Email" value={email} disabled />
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="New password (leave blank to keep current)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Role</label>
          <select
            value={adminRoleId}
            onChange={(e) => setAdminRoleId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">Super Admin (unrestricted)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {showDealerField && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Linked Dealer (optional)</label>
            <select
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="">Not linked to a dealer</option>
              {availableDealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Only select this if this login should operate as one of your existing dealers — they&apos;ll then see only
              that dealer&apos;s assigned products, stock and orders in their dealer dashboard, never anyone else&apos;s.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DISABLED")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" variant="admin" isLoading={isSaving} className="flex-1">
            Save changes
          </Button>
          <Button type="button" variant="adminOutline" onClick={() => router.push("/admin/users")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
