"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Customer = {
  id: number;
  name: string;
  email: string;
  avatar: string;
  /** Set once the shopper finishes the welcome flow. */
  onboarded: boolean;
  preferences: { departments: string[]; size: string; city: string };
};

type SessionState = {
  customer: Customer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CustomerSessionContext = createContext<SessionState | null>(null);

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        setCustomer(null);
        return;
      }
      const data = (await response.json()) as { customer: Customer };
      setCustomer(data.customer ?? null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve the session once on mount; the guard stops a late reply writing
  // state after unmount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = response.ok ? ((await response.json()) as { customer: Customer }) : null;
        if (!cancelled) setCustomer(data?.customer ?? null);
      } catch {
        if (!cancelled) setCustomer(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCustomer(null);
  }, []);

  return (
    <CustomerSessionContext.Provider value={{ customer, loading, refresh, signOut }}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession(): SessionState {
  const context = useContext(CustomerSessionContext);
  if (!context) {
    throw new Error("useCustomerSession must be used inside <CustomerSessionProvider>");
  }
  return context;
}
