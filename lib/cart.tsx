"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  /** Unique line key: productId + chosen options. */
  key: string;
  productId: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  /** Chosen options, e.g. { Size: "38" }. */
  options?: Record<string, string>;
};

export function cartLineKey(
  productId: number,
  options?: Record<string, string>
): string {
  const parts = Object.entries(options ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `${productId}|${parts.join("|")}`;
}

type NewItem = Omit<CartItem, "quantity" | "key">;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: NewItem, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  /** Side-cart drawer. Adding a line opens it, the way Shopify themes do. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "kandi-cart-v2";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The saved basket is read once, after mount, and deliberately not during
  // render: the server has no localStorage, so a cart restored during render
  // would make the server and client markup disagree and React would throw the
  // whole tree away. One update on mount is the cost of that, and it is why the
  // set-state-in-effect rule is waived here rather than worked around.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: NewItem, quantity = 1) => {
    const key = cartLineKey(item.productId, item.options);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, key, quantity }];
    });
    setDrawerOpen(true);
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity } : i))
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setDrawerOpen(false);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return {
      items,
      count,
      subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      drawerOpen,
      openDrawer,
      closeDrawer,
    };
  }, [
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    drawerOpen,
    openDrawer,
    closeDrawer,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
