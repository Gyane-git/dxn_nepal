"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";

export interface CartLine {
  productId: string;
  variantId: number | null;
  variantLabel: string | null;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  colorway: string;
  stock: number;
  quantity: number;
}

interface GuestLine {
  productId: string;
  variantId: number | null;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  isLoading: boolean;
  subtotal: number;
  totalCount: number;
  addItem: (productId: string, quantity?: number, variantId?: number | null) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variantId?: number | null) => Promise<void>;
  removeItem: (productId: string, variantId?: number | null) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const GUEST_CART_KEY = "bikesh-guest-cart";

function sameLine(a: { productId: string; variantId: number | null }, productId: string, variantId: number | null) {
  return a.productId === productId && a.variantId === variantId;
}

function readGuestCart(): GuestLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (GuestLine & { variantId?: number | null })[];
    // Older guest carts saved before variant support don't have variantId — treat as null.
    return parsed.map((l) => ({ ...l, variantId: l.variantId ?? null }));
  } catch {
    return [];
  }
}

function writeGuestCart(lines: GuestLine[]) {
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
}

async function hydrateGuestLines(guestLines: GuestLine[]): Promise<CartLine[]> {
  if (guestLines.length === 0) return [];
  const ids = guestLines.map((l) => l.productId).join(",");
  const res = await fetch(`/api/products?ids=${encodeURIComponent(ids)}`);
  if (!res.ok) return [];
  const json = await res.json();
  const products: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image: string | null;
    colorway: string;
    stock: number;
    variants: { id: number; price: number | null; stock: number; image: string | null; label: string | null }[];
  }[] = json.data ?? [];

  return guestLines
    .map((gl) => {
      const product = products.find((p) => p.id === gl.productId);
      if (!product) return null;
      const variant = gl.variantId ? product.variants.find((v) => v.id === gl.variantId) : undefined;
      if (gl.variantId && !variant) return null;
      return {
        productId: product.id,
        variantId: gl.variantId,
        variantLabel: variant?.label ?? null,
        name: product.name,
        slug: product.slug,
        price: variant?.price ?? product.price,
        image: variant?.image ?? product.image,
        colorway: product.colorway,
        stock: variant?.stock ?? product.stock,
        quantity: gl.quantity,
      };
    })
    .filter((l): l is CartLine => l !== null);
}

async function fetchServerCart(): Promise<CartLine[]> {
  const res = await fetch("/api/cart");
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      if (status === "authenticated") {
        const guestLines = readGuestCart();
        if (guestLines.length > 0) {
          await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: guestLines }),
          });
          writeGuestCart([]);
        }
        const serverLines = await fetchServerCart();
        if (!cancelled) setLines(serverLines);
      } else if (status === "unauthenticated") {
        const guestLines = readGuestCart();
        const hydrated = await hydrateGuestLines(guestLines);
        if (!cancelled) setLines(hydrated);
      }

      if (!cancelled) setIsLoading(false);
    }

    if (status !== "loading") load();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const addItem = useCallback(
    async (productId: string, quantity = 1, variantId: number | null = null) => {
      if (status === "authenticated") {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity, variantId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message ?? "Could not add this item to your cart");
        setLines(json.data ?? []);
        return;
      }

      const guestLines = readGuestCart();
      const existing = guestLines.find((l) => sameLine(l, productId, variantId));
      const nextGuestLines = existing
        ? guestLines.map((l) => (sameLine(l, productId, variantId) ? { ...l, quantity: l.quantity + quantity } : l))
        : [...guestLines, { productId, variantId, quantity }];
      const hydrated = await hydrateGuestLines(nextGuestLines);
      if (!hydrated.some((l) => sameLine(l, productId, variantId))) {
        throw new Error("This product is no longer available");
      }
      writeGuestCart(nextGuestLines);
      setLines(hydrated);
    },
    [status]
  );

  const removeItem = useCallback(
    async (productId: string, variantId: number | null = null) => {
      if (status === "authenticated") {
        const params = new URLSearchParams({ productId });
        if (variantId !== null) params.set("variantId", String(variantId));
        const res = await fetch(`/api/cart?${params.toString()}`, { method: "DELETE" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message ?? "Could not remove this item");
        setLines(json.data ?? []);
        return;
      }

      const guestLines = readGuestCart().filter((l) => !sameLine(l, productId, variantId));
      writeGuestCart(guestLines);
      setLines(await hydrateGuestLines(guestLines));
    },
    [status]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number, variantId: number | null = null) => {
      if (quantity <= 0) {
        await removeItem(productId, variantId);
        return;
      }

      if (status === "authenticated") {
        const res = await fetch("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity, variantId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message ?? "Could not update quantity");
        setLines(json.data ?? []);
        return;
      }

      const guestLines = readGuestCart().map((l) => (sameLine(l, productId, variantId) ? { ...l, quantity } : l));
      writeGuestCart(guestLines);
      setLines(await hydrateGuestLines(guestLines));
    },
    [status, removeItem]
  );

  const clear = useCallback(async () => {
    if (status === "authenticated") {
      await fetch("/api/cart", { method: "DELETE" });
    } else {
      writeGuestCart([]);
    }
    setLines([]);
  }, [status]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [lines]
  );
  const totalCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  const value: CartContextValue = {
    lines,
    isLoading,
    subtotal,
    totalCount,
    addItem,
    updateQuantity,
    removeItem,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
