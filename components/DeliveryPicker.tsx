"use client";

import { useState, useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/currency";
import type { LatLng } from "@/lib/delivery";
import {
  getAddressesSnapshot,
  getServerAddressesSnapshot,
  removeAddress,
  subscribeAddresses,
  type SavedAddress,
} from "@/lib/saved-addresses";

export type DeliveryResult = {
  km: number;
  fee: number;
  free: boolean;
  deliverable: boolean;
  label: string;
  place: string | null;
  point: LatLng;
  /** Reverse-geocoded parts, for filling the address fields. */
  address?: { street: string; city: string };
};

/**
 * Where the shopper is, and what delivery there costs.
 *
 * Two ways in, because neither works for everyone:
 *
 *   • "Use my location" — the browser's own Geolocation API. Free, no API key,
 *     exact to a few metres, and one tap. It needs permission, and a good
 *     number of people decline.
 *   • A typed landmark or suburb — geocoded server-side. Slower and less exact
 *     but always available, and it is how somebody ordering for delivery to
 *     an address that is not where they are standing has to do it.
 *
 * Or, for anyone who has ordered before, one tap on a saved address — which
 * carries its own coordinates, so it re-prices without asking for location
 * permission a second time.
 *
 * The price is never computed here. This sends a location and receives a
 * figure, so the rates stay on the server where they cannot be edited from the
 * console — and the same function prices the order again when it is placed.
 */
export default function DeliveryPicker({
  subtotal,
  value,
  onChange,
  onAutofill,
}: {
  subtotal: number;
  value: DeliveryResult | null;
  onChange: (result: DeliveryResult | null) => void;
  /**
   * Address parts to type into the checkout form. Called when a location
   * resolves to something recognisable, and when a saved address is picked.
   */
  onAutofill?: (parts: {
    street: string;
    city: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [activeSaved, setActiveSaved] = useState<string | null>(null);

  // localStorage is state React does not own, so it is read through the hook
  // built for that. The server snapshot is empty — there is no browser storage
  // during the server pass — which is also what keeps hydration consistent.
  const saved = useSyncExternalStore(
    subscribeAddresses,
    getAddressesSnapshot,
    getServerAddressesSnapshot
  );

  const quote = async (body: { point?: LatLng; address?: string }) => {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, subtotal }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Could not work out delivery for that place.");
        onChange(null);
        return;
      }

      const result = data as DeliveryResult;
      onChange(result);

      // Only fills what the geocoder actually knew. Overwriting a typed street
      // with an empty string because reverse geocoding came back thin would be
      // worse than not filling at all.
      if (result.address && (result.address.street || result.address.city)) {
        onAutofill?.({ street: result.address.street, city: result.address.city });
      }
    } catch {
      setError("Network error. Check your connection and try again.");
      onChange(null);
    } finally {
      setBusy(false);
    }
  };

  /** Re-price from a saved address and refill the form from it. */
  const applySaved = (entry: SavedAddress) => {
    setActiveSaved(entry.id);
    onAutofill?.({
      street: entry.street,
      city: entry.city,
      first_name: entry.first_name,
      last_name: entry.last_name,
      phone: entry.phone,
    });
    // Re-quoted rather than trusting the fee stored with it: rates change, and
    // the free-delivery threshold depends on this order's subtotal.
    quote({ point: entry.point });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share your location. Type your area instead.");
      return;
    }

    setBusy(true);
    setError(null);
    setActiveSaved(null);

    navigator.geolocation.getCurrentPosition(
      (position) =>
        quote({
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
        }),
      (geoError) => {
        setBusy(false);
        // Distinguishing these matters: "denied" is a decision the shopper made
        // and can undo, the others are conditions they cannot.
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was declined. Type your area below instead."
            : "Could not get your location. Type your area below instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  return (
    <div className="rounded-lg border border-shop-line p-4">
      {/* Saved addresses first: for a returning shopper this is the whole
          step, and burying it under the location button would mean granting
          permission again for an address we already hold. */}
      {saved.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[13px] font-medium text-shop-body">Deliver to a saved address</p>
          <ul className="flex flex-wrap gap-2">
            {saved.map((entry) => {
              const active = activeSaved === entry.id;
              return (
                <li key={entry.id}>
                  <span
                    className={`flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 transition-colors ${
                      active
                        ? "border-shop-primary bg-shop-primary-soft"
                        : "border-shop-line hover:border-shop-primary"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => applySaved(entry)}
                      disabled={busy}
                      className="text-left text-[13px] text-shop-ink disabled:opacity-60"
                    >
                      <span className="font-medium">{entry.label || entry.city}</span>
                      {entry.street && (
                        <span className="text-shop-muted"> · {entry.street}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Forget ${entry.label || entry.city}`}
                      onClick={() => {
                        // The store notifies its subscribers, so the list
                        // re-renders without keeping a second copy here.
                        removeAddress(entry.id);
                        if (active) setActiveSaved(null);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[15px] leading-none text-shop-muted hover:bg-white hover:text-shop-sale"
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="btn-shop px-4 py-2.5 text-[14px] disabled:opacity-60"
        >
          <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {busy ? "Locating…" : "Use my location"}
        </button>

        <span className="text-[13px] text-shop-muted">or</span>

        <div className="flex min-w-[220px] flex-1 gap-2">
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // The picker sits inside the checkout form; Enter here must
                // price a delivery, not submit the order.
                event.preventDefault();
                if (address.trim()) quote({ address });
              }
            }}
            placeholder="Area or landmark, e.g. Ntinda"
            aria-label="Delivery area"
            className="field-shop text-[14px]"
          />
          <button
            type="button"
            onClick={() => address.trim() && quote({ address })}
            disabled={busy || !address.trim()}
            className="btn-shop-outline shrink-0 px-4 py-2 text-[14px] disabled:opacity-50"
          >
            Check
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-shop-sale">
          {error}
        </p>
      )}

      {value && !error && (
        <div
          role="status"
          className={`mt-3 rounded-lg px-3 py-2.5 text-[14px] ${
            value.deliverable ? "bg-shop-primary-soft" : "bg-pop-red-soft"
          }`}
        >
          {value.deliverable ? (
            <>
              <p className="font-semibold text-shop-ink">
                {value.place ?? value.label}
              </p>
              <p className="mt-0.5 text-shop-body">
                {value.label} ·{" "}
                {value.free ? (
                  <span className="font-semibold text-shop-success">Free delivery</span>
                ) : (
                  <span className="font-semibold text-shop-ink">
                    Delivery {formatPrice(value.fee)}
                  </span>
                )}
              </p>
              {(value.address?.street || value.address?.city) && (
                // Said out loud because fields filling themselves is startling,
                // and because a reverse-geocoded street is a good guess rather
                // than a fact — the shopper is the one who knows their gate.
                <p className="mt-1.5 text-[13px] text-shop-body">
                  We&apos;ve filled in your address below — please check it.
                </p>
              )}
            </>
          ) : (
            <p className="font-medium text-shop-sale">{value.label}</p>
          )}
        </div>
      )}

      {!value && !error && (
        <p className="mt-3 text-[13px] text-shop-muted">
          We work out delivery from how far you are — share your location or type
          your area to see the exact cost before you pay.
        </p>
      )}
    </div>
  );
}
