"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export function useRecentlyViewed() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    globalListeners.push(handler);
    return () => {
      globalListeners = globalListeners.filter((fn) => fn !== handler);
    };
  }, []);

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

  const value = useMemo(
    () => ({
      items: [...globalItems],
      addProduct,
    }),
    [addProduct, globalItems.length]
  );

  return value;
}

