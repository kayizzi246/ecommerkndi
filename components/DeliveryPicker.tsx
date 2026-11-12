"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/currency";
import type { LatLng } from "@/lib/delivery";
import { codAvailableAt } from "@/lib/cod-zones";
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
/**
 * Areas most orders go to, offered as one-tap buttons.
 *
 * Typing on a phone over a slow connection is the hardest part of this form:
 * every letter waits on a suggestion request. A tap sends the area by name and
 * comes back with a price. Sent as a name rather than a stored coordinate, so
 * the fee is worked out by the same geocoder that prices a typed area.
 */
const POPULAR_AREAS: { name: string; query: string }[] = [
  { name: "Kampala Central", query: "Kampala Central Division" },
  { name: "Ntinda", query: "Ntinda, Kampala" },
  { name: "Nakawa", query: "Nakawa, Kampala" },
  { name: "Kololo", query: "Kololo, Kampala" },
  { name: "Bugolobi", query: "Bugolobi, Kampala" },
  { name: "Makindye", query: "Makindye, Kampala" },
  // "Kira" alone is also a road in Kampala; the town is the one meant.
  { name: "Kira", query: "Kira Town, Wakiso" },
  { name: "Najjera", query: "Najjera, Wakiso" },
  { name: "Wandegeya", query: "Wandegeya, Kampala" },
  { name: "Entebbe", query: "Entebbe" },
  { name: "Mukono", query: "Mukono Town" },
];

/**
 * A geocoded address made fit to read back: without the map code Google puts
 * in front of a place with no street number ("9JWQ+XH9, Kira Bulindo Road"),
 * and without the country every address here shares.
 */
