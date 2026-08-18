"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { computeAutoPv, computeDiscountedUnitPrice } from "@/lib/pricing";
import type { ProductFormValues } from "@/components/admin/products/ProductForm";

interface TabProps {
  values: ProductFormValues;
  set: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void;
}

interface DistributorOption {
  id: number;
  name: string;
  email: string;
  distributorId: string;
}

function useDistributors() {
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  useEffect(() => {
    fetch("/api/admin/distributors")
      .then((res) => res.json())
      .then((json) => setDistributors(json.data ?? []));
  }, []);
  return distributors;
}

export function DistributorPricingTab({ values, set }: TabProps) {
  const distributors = useDistributors();

  function toggleDiscountDistributor(distributorId: number, checked: boolean) {
    if (checked) {
      set("distributorDiscounts", [...values.distributorDiscounts, { distributorId, discountPercent: "" }]);
    } else {
      set(
        "distributorDiscounts",
        values.distributorDiscounts.filter((r) => r.distributorId !== distributorId)
      );
    }
  }

  function setDiscountPercent(distributorId: number, discountPercent: string) {
    set(
      "distributorDiscounts",
      values.distributorDiscounts.map((r) => (r.distributorId === distributorId ? { ...r, discountPercent } : r))
    );
  }

  function togglePvDistributor(distributorId: number, checked: boolean) {
    if (checked) {
      set("pvDistributorIds", [...values.pvDistributorIds, distributorId]);
    } else {
      set(
        "pvDistributorIds",
        values.pvDistributorIds.filter((id) => id !== distributorId)
      );
    }
  }

  const price = Number(values.price) || 0;

  /** A distributor's PV preview reflects THEIR OWN discounted price when one applies to them. */
  function previewPvFor(distributorId: number): number {
    const rule =
      values.hasDiscount && values.forDistributor
        ? values.distributorDiscounts.find((r) => r.distributorId === distributorId)
        : undefined;
    const discountPercent = rule ? Number(rule.discountPercent) || 0 : null;
    const effectivePrice = discountPercent != null ? computeDiscountedUnitPrice(price, discountPercent) : price;
    return computeAutoPv(effectivePrice);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <Switch
          id="hasDiscount"
          checked={values.hasDiscount}
          onChange={(v) => set("hasDiscount", v)}
          label="Enable discount"
          description="Turn on to offer a percentage discount to customers, distributors, or both."
        />

        {values.hasDiscount && (
          <div className="mt-5 flex flex-col gap-5 border-t border-gray-100 pt-5">
            <div className="flex flex-col gap-3">
              <Switch
                id="forCustomer"
                checked={values.forCustomer}
                onChange={(v) => set("forCustomer", v)}
                label="For customers"
                description="Apply a discount for regular customer purchases."
              />
              {values.forCustomer && (
                <Input
                  label="Customer discount (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={values.customerDiscountPercent}
                  onChange={(e) => set("customerDiscountPercent", e.target.value)}
                  className="max-w-xs"
                />
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
              <Switch
                id="forDistributor"
                checked={values.forDistributor}
                onChange={(v) => set("forDistributor", v)}
                label="For distributors"
                description="Set an individual discount percentage per distributor."
              />
              {values.forDistributor && (
                <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {distributors.length === 0 && <p className="text-xs text-gray-400">No distributors yet.</p>}
                  {distributors.map((d) => {
                    const rule = values.distributorDiscounts.find((r) => r.distributorId === d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-3 rounded-lg bg-white p-2.5">
                        <Switch
                          checked={!!rule}
                          onChange={(checked) => toggleDiscountDistributor(d.id, checked)}
                          label={`${d.name} (${d.distributorId})`}
                        />
                        {rule && (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            placeholder="%"
                            value={rule.discountPercent}
                            onChange={(e) => setDiscountPercent(d.id, e.target.value)}
                            className="w-24"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
        <Switch
          id="hasPointValue"
          checked={values.hasPointValue}
          onChange={(v) => set("hasPointValue", v)}
          label="Enable Point Value (PV)"
          description="PV is earned by distributors only — never by customers. PV is always auto-calculated as 0.2% of the product price, not entered manually."
        />

        {values.hasPointValue && (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              PV is 0.2% of what each distributor actually pays — their own discounted price if they have one, the
              list price otherwise.
            </p>
            <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              {distributors.length === 0 && <p className="text-xs text-gray-400">No distributors yet.</p>}
              {distributors.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg bg-white p-2.5">
                  <Switch
                    checked={values.pvDistributorIds.includes(d.id)}
                    onChange={(checked) => togglePvDistributor(d.id, checked)}
                    label={`${d.name} (${d.distributorId})`}
                  />
                  {values.pvDistributorIds.includes(d.id) && (
                    <span className="ml-auto text-sm font-medium text-gray-700">{previewPvFor(d.id)} PV</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
