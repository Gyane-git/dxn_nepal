"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewAdminUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [adminRoleId, setAdminRoleId] = useState("");
  const [dealerId, setDealerId] = useState("");
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

  const selectedRoleName = roles.find((r) => String(r.id) === adminRoleId)?.name ?? "";
  const showDealerField = selectedRoleName.toLowerCase().includes("dealer");
  const availableDealers = dealers.filter((d) => d.user == null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !email || !password) {
      setError("Name, email and password are required");
      return;
    }
    setIsSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        password,
        adminRoleId: adminRoleId ? Number(adminRoleId) : null,
        dealerId: showDealerField && dealerId ? Number(dealerId) : null,
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">New User</h1>
      <p className="mt-1 text-sm text-gray-500">Create an admin-panel account and assign it a role.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Role</label>
          <select
            value={adminRoleId}
            onChange={(e) => setAdminRoleId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">Select a role...</option>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" variant="admin" isLoading={isSaving} className="flex-1">
            Create user
          </Button>
          <Button type="button" variant="adminOutline" onClick={() => router.push("/admin/users")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
