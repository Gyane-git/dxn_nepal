"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function NewDealerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [shippingCharge, setShippingCharge] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Dealer name is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    const res = await fetch("/api/admin/dealers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        shippingCharge: Number(shippingCharge) || 0,
      }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to create dealer");
      return;
    }
    router.push(`/admin/dealers/${json.data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Dealer</h1>
      <p className="mt-1 text-sm text-gray-500">Add a dealer to fulfill orders in one or more cities.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <Input label="Dealer name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input
          label="Default shipping charge (Rs)"
          type="number"
          min={0}
          value={shippingCharge}
          onChange={(e) => setShippingCharge(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="admin" isLoading={isSaving}>Create Dealer</Button>
      </form>
    </div>
  );
}
