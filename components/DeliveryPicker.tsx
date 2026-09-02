"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/currency";
import type { LatLng } from "@/lib/delivery";
import type { PlaceSuggestion } from "@/lib/geocode";
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

  /**
   * ---- The suggestion list ----
   *
   * Typing an area and pressing a Check button is one interaction too many at
   * the point in the checkout where people give up, and it hides the real
   * problem: "Kira" is a road in Kampala AND a town in Wakiso twenty kilometres
   * away, at different delivery fees. A single geocode silently picked one.
   * Showing the candidates makes the shopper choose, which is both faster and
   * the only way the fee can be right.
   */
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [openList, setOpenList] = useState(false);

  /* Set when a suggestion is taken, so the effect below does not immediately
     re-search for the text it just wrote into the field. */
  const chosen = useRef(false);

  useEffect(() => {
    if (chosen.current) {
      chosen.current = false;
      return;
    }

    const query = address.trim();
    // Emptying the list is done in the change handler, not here: setState in
    // an effect body cascades a render, and "the box is now too short to
    // search" is something typing caused rather than something to synchronise.
    if (query.length < 3) return;

    /* 300ms. Every one of these is a geocoding request, billed when the shop
       has a Google key and rate-limited by Nominatim when it does not, so a
       request per keystroke is not an option. 300 is about the gap between
       words when somebody is typing an address they know. */
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/delivery/suggest?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { places?: PlaceSuggestion[] };
        setPlaces(data.places ?? []);
        setOpenList(true);
      } catch {
        // A suggestion list that cannot load is not worth an error message:
        // the field still works, and Check still prices whatever was typed.
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [address]);

  /** Takes one suggestion: fills the field, closes the list, prices it. */
  const choose = (place: PlaceSuggestion) => {
    chosen.current = true;
    setAddress(place.label);
    setPlaces([]);
    setOpenList(false);
    setActiveSaved(null);
    /* A suggestion from Google Places carries no coordinates — see
       PlaceSuggestion.point — so the label is geocoded here, at the one moment
       the shopper has actually committed to a place. OpenStreetMap and the
       Geocoding fallback both include a point, and those skip the extra call. */
    quote(place.point ? { point: place.point } : { address: place.label });
  };

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

        <div className="relative flex min-w-[220px] flex-1 gap-2">
          <input
            value={address}
            onChange={(event) => {
              const next = event.target.value;
              setAddress(next);
              // Below the search threshold there is nothing to offer, and a
              // stale list under a half-deleted word is worse than none.
              if (next.trim().length < 3) {
                setPlaces([]);
                setOpenList(false);
              }
            }}
            onFocus={() => places.length > 0 && setOpenList(true)}
            /* Closed on a delay rather than immediately: a click on a
               suggestion blurs the input first, and hiding the list on blur
               removes the thing being clicked before the click lands. */
            onBlur={() => window.setTimeout(() => setOpenList(false), 150)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpenList(false);
                return;
              }
              if (event.key === "Enter") {
                // The picker sits inside the checkout form; Enter here must
                // price a delivery, not submit the order.
                event.preventDefault();
                // Enter takes the first suggestion when there is one, because
                // that is what the list has been offering while they typed.
                if (openList && places.length > 0) {
                  choose(places[0]);
                } else if (address.trim()) {
                  quote({ address });
                }
              }
            }}
            placeholder="Start typing your area, e.g. Ntinda"
            aria-label="Delivery area"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="delivery-suggestions"
            aria-expanded={openList && places.length > 0}
            autoComplete="off"
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

          {openList && places.length > 0 && (
            <ul
              id="delivery-suggestions"
              role="listbox"
              aria-label="Matching places"
              /* Above the field's own row and anything after it. The checkout
                 has a sticky summary at the top and a sticky pay bar at the
                 bottom; a dropdown that slides under either is unusable. */
              className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-shop-line bg-white shadow-lg"
            >
              {/* Keyed by label AND index: the label alone is not guaranteed
                  unique — two Kyengeras in different districts tidy to the same
                  name — and the coordinates, which would have been the better
                  key, are not always present. A Places suggestion has none. */}
              {places.map((place, index) => (
                <li key={`${place.label}-${index}`}>
                  <button
                    type="button"
                    onClick={() => choose(place)}
                    className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-shop-ink transition-colors hover:bg-shop-surface"
                  >
                    <svg
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-shop-muted"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    {place.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
