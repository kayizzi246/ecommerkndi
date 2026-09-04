import type { LatLng } from "@/lib/delivery";

/**
 * The shopper's delivery addresses, kept in this browser.
 *
 * Deliberately local storage rather than their WordPress account: most orders
 * here are placed by people who never sign in, and an address book that only
 * works for registered customers would miss them. Everything is saved the
 * moment an order is placed, so the second order is one tap.
 *
 * The trade-off, stated plainly because it shows up in the UI: these do not
 * follow the shopper to another device or survive clearing browser data. That
 * is acceptable for a convenience feature — the address is still typed into the
 * order itself, which is the record that matters.
 *
 * Coordinates are stored alongside the text. Re-selecting a saved address
 * re-prices delivery from the same point it was priced from originally, without
 * asking for location permission again.
 */

const KEY = "kandi.addresses.v1";
/** Enough for home, work and a relative's; beyond that the list stops being scannable. */
const LIMIT = 5;

export type SavedAddress = {
  /** Stable id, so React keys and removals do not depend on the text. */
  id: string;
  /** What the shopper calls it — the place name, e.g. "Ntinda". */
  label: string;
  street: string;
  city: string;
  point: LatLng;
  /** Contact details, so a repeat order fills the whole form. */
  first_name?: string;
  last_name?: string;
  phone?: string;
  /**
   * The address the receipt goes to.
   *
   * Stored with the rest of the contact details rather than left out because
   * it is "optional" on the form: a shopper who typed it once has told us
   * where they want their receipt, and asking again on the next order is the
   * shop forgetting something it was told. It is also the field a shopper is
   * most likely to abandon rather than retype on a phone.
   */
  email?: string;
  savedAt: number;
};

/** Every saved address, most recently used first. */
export function loadAddresses(): SavedAddress[] {
  // Called from components that also render on the server during the initial
  // pass, where `window` does not exist.
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    // Validated rather than trusted: this is user-writable storage, and a
    // half-written or hand-edited entry must not break the checkout.
    return parsed
      .filter((entry): entry is SavedAddress => {
        const item = entry as Partial<SavedAddress>;
        return (
          typeof item?.id === "string" &&
          typeof item?.city === "string" &&
          Number.isFinite(item?.point?.lat) &&
          Number.isFinite(item?.point?.lng)
        );
      })
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

/**
 * Adds an address, or refreshes the one already there.
 *
 * Matched on street and city rather than on coordinates: GPS returns a slightly
 * different point every time somebody stands in their own doorway, so matching
 * on position would save the same house repeatedly.
 */
export function saveAddress(entry: Omit<SavedAddress, "id" | "savedAt">): SavedAddress[] {
  if (typeof window === "undefined") return [];

  const key = (item: { street: string; city: string }) =>
    `${item.street}|${item.city}`.toLowerCase().trim();

  const saved: SavedAddress = {
    ...entry,
    id:
      // `randomUUID` is unavailable on pages served over plain http, which
      // includes local development on some browsers.
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `addr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };

  const next = [saved, ...loadAddresses().filter((item) => key(item) !== key(saved))].slice(
    0,
    LIMIT
  );

  write(next);
  return next;
}

/** Forgets one address. */
export function removeAddress(id: string): SavedAddress[] {
  const next = loadAddresses().filter((item) => item.id !== id);
  write(next);
  return next;
}

function write(addresses: SavedAddress[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(addresses));
  } catch {
    // Private browsing, or a full quota. Saving addresses is a convenience —
    // losing it must never stop somebody checking out.
  }

  snapshot = addresses;
  listeners.forEach((listener) => listener());
}

/* -------------------------------------------------------------------------
 * Subscription, so components can read this with `useSyncExternalStore`.
 *
 * localStorage is exactly what that hook is for: state React does not own.
 * Reading it in an effect and calling setState would work, but it renders once
 * with an empty list and again with the real one — and React's own lint rules
 * now flag it.
 * ---------------------------------------------------------------------- */

const listeners = new Set<() => void>();

/**
 * The snapshot must be referentially stable between changes: `useSyncExternalStore`
 * compares by identity, and a fresh array on every call is an infinite loop.
 */
let snapshot: SavedAddress[] | null = null;

/** Frozen empty array for the server pass — a new `[]` each time would loop too. */
const NONE: SavedAddress[] = [];

export function subscribeAddresses(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab checking out is the one case the storage event covers, and it
  // is worth having: the address book is per-browser, not per-page.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      snapshot = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getAddressesSnapshot(): SavedAddress[] {
  snapshot ??= loadAddresses();
  return snapshot;
}

/** Always empty on the server — there is no browser storage to read there. */
export function getServerAddressesSnapshot(): SavedAddress[] {
  return NONE;
}
