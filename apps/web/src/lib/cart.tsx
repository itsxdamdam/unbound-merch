"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { CartLine } from "./types";

// Ids and quantities only — no prices, so a stale cart charges today's price.
const KEY = "unbound-cart-v1";

interface CartApi {
  lines: CartLine[];
  count: number;
  add(variantId: string, quantity?: number): void;
  setQuantity(variantId: string, quantity: number): void;
  remove(variantId: string): void;
  clear(): void;
  /** False until localStorage has been read, so SSR and first paint agree. */
  ready: boolean;
}

const CartContext = createContext<CartApi | null>(null);

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" && l !== null &&
        typeof (l as CartLine).variantId === "string" &&
        Number.isInteger((l as CartLine).quantity) && (l as CartLine).quantity > 0,
    );
  } catch {
    // Private mode, cleared storage, corrupt JSON — an empty cart is the
    // correct fallback, never a crash on the storefront.
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount, not during render: the server has no localStorage, and
  // rendering a non-empty cart on the server would hydrate-mismatch.
  useEffect(() => {
    setLines(read());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // Storage full or blocked; the cart still works for this page view.
    }
  }, [lines, ready]);

  const add = useCallback((variantId: string, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((l) => l.variantId === variantId);
      if (!existing) return [...current, { variantId, quantity }];
      return current.map((l) =>
        l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l,
      );
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((current) =>
      quantity < 1
        ? current.filter((l) => l.variantId !== variantId)
        : current.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((current) => current.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartApi>(
    () => ({
      lines, ready, add, setQuantity, remove, clear,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
