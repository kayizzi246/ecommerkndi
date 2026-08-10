"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

type ViewedProduct = {
  productId: number;
  name: string;
  image: string;
  price: number;
  slug?: string;
};

const STORAGE_KEY = "kandi-recently-viewed-v1";
const MAX_ITEMS = 12;

// Global state
let globalItems: ViewedProduct[] = [];
let globalListeners: Array<() => void> = [];

function notify() {
  for (const fn of globalListeners) fn();
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    globalItems = raw ? JSON.parse(raw) : [];
  } catch {
    globalItems = [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalItems));
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  load();
}

function subscribe(listener: () => void): () => void {
  globalListeners.push(listener);
  return () => {
    globalListeners = globalListeners.filter((fn) => fn !== listener);
  };
}

const getSnapshot = () => globalItems;

/** The server has no localStorage, so it always renders an empty list. */
const EMPTY: ViewedProduct[] = [];
const getServerSnapshot = () => EMPTY;

export function useRecentlyViewed() {
  // The list is read from localStorage as soon as this module loads, so the
  // first client render would otherwise already have items while the server
  // rendered none. `useSyncExternalStore` is built for exactly this: it uses
  // the server snapshot during hydration and swaps to the real one straight
  // after, instead of mismatching.
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addProduct = useCallback((product: ViewedProduct) => {
    // Remove duplicate if exists
    globalItems = globalItems.filter(
      (i) => i.productId !== product.productId
    );
    // Add to front
    globalItems = [product, ...globalItems].slice(0, MAX_ITEMS);
    save();
    notify();
  }, []);

  return useMemo(() => ({ items, addProduct }), [items, addProduct]);
}

