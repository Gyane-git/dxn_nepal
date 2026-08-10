"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, Search, User, ShoppingCart, Heart, ChevronDown, LayoutDashboard, Package, LogOut } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Logo } from "@/components/layout/Logo";
import { formatPrice } from "@/lib/format";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
];

type ProductSuggestion = {
  id: number;
  name: string;
  slug: string;
  price: number;
  image: string | null;
};

function SearchBox({
  value,
  onChange,
  onSubmit,
  onNavigate,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const term = value.trim();

  useEffect(() => {
    if (!term) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(term)}&pageSize=6`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data.success ? data.data : []))
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [term]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToProduct(slug: string) {
    setOpen(false);
    onNavigate?.();
    router.push(`/product/${slug}`);
  }

  const showDropdown = open && term.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-stretch overflow-hidden border-2 border-primary-300">
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search products..."
          autoComplete="off"
          className="w-full min-w-0 border-0 bg-white px-4 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex shrink-0 items-center justify-center bg-primary-400 px-4 text-white transition-colors hover:bg-primary-500"
        >
          <Search className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
      </div>
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          {loading ? (
            <p className="px-4 py-3 text-sm text-gray-400">Searching...</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No products found</p>
          ) : (
            <>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToProduct(p.slug)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {p.image && <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-800">{p.name}</span>
                    <span className="block text-xs font-medium text-primary-600">{formatPrice(p.price)}</span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onSubmit();
                }}
                className="mt-1 block w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-primary-600 hover:bg-gray-50"
              >
                {`See all results for "${term}"`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { data: session, status } = useSession();
  const { totalCount } = useCart();
  const { totalCount: wishlistCount } = useWishlist();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    router.push(search ? `/shop?search=${encodeURIComponent(search)}` : "/shop");
    setMobileOpen(false);
  }

  return (
    <>
      <div className="hidden bg-gray-50 py-1.5 text-center text-xs text-gray-500 sm:block">
        Cash on Delivery available &nbsp;·&nbsp; Easy Returns &nbsp;·&nbsp; 100% Genuine Products
      </div>
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-700 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-primary-600">
              {link.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={handleSearch} className="ml-auto hidden max-w-2xl flex-1 items-center md:flex">
          <SearchBox value={search} onChange={setSearch} onSubmit={handleSearch} />
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {status === "authenticated" && <NotificationBell />}

          {status === "authenticated" ? (
            <div className="relative group">
              <button className="flex items-center gap-1.5 rounded-full p-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 lg:border lg:border-gray-200 lg:p-1.5 lg:pl-1.5 lg:pr-3 lg:hover:border-gray-300 lg:hover:bg-gray-50">
                {session.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <User className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                )}
                <span className="hidden lg:inline">{session.user?.name?.split(" ")[0]}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 lg:block" strokeWidth={2} />
              </button>
              <div className="invisible absolute right-0 z-50 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-xl opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                <Link href="/account" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <User className="h-4 w-4 text-gray-400" strokeWidth={1.8} /> My Account
                </Link>
                <Link href="/account/orders" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Package className="h-4 w-4 text-gray-400" strokeWidth={1.8} /> My Orders
                </Link>
                {session.user?.role === "ADMIN" && (
                  <Link href="/admin" className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <LayoutDashboard className="h-4 w-4 text-gray-400" strokeWidth={1.8} /> Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-secondary-600 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.8} /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Login
            </Link>
          )}

          <Link
            href="/wishlist"
            className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" strokeWidth={1.75} />
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-500 text-[10px] font-bold text-white">
                {wishlistCount > 9 ? "9+" : wishlistCount}
              </span>
            )}
          </Link>

          <Link
            href="/cart"
            className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
            {totalCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-500 text-[10px] font-bold text-white">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </Link>

          <button
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <Menu className="h-6 w-6" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-100 px-4 py-3 lg:hidden">
          <form onSubmit={handleSearch} className="mb-3 flex">
            <SearchBox
              value={search}
              onChange={setSearch}
              onSubmit={handleSearch}
              onNavigate={() => setMobileOpen(false)}
            />
          </form>
          <nav className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-2 py-2 hover:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
      </header>
    </>
  );
}
