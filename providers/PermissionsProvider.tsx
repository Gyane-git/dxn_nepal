"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface PermissionsState {
  isSuperAdmin: boolean;
  permissions: Set<string>;
  /** Non-null only when this login is also linked to one specific Dealer record (see Dealer.userId). */
  dealerId: number | null;
  loading: boolean;
  can: (permission?: string) => boolean;
}

const PermissionsContext = createContext<PermissionsState | null>(null);

/**
 * Fetches the signed-in admin's effective permission set once and exposes `can(key)`. Not
 * embedded in the JWT so a role/permission change takes effect on next page load rather than
 * requiring re-login. Drives both the sidebar filter and the page-level guard in
 * app/admin/layout.tsx.
 */
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [dealerId, setDealerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setIsSuperAdmin(Boolean(json.data.isSuperAdmin));
        setPermissions(new Set<string>(json.data.permissions ?? []));
        setDealerId(json.data.dealerId ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function can(permission?: string) {
    if (!permission) return true;
    return isSuperAdmin || permissions.has(permission);
  }

  return (
    <PermissionsContext.Provider value={{ isSuperAdmin, permissions, dealerId, loading, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within a PermissionsProvider");
  return ctx;
}
