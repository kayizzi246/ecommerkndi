"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "kandi-wishlist-v1";

export type WishlistItem = {
  productId: number;
  name: string;
  image: string;
  price: number;
  slug?: string;
};

type WishlistContextValue = {
  items: WishlistItem[];
  isWishlisted: (productId: number) => boolean;
  toggle: (item: WishlistItem) => void;
  add: (item: WishlistItem) => void;
  remove: (productId: number) => void;
  count: number;
};

// Global state so all instances share the same data
let globalItems: WishlistItem[] = [];
let globalListeners: Array<() => void> = [];

function notifyListeners() {
  for (const fn of globalListeners) fn();
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) globalItems = JSON.parse(raw);
    else globalItems = [];
  } catch {
    globalItems = [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalItems));
  } catch {
    // ignore
  }
}

// Initialize on module load (client-side only)
if (typeof window !== "undefined") {
  loadFromStorage();
}

function subscribe(listener: () => void): () => void {
  globalListeners.push(listener);
  return () => {
    globalListeners = globalListeners.filter((fn) => fn !== listener);
  };
}

const getSnapshot = () => globalItems;

/** The server has no localStorage, so it always renders an empty wishlist. */
const EMPTY: WishlistItem[] = [];
const getServerSnapshot = () => EMPTY;

export function useWishlist(): WishlistContextValue {
  // Saved items are read from localStorage as soon as this module loads, so
  // the first client render would otherwise already know about them while the
  // server rendered an empty wishlist. `useSyncExternalStore` uses the server
  // snapshot during hydration and the real one immediately after, which is
  // what keeps the heart icons and the header badge from mismatching.
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isWishlisted = useCallback(
    (productId: number) => items.some((i) => i.productId === productId),
    [items]
  );

  const add = useCallback((item: WishlistItem) => {
    if (!globalItems.some((i) => i.productId === item.productId)) {
      globalItems = [item, ...globalItems];
      saveToStorage();
      notifyListeners();
    }
  }, []);

  const remove = useCallback((productId: number) => {
    globalItems = globalItems.filter((i) => i.productId !== productId);
    saveToStorage();
    notifyListeners();
  }, []);

  const toggle = useCallback(
    (item: WishlistItem) => {
      if (globalItems.some((i) => i.productId === item.productId)) {
        remove(item.productId);
      } else {
        add(item);
      }
    },
    [add, remove]
  );

  return useMemo<WishlistContextValue>(
    () => ({
      items,
      isWishlisted,
      toggle,
      add,
      remove,
      count: items.length,
    }),
    [items, isWishlisted, toggle, add, remove]
  );
}

