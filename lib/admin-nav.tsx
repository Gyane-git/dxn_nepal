import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  LayoutGrid,
  BadgeCheck,
  Package,
  SlidersHorizontal,
  Star,
  Users,
  Store,
  Ticket,
  GalleryHorizontal,
  UserCog,
  Settings as SettingsIcon,
} from "lucide-react";

/**
 * Single source of truth for the admin sidebar AND for the page-level route guard in
 * app/admin/layout.tsx. `permission` is omitted for routes any authenticated admin may reach
 * (dashboard shell, own profile). Matching is by longest-prefix on the current pathname.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  permission?: string;
  icon: ReactNode;
}

const ICON_SIZE = 24;
const ICON_STROKE = 1.75;

export const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view", icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/orders", label: "Orders", permission: "orders.view", icon: <ShoppingBag size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/categories", label: "Categories", permission: "categories.view", icon: <LayoutGrid size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/brands", label: "Brands", permission: "brands.view", icon: <BadgeCheck size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/products", label: "Products", permission: "products.view", icon: <Package size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/attributes", label: "Attributes", permission: "attributes.view", icon: <SlidersHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/reviews", label: "Reviews", permission: "reviews.view", icon: <Star size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/distributors", label: "Distributors", permission: "distributors.view", icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/dealers", label: "Dealers", permission: "dealers.view", icon: <Store size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/coupons", label: "Coupons", permission: "coupons.view", icon: <Ticket size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/banners", label: "Home Banners", permission: "banners.view", icon: <GalleryHorizontal size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/users", label: "Users", permission: "users.view", icon: <UserCog size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { href: "/admin/settings", label: "Settings", permission: "settings.view", icon: <SettingsIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
];

/**
 * Route-level permission guard, keyed separately from the sidebar so a sub-page can require a
 * more specific permission than its parent nav item (e.g. /admin/settings/roles needs
 * roles.view, not just settings.view, even though "Roles & Permissions" is a card on the
 * Settings hub rather than its own top-level sidebar entry).
 */
const ROUTE_PERMISSIONS: { href: string; permission: string }[] = [
  ...NAV_ITEMS.filter((i): i is AdminNavItem & { permission: string } => Boolean(i.permission)),
  { href: "/admin/settings/roles", permission: "roles.view" },
];

/** Longest-prefix match against /admin/* pathnames. Returns undefined = no extra gate needed. */
export function permissionForPath(pathname: string): string | undefined {
  let best: { href: string; permission: string } | undefined;
  for (const item of ROUTE_PERMISSIONS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best?.permission;
}
