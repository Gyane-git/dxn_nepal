"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/admin/SearchInput";
import { useAddressBookTree } from "@/hooks/useAddressBookTree";
import { usePermissions } from "@/providers/PermissionsProvider";

/** Sentinel wardNo meaning "the whole city" — see lib/ward.ts CITYWIDE_WARD_NO. Kept as a plain
 * client-side constant here rather than importing the server-only lib, which pulls in Prisma. */
const CITYWIDE_WARD_NO = 0;

interface DealerDetail {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  shippingCharge: string;
  status: "ACTIVE" | "INACTIVE";
  user: { id: number; name: string; email: string; distributorId: string | null } | null;
  wardAssignments: {
    id: number;
    priority: number;
    ward: { id: number; wardNo: number; municipality: { id: number; name: string } };
  }[];
  shippingCharges: {
    id: number;
    charge: string;
    isActive: boolean;
    ward: { id: number; wardNo: number; municipality: { id: number; name: string } };
  }[];
  _count: { inventory: number; orders: number };
}

type Tab = "details" | "cities" | "shipping" | "inventory";

export default function AdminDealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dealerId: ownDealerId, loading: permissionsLoading } = usePermissions();
  const [dealer, setDealer] = useState<DealerDetail | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [notFound, setNotFound] = useState(false);

  // A dealer viewing their own profile only ever manages their inventory quantities — never
  // their own business details/cities/shipping, and never any other dealer.
  const isSelfService = !permissionsLoading && ownDealerId != null && String(ownDealerId) === id;

  const load = useCallback(() => {
    fetch(`/api/admin/dealers/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) return setNotFound(true);
        setDealer(json.data);
      });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isSelfService) setTab("inventory");
  }, [isSelfService]);

  if (notFound) return <p className="text-sm text-gray-500">Dealer not found.</p>;
  if (!dealer) return <p className="text-sm text-gray-500">Loading...</p>;

  const TABS: { key: Tab; label: string }[] = isSelfService
    ? [{ key: "inventory", label: `Inventory (${dealer._count.inventory})` }]
    : [
        { key: "details", label: "Details" },
        { key: "cities", label: `Cities (${dealer.wardAssignments.length})` },
        { key: "shipping", label: "Shipping" },
        { key: "inventory", label: `Inventory (${dealer._count.inventory})` },
      ];

  return (
    <div className="max-w-4xl">
      <button type="button" onClick={() => router.push("/admin/dealers")} className="text-sm text-slate-600 hover:underline">
        ← Back to Dealers
      </button>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{dealer.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {dealer.user ? `${dealer.user.name} · ${dealer.user.distributorId} · ` : "Standalone · "}
            {dealer._count.orders} orders fulfilled
          </p>
        </div>
        <StatusBadge status={dealer.status} />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-soft w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-slate-800 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "details" && <DetailsTab dealer={dealer} onSaved={load} />}
        {tab === "cities" && <CitiesTab dealer={dealer} onChanged={load} />}
        {tab === "shipping" && <ShippingTab dealer={dealer} onChanged={load} />}
        {tab === "inventory" && <InventoryTab dealerId={dealer.id} canAssign={!isSelfService} />}
      </div>
    </div>
  );
}

function DetailsTab({ dealer, onSaved }: { dealer: DealerDetail; onSaved: () => void }) {
  const [name, setName] = useState(dealer.name);
  const [phone, setPhone] = useState(dealer.phone ?? "");
  const [email, setEmail] = useState(dealer.email ?? "");
  const [address, setAddress] = useState(dealer.address ?? "");
  const [shippingCharge, setShippingCharge] = useState(String(dealer.shippingCharge));
  const [status, setStatus] = useState(dealer.status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/dealers/${dealer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, address, shippingCharge: Number(shippingCharge) || 0, status }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-soft sm:max-w-lg">
      <Input label="Dealer name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Input label="Default shipping charge (Rs)" type="number" min={0} value={shippingCharge} onChange={(e) => setShippingCharge(e.target.value)} />
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </Select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button variant="admin" isLoading={isSaving} onClick={save} className="w-fit">Save Changes</Button>
    </div>
  );
}

function CitiesTab({ dealer, onChanged }: { dealer: DealerDetail; onChanged: () => void }) {
  const tree = useAddressBookTree();
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [municipalityId, setMunicipalityId] = useState<number | null>(null);
  const [wardNo, setWardNo] = useState<number>(CITYWIDE_WARD_NO);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const districts = useMemo(() => tree?.provinces.find((p) => p.id === provinceId)?.districts ?? [], [tree, provinceId]);
  const municipalities = useMemo(() => districts.find((d) => d.id === districtId)?.municipalities ?? [], [districts, districtId]);
  const selectedMunicipality = municipalities.find((m) => m.id === municipalityId);
  const wardOptions = selectedMunicipality ? Array.from({ length: selectedMunicipality.wardCount }, (_, i) => i + 1) : [];

  async function assignCity() {
    if (!municipalityId) {
      setError("Select a city");
      return;
    }
    setIsSaving(true);
    setError(null);
    const res = await fetch("/api/admin/ward-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ municipalityId, wardNo, dealerId: dealer.id, priority: 1 }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to assign");
      return;
    }
    setProvinceId(null);
    setDistrictId(null);
    setMunicipalityId(null);
    setWardNo(CITYWIDE_WARD_NO);
    onChanged();
  }

  async function unassign(assignmentId: number) {
    await fetch(`/api/admin/ward-assignments/${assignmentId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-gray-900">Cities / wards served</h3>
        {dealer.wardAssignments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Not assigned to any city or ward yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {dealer.wardAssignments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                {a.ward.wardNo === CITYWIDE_WARD_NO ? `${a.ward.municipality.name} (Entire city)` : `${a.ward.municipality.name} (Ward ${a.ward.wardNo})`}
                <button type="button" onClick={() => unassign(a.id)} className="text-slate-400 hover:text-red-600" aria-label="Remove">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-gray-900">Assign to a city or ward</h3>
        <p className="mt-1 text-xs text-gray-500">
          A city has many wards — assign this dealer to one specific ward (so multiple dealers can
          each cover a different part of the same city) or to the entire city at once.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Select label="Province" disabled={!tree} value={provinceId ?? ""} onChange={(e) => { setProvinceId(Number(e.target.value) || null); setDistrictId(null); setMunicipalityId(null); setWardNo(CITYWIDE_WARD_NO); }}>
            <option value="">Select province</option>
            {tree?.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="District" disabled={!provinceId} value={districtId ?? ""} onChange={(e) => { setDistrictId(Number(e.target.value) || null); setMunicipalityId(null); setWardNo(CITYWIDE_WARD_NO); }}>
            <option value="">Select district</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select label="City" disabled={!districtId} value={municipalityId ?? ""} onChange={(e) => { setMunicipalityId(Number(e.target.value) || null); setWardNo(CITYWIDE_WARD_NO); }}>
            <option value="">Select city</option>
            {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select label="Ward" disabled={!selectedMunicipality} value={wardNo} onChange={(e) => setWardNo(Number(e.target.value))}>
            <option value={CITYWIDE_WARD_NO}>Entire city</option>
            {wardOptions.map((w) => <option key={w} value={w}>Ward {w}</option>)}
          </Select>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button variant="admin" size="sm" className="mt-3" isLoading={isSaving} onClick={assignCity}>Assign</Button>
      </div>
    </div>
  );
}

function ShippingTab({ dealer, onChanged }: { dealer: DealerDetail; onChanged: () => void }) {
  const tree = useAddressBookTree();
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [municipalityId, setMunicipalityId] = useState<number | null>(null);
  const [wardNo, setWardNo] = useState<number>(CITYWIDE_WARD_NO);
  const [charge, setCharge] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const districts = useMemo(() => tree?.provinces.find((p) => p.id === provinceId)?.districts ?? [], [tree, provinceId]);
  const municipalities = useMemo(() => districts.find((d) => d.id === districtId)?.municipalities ?? [], [districts, districtId]);
  const selectedMunicipality = municipalities.find((m) => m.id === municipalityId);
  const wardOptions = selectedMunicipality ? Array.from({ length: selectedMunicipality.wardCount }, (_, i) => i + 1) : [];

  async function addOverride() {
    if (!municipalityId) {
      setError("Select a city");
      return;
    }
    setIsSaving(true);
    setError(null);
    const res = await fetch("/api/admin/dealer-shipping-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId: dealer.id, municipalityId, wardNo, charge: Number(charge) || 0 }),
    });
    const json = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Failed to save");
      return;
    }
    setWardNo(CITYWIDE_WARD_NO);
    onChanged();
  }

  async function removeOverride(id: number) {
    await fetch(`/api/admin/dealer-shipping-charges/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-gray-900">Default shipping charge</h3>
        <p className="mt-1 text-sm text-gray-500">
          Rs {Number(dealer.shippingCharge).toLocaleString()} — applies to every city this dealer serves unless overridden below.
          Edit it from the Details tab.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-gray-900">City / ward-specific overrides</h3>
        {dealer.shippingCharges.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No overrides configured.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {dealer.shippingCharges.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.ward.wardNo === CITYWIDE_WARD_NO ? `${c.ward.municipality.name} (Entire city)` : `${c.ward.municipality.name} (Ward ${c.ward.wardNo})`}</span>
                <span className="flex items-center gap-3">
                  Rs {Number(c.charge).toLocaleString()}
                  <button type="button" onClick={() => removeOverride(c.id)} className="text-red-500 hover:text-red-700">Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-5">
          <Select label="Province" disabled={!tree} value={provinceId ?? ""} onChange={(e) => { setProvinceId(Number(e.target.value) || null); setDistrictId(null); setMunicipalityId(null); setWardNo(CITYWIDE_WARD_NO); }}>
            <option value="">Select</option>
            {tree?.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="District" disabled={!provinceId} value={districtId ?? ""} onChange={(e) => { setDistrictId(Number(e.target.value) || null); setMunicipalityId(null); setWardNo(CITYWIDE_WARD_NO); }}>
            <option value="">Select</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select label="City" disabled={!districtId} value={municipalityId ?? ""} onChange={(e) => { setMunicipalityId(Number(e.target.value) || null); setWardNo(CITYWIDE_WARD_NO); }}>
            <option value="">Select</option>
            {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select label="Ward" disabled={!selectedMunicipality} value={wardNo} onChange={(e) => setWardNo(Number(e.target.value))}>
            <option value={CITYWIDE_WARD_NO}>Entire city</option>
            {wardOptions.map((w) => <option key={w} value={w}>Ward {w}</option>)}
          </Select>
          <Input label="Charge (Rs)" type="number" min={0} value={charge} onChange={(e) => setCharge(e.target.value)} />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button variant="admin" size="sm" className="mt-3" isLoading={isSaving} onClick={addOverride}>Save Override</Button>
      </div>
    </div>
  );
}

interface DealerInventoryItem {
  productId: number;
  name: string;
  sku: string | null;
  globalStock: number;
  dealerStock: number;
  assigned: boolean;
}

function InventoryTab({ dealerId, canAssign }: { dealerId: number; canAssign: boolean }) {
  const [search, setSearch] = useState("");
  const [showAssignedOnly, setShowAssignedOnly] = useState(true);
  const [items, setItems] = useState<DealerInventoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ pageSize: "100" });
    if (search) params.set("search", search);
    fetch(`/api/admin/dealers/${dealerId}/inventory?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => setItems(json.data?.items ?? []));
  }, [dealerId, search]);

  useEffect(() => { load(); }, [load]);

  async function saveStock(productId: number) {
    const value = Number(drafts[productId]);
    if (Number.isNaN(value) || value < 0) return;
    setSavingId(productId);
    await fetch(`/api/admin/dealers/${dealerId}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, stock: value }),
    });
    setSavingId(null);
    load();
  }

  async function toggleAssigned(productId: number, assigned: boolean) {
    setTogglingId(productId);
    await fetch(`/api/admin/dealers/${dealerId}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, assigned }),
    });
    setTogglingId(null);
    load();
  }

  const visibleItems = showAssignedOnly ? items.filter((i) => i.assigned) : items;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="max-w-xs" />
        {canAssign && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showAssignedOnly}
              onChange={(e) => setShowAssignedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Assigned products only
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {canAssign
          ? "Check “Assigned” to authorize this dealer to sell a product — only assigned products are visible in the dealer's own portal."
          : "Update how many units you currently have available for each product. Contact an administrator to get more products assigned to you."}
      </p>
      <table className="mt-4 w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {canAssign && <th className="py-2">Assigned</th>}
            <th className="py-2">Product</th>
            {canAssign && <th className="py-2">Global Stock</th>}
            <th className="py-2">Dealer Stock</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visibleItems.map((item) => (
            <tr key={item.productId}>
              {canAssign && (
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={item.assigned}
                    disabled={togglingId === item.productId}
                    onChange={(e) => toggleAssigned(item.productId, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
              )}
              <td className="py-2 font-medium text-gray-900">{item.name}</td>
              {canAssign && <td className="py-2 text-gray-500">{item.globalStock}</td>}
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  disabled={!item.assigned}
                  value={drafts[item.productId] ?? item.dealerStock}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-slate-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </td>
              <td className="py-2">
                <Button
                  size="sm"
                  variant="adminOutline"
                  disabled={!item.assigned}
                  isLoading={savingId === item.productId}
                  onClick={() => saveStock(item.productId)}
                >
                  Save
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibleItems.length === 0 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          {showAssignedOnly ? "No products assigned yet." : "No products found."}
        </p>
      )}
    </div>
  );
}
