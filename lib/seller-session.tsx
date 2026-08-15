"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sellerApi, type Seller } from "@/lib/seller";

type SessionState = {
  seller: Seller | null;
  loading: boolean;
  /** Re-reads /api/seller/me, e.g. after settings are saved. */
  refresh: () => Promise<void>;
  /**
   * Seed the session from a seller the caller already has, with no request.
   *
   * Both sign-in routes get the full seller back in the response that
   * establishes the session, and until now both threw it away and called
   * `refresh()` — asking WordPress for the record they were already holding.
   * On a shared host that is a second or more of "Signing you in…" spent
   * fetching known data, in the middle of the slowest moment in the product.
   *
   * This is deliberately not exposed as a general setter for arbitrary state:
   * it exists so a caller that has *just been handed* an authenticated seller
   * can put it in the context. Anything that changes a seller server-side
   * should still go through `refresh`.
   */
  setSession: (seller: Seller | null) => void;
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

  /** See the note on `setSession` in `SessionState`. */
  const setSession = useCallback((current: Seller | null) => {
    setSeller(current);
    // The provider resolves its own session on mount and clears `loading` when
    // that settles. A caller seeding a seller has settled it by other means, so
    // this has to clear too — otherwise the Seller Centre shell keeps rendering
    // its loading gate around a session that is already known.
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await sellerApi.logout().catch(() => undefined);
    setSeller(null);
    router.push("/seller/login");
  }, [router]);

  return (
    <SellerSessionContext.Provider value={{ seller, loading, refresh, setSession, signOut }}>
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
