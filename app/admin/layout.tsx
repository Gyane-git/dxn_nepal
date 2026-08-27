"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/layout/Logo";
import { NAV_ITEMS, permissionForPath } from "@/lib/admin-nav";
import { PermissionsProvider, usePermissions } from "@/providers/PermissionsProvider";

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-soft">
      <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        You don&apos;t have permission to view this page. Contact a Super Admin if you believe this is a mistake.
      </p>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { can, loading } = usePermissions();

  const visibleNavItems = NAV_ITEMS.filter((item) => can(item.permission));
  const requiredPermission = permissionForPath(pathname);
  const allowed = loading || can(requiredPermission);

  return (
    <div className="min-h-screen bg-gray-100">
      {mobileOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-slate-900 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-800 px-5">
          <Logo showText={false} iconSize={30} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-white">DXN</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Admin Panel</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3 text-base font-medium">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${
                  isActive ? "bg-sky-500/15 text-sky-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
          <button
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin Dashboard</p>

          <div className="relative ml-auto group">
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
                </span>
              )}
              <span className="hidden text-sm font-medium text-gray-700 sm:inline">{session?.user?.name ?? "Admin"}</span>
              <svg viewBox="0 0 24 24" className="hidden h-4 w-4 text-gray-400 sm:block" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <div className="invisible absolute right-0 z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100">
              <div className="flex items-center gap-3 px-4 py-3">
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
                    {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{session?.user?.name ?? "Admin"}</p>
                  <p className="truncate text-xs text-gray-500">{session?.user?.email ?? ""}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 py-1">
                <Link href="/admin/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Your Profile
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="block w-full px-4 py-2 text-left text-sm text-secondary-600 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{allowed ? children : <AccessDenied />}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <PermissionsProvider>
      <AdminShell>{children}</AdminShell>
    </PermissionsProvider>
  );
}