function tidyPlace(place: string): string {
  return place
    .replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4},?\s*/, "")
    .replace(/,\s*Uganda\s*$/i, "");
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none ${className}`}
    />
  );
}

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
    email?: string;
  }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [activeSaved, setActiveSaved] = useState<string | null>(null);
  /** True once a place is confirmed and the shopper asks to pick another. */
  const [editing, setEditing] = useState(false);
  /**
   * The name the shopper themselves picked: a popular area, a suggestion, a
   * saved address. Read back to them in place of the geocoder's street
   * address, which for "Ntinda" is a house number on a road they may not know.
   */
  const [pickedName, setPickedName] = useState<string | null>(null);
  /** A suggestion request is in the air; slow enough here to be worth showing. */
  const [searching, setSearching] = useState(false);
  /** Which way in is waiting on an answer, so only that control shows it. */
  const [waitingOn, setWaitingOn] = useState<string | null>(null);

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
    /* Aborted when the next letter is typed. On a slow line the answers come
       back out of order, and an old one landing last would replace the list
       for what the shopper has typed since. */
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/delivery/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { places?: PlaceSuggestion[] };
        setPlaces(data.places ?? []);
        setOpenList(true);
      } catch {
        // A suggestion list that cannot load is not worth an error message:
        // the field still works, and Find still prices whatever was typed.
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address]);

  /** Takes one suggestion: fills the field, closes the list, prices it. */
  const choose = (place: PlaceSuggestion) => {
    chosen.current = true;
    setAddress(place.label);
    setPlaces([]);
    setOpenList(false);
    setActiveSaved(null);
    setPickedName(place.label);
    setWaitingOn("typed");
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
        setError(data?.error ?? "We could not find that place. Try again.");
        onChange(null);
        return;
      }

      const result = data as DeliveryResult;
      onChange(result);
      // A place we deliver to closes the picker onto its confirmation.
      if (result.deliverable) setEditing(false);

      // Only fills what the geocoder actually knew. Overwriting a typed street
      // with an empty string because reverse geocoding came back thin would be
      // worse than not filling at all.
      if (result.address && (result.address.street || result.address.city)) {
        onAutofill?.({ street: result.address.street, city: result.address.city });
      }
    } catch {
      setError("No internet. Try again.");
      onChange(null);
    } finally {
      setBusy(false);
      setWaitingOn(null);
    }
  };

  /** Re-price from a saved address and refill the form from it. */
  const applySaved = (entry: SavedAddress) => {
    setActiveSaved(entry.id);
    setPickedName(entry.label || entry.city || null);
    setWaitingOn(`saved:${entry.id}`);
    onAutofill?.({
      street: entry.street,
      city: entry.city,
      first_name: entry.first_name,
      last_name: entry.last_name,
      phone: entry.phone,
      email: entry.email,
    });
    // Re-quoted rather than trusting the fee stored with it: rates change, and
    // the free-delivery threshold depends on this order's subtotal.
    quote({ point: entry.point });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Location not available. Type your area.");
      return;
    }

    setBusy(true);
    setWaitingOn("gps");
    setError(null);
    setActiveSaved(null);
    setPickedName(null);

    navigator.geolocation.getCurrentPosition(
      (position) =>
        quote({
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
        }),
      (geoError) => {
        setBusy(false);
        setWaitingOn(null);
        // Distinguishing these matters: "denied" is a decision the shopper made
        // and can undo, the others are conditions they cannot.
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location blocked. Type your area."
            : "Could not find you. Type your area."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  /** Prices an area given by name: a popular-area tap, or the Find button. */
  const findByName = (name: string, waiting: string, picked: string | null = null) => {
    const query = name.trim();
    if (!query || busy) return;
    setActiveSaved(null);
    setPickedName(picked);
    setOpenList(false);
    setWaitingOn(waiting);
    quote({ address: query });
  };

  /* ---- Once a place is priced, the picker gets out of the way ----

     The answer used to appear as a pale strip under the same buttons and box
     that had just been used, so the step never looked finished: the shopper
     was left looking at a location button and an empty-looking field and
     wondering whether they still had to do something. Now the controls are
     replaced by what was decided, in green, with the price, and one link to
     change it. */
  if (value?.deliverable && !error && !editing) {
    const cash = codAvailableAt(value.point);
    const found = value.place ? tidyPlace(value.place) : "";
    const headline = pickedName || found || value.label;
    /* Under the name: the address the map found, when the name above is the
       shopper's own word for it, and how far that is. */
    const detail = [pickedName && found !== pickedName ? found : "", value.label !== headline ? value.label : ""]
      .filter(Boolean)
      .join(" · ");

    return (
      <div role="status" className="rounded-xl border-2 border-shop-success bg-shop-successbg p-3.5 sm:p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shop-success text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-shop-success">We deliver to</p>
            <p className="text-[16px] font-extrabold leading-snug text-black">
              {headline}
            </p>
            {detail && <p className="mt-0.5 text-[12px] leading-4 text-shop-body">{detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="-mr-1 -mt-1 shrink-0 rounded-full px-3 py-2 text-[13px] font-bold text-black underline underline-offset-4"
          >
            Change
          </button>
        </div>

        <div className="mt-3 flex items-baseline justify-between rounded-lg bg-white px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-shop-body">Delivery cost</span>
          {value.free ? (
            <span className="text-[16px] font-extrabold text-shop-success">FREE</span>
          ) : (
            <span className="price text-[16px] font-extrabold text-black">{formatPrice(value.fee)}</span>
          )}
        </div>

        {/* The line that decides most first orders here: nothing leaves the
            shopper's phone until the parcel is in their hand. Read from the
            same zone check the payment step and the server use. */}
        {cash && (
          <p className="mt-2.5 text-[13px] font-semibold text-black">
            You can pay cash when it arrives.
          </p>
        )}
      </div>
    );
  }

  const pin = (
    <svg aria-hidden className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );

  return (
    <div className="rounded-xl border border-shop-line p-3.5 sm:p-4">
      {editing && value?.deliverable && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mb-3 text-[13px] font-semibold text-shop-body underline underline-offset-4"
        >
          Keep {pickedName || (value.place ? tidyPlace(value.place) : value.label)}
        </button>
      )}

      {/* Saved addresses first: for a returning shopper this is the whole
          step, and burying it under the location button would mean granting
          permission again for an address we already hold. Full-width rows a
          thumb can hit, rather than the small chips they used to be. */}
      {saved.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[13px] font-bold text-black">Deliver here again?</p>
          <ul className="space-y-2">
            {saved.map((entry) => {
              const active = activeSaved === entry.id;
              return (
                <li
                  key={entry.id}
                  className={`flex items-stretch overflow-hidden rounded-xl border transition-colors ${
                    active ? "border-black bg-shop-primary-soft" : "border-shop-line bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => applySaved(entry)}
                    disabled={busy}
                    className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-black disabled:opacity-60"
                  >
                    {waitingOn === `saved:${entry.id}` ? <Spinner className="mx-0.5" /> : pin}
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{entry.label || entry.city}</span>
                      {entry.street && (
                        <span className="block truncate text-[12px] text-shop-muted">{entry.street}</span>
                      )}
                    </span>
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
                    className="flex w-11 shrink-0 items-center justify-center text-[18px] leading-none text-shop-muted hover:text-shop-sale"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* The one-tap way in, as wide as the form. It was a small button on the
          same line as the text box, where the two competed and neither read
          as the thing to press. */}
      <button
        type="button"
        onClick={useMyLocation}
        disabled={busy}
        className="btn-shop min-h-[52px] w-full px-4 text-[15px] font-bold disabled:opacity-60"
      >
        {waitingOn === "gps" ? <Spinner /> : pin}
        {waitingOn === "gps" ? "Finding you…" : "Use my location"}
      </button>
      <p className="mt-1.5 text-center text-[12px] text-shop-muted">Fastest. One tap, no typing.</p>

      <div className="my-4 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-shop-line" />
        <span className="text-[12px] font-semibold text-shop-muted">or type your area</span>
        <span className="h-px flex-1 bg-shop-line" />
      </div>

      <div className="relative flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-shop-muted">
            {searching || waitingOn === "typed" ? (
              <Spinner />
            ) : (
              <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
            )}
          </span>
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
                } else {
                  findByName(address, "typed");
                }
              }
            }}
            placeholder="e.g. Ntinda"
            aria-label="Delivery area"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="delivery-suggestions"
            aria-expanded={openList && places.length > 0}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="search"
            /* 16px, not the 13px the other fields use: below 16 an iPhone
               zooms the whole page in when the box is tapped, and the shopper
               has to pinch back out before they can see the suggestions. */
            className="field-shop min-h-[52px] pl-10! text-[16px]!"
          />
        </div>
        <button
          type="button"
          onClick={() => findByName(address, "typed")}
          disabled={busy || !address.trim()}
          className="btn-shop-outline min-h-[52px] shrink-0 px-5 text-[14px] font-bold disabled:opacity-40"
        >
          Find
        </button>

        {openList && places.length > 0 && (
          <ul
            id="delivery-suggestions"
            role="listbox"
            aria-label="Matching places"
            /* Above the field's own row and anything after it. The checkout
               has a sticky summary at the top and a sticky pay bar at the
               bottom; a dropdown that slides under either is unusable. */
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[50vh] overflow-y-auto rounded-xl border border-shop-ink bg-white shadow-lg"
          >
            {/* Keyed by label AND index: the label alone is not guaranteed
                unique — two Kyengeras in different districts tidy to the same
                name — and the coordinates, which would have been the better
                key, are not always present. A Places suggestion has none. */}
            {places.map((place, index) => (
              <li key={`${place.label}-${index}`} className="border-b border-shop-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => choose(place)}
                  className="flex min-h-[48px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-medium text-shop-ink transition-colors hover:bg-shop-surface"
                >
                  <span className="text-shop-muted">{pin}</span>
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* One tap instead of typing, for the areas most orders go to. */}
      <div className="mt-4">
        <p className="mb-2 text-[13px] font-bold text-black">Popular areas</p>
        <ul className="flex flex-wrap gap-2">
          {POPULAR_AREAS.map((area) => {
            const waiting = waitingOn === `area:${area.name}`;
            return (
              <li key={area.name}>
                <button
                  type="button"
                  onClick={() => {
                    chosen.current = address !== area.name;
                    setAddress(area.name);
                    setPlaces([]);
                    findByName(area.query, `area:${area.name}`, area.name);
                  }}
                  disabled={busy}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                    waiting
                      ? "border-black bg-shop-primary-soft text-black"
                      : "border-shop-line bg-shop-surface text-shop-ink hover:border-black"
                  }`}
                >
                  {waiting && <Spinner className="h-3.5 w-3.5" />}
                  {area.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Said in words while the price is fetched. On a slow line that is
          several seconds, and a form that looks unchanged gets tapped again. */}
      {busy && waitingOn !== "gps" && (
        <p role="status" className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-black">
          <Spinner />
          Checking the delivery cost…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-pop-red-soft px-3 py-2.5 text-[13px] font-semibold text-shop-sale">
          {error}
        </p>
      )}

      {value && !value.deliverable && !error && !busy && (
        <p role="status" className="mt-3 rounded-lg bg-pop-red-soft px-3 py-2.5 text-[13px] font-semibold text-shop-sale">
          {value.label}
        </p>
      )}

      {!value && !error && !busy && (
        <p className="mt-3 text-[12px] text-shop-muted">
          Pick your area to see the delivery cost before you pay.
        </p>
      )}
    </div>
  );
}
