"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sellerApi, type Seller } from "@/lib/seller";

type SessionState = {
  seller: Seller | null;
  loading: boolean;
  /** Re-reads /api/seller/me, e.g. after settings are saved. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SellerSessionContext = createContext<SessionState | null>(null);

export function SellerSessionProvider({ children }: { children: React.ReactNode }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const { seller: current } = await sellerApi.me();
      setSeller(current);
    } catch {
      setSeller(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve the session once on mount. The cancelled flag stops a late
  // response from writing state after the provider has unmounted.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { seller: current } = await sellerApi.me();
        if (!cancelled) setSeller(current);
      } catch {
        if (!cancelled) setSeller(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await sellerApi.logout().catch(() => undefined);
    setSeller(null);
    router.push("/seller/login");
  }, [router]);

  return (
    <SellerSessionContext.Provider value={{ seller, loading, refresh, signOut }}>
      {children}
    </SellerSessionContext.Provider>
  );
}

export function useSellerSession(): SessionState {
  const context = useContext(SellerSessionContext);
  if (!context) {
    throw new Error("useSellerSession must be used inside <SellerSessionProvider>");
  }
  return context;
}
