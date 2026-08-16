"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SETTINGS } from "@/lib/site-settings";

/**
 * The two numbers the shop makes promises about — the free-delivery threshold
 * and the returns window — made readable from a client component.
 *
 * ---- Why this exists ----
 *
 * Both figures are already editable in wp-admin under *Kandi Storefront*, and
 * every *server* surface reads them from there: the homepage, the footer, the
 * policy pages, the product JSON-LD, and `getDeliveryRates`, which is what the
 * checkout actually charges against.
 *
 * The client components could not. `CartDrawer` and `app/cart/page.tsx` are
 * both `"use client"` with no server parent handing them settings, so each had
 * grown its own `const FREE_DELIVERY_THRESHOLD = 50000`, and `TrustStrip` and
 * `TrustBar` had "within 14 days" typed into an array. Nothing was wrong with
 * the shipped defaults, which is exactly what made it dangerous: the drift only
 * appears the day the owner edits the setting, and then the shop quietly starts
 * lying in the two places it is least affordable to.
 *
 * A cart that says "add UGX 12,000 more for free delivery" against a stale
 * threshold, and a checkout that then charges for delivery anyway, is not a
 * cosmetic inconsistency — it is the last thing a shopper sees before deciding
 * the shop cannot be trusted with their money. The same figure has to come from
 * one place or it will eventually come from two.
 *
 * ---- Why a context rather than props ----
 *
 * These values are needed at scattered depths — a drawer mounted by the chrome,
 * a route that is its own client tree, a reassurance strip dropped into the
 * product page and the homepage. Threading a prop through all of that is how
 * the next component quietly hardcodes it again instead. Read from the root
 * once, available anywhere, impossible to fork.
 *
 * The provider is fed from the root layout, which already awaits
 * `getSiteSettings()` for the metadata — so this costs no extra request.
 */
export type CommerceTerms = {
  /** Order subtotal at or above which delivery is free. 0 means no such offer. */
  freeDeliveryFrom: number;
  /** Days a shopper has to change their mind. */
  returnsDays: number;
};

/**
 * The shipped defaults, not zeroes.
 *
 * A component rendered outside the provider — a test, a future route that
 * forgets it — should quote the terms the shop actually operates rather than
 * "free delivery over UGX 0", which would be a worse failure than the drift
 * this file exists to prevent.
 */
const FALLBACK: CommerceTerms = {
  freeDeliveryFrom: DEFAULT_SETTINGS.commerce.free_delivery_from,
  returnsDays: DEFAULT_SETTINGS.commerce.returns_days,
};

const CommerceTermsContext = createContext<CommerceTerms>(FALLBACK);

export function CommerceTermsProvider({
  terms,
  children,
}: {
  terms: CommerceTerms;
  children: React.ReactNode;
}) {
  return (
    <CommerceTermsContext.Provider value={terms}>{children}</CommerceTermsContext.Provider>
  );
}

/** The shop's published delivery and returns terms, as set in wp-admin. */
export function useCommerceTerms(): CommerceTerms {
  return useContext(CommerceTermsContext);
}
