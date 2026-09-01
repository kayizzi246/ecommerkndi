"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/currency";

type Suggestion = {
  id: number;
  name: string;
  image: string;
  price: number;
  regular_price: number;
  on_sale: boolean;
  category: string;
};

/** A matching shop, from the same suggest call as the products. */
type StoreHit = {
  name: string;
  slug: string;
  logo: string;
  product_count: number;
};

/** Shown on focus before anything is typed, so the panel is never empty. */
const POPULAR = ["Sneakers", "Adidas", "Shorts", "Formal shoes", "Women"];

/** Splits a label around the typed term so the match can be emboldened. */
function highlight(label: string, term: string) {
  const at = label.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1 || !term) return label;
  return (
    <>
      {label.slice(0, at)}
      <mark className="bg-transparent font-semibold text-shop-ink">
        {label.slice(at, at + term.length)}
      </mark>
      {label.slice(at + term.length)}
    </>
  );
}

/**
 * The prompts that cycle through the empty search box.
 *
 * Written as things somebody would actually type into this shop rather than as
 * slogans — a rotating placeholder is only worth the movement if it teaches the
 * reader what the catalogue holds. Every one of these returns results today.
 */
const SEARCH_PROMPTS = [
  "Men's leather belts",
  "Football boots",
  "Shoe rack organiser",
  "Portable wardrobe",
  "Curtains for the sitting room",
  "Crossbody bag",
  "Air pump for a mattress",
];

/** How long each prompt holds before the next slides up. */
const PROMPT_INTERVAL_MS = 2600;

/**
 * The departments the search can be narrowed to.
 *
 * Written by hand against the same words the main nav uses rather than fetched:
 * this control sits in the masthead on every page, and a select whose options
 * arrive after a round trip is a select that changes shape while somebody is
 * reaching for it. The slugs are the real WooCommerce categories — `/search`
 * resolves an unknown one by ignoring it, so a renamed category degrades to an
 * unscoped search rather than an empty result page.
 */
const SCOPES = [
  { label: "Men", slug: "men" },
  { label: "Women", slug: "women" },
  { label: "Kids", slug: "kids" },
  { label: "Home", slug: "home-decor" },
];

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Stores that match what is being typed. Kept apart from `suggestions`
  // because they are a different kind of answer and render as their own
  // section, but walked as one list by the arrow keys — see `rows` below.
  const [stores, setStores] = useState<StoreHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Keyboard cursor into the suggestion list; -1 means "no row selected". */
  const [cursor, setCursor] = useState(-1);
  /** Which prompt the empty box is currently showing. */
  const [prompt, setPrompt] = useState(0);
  /** Category slug the query is limited to; "" means the whole catalogue. */
  const [scope, setScope] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const term = query.trim();

  /**
   * The empty box shows a prompt only when it is genuinely empty and unfocused.
   *
   * Both conditions matter. Text sliding under a cursor somebody is typing into
   * is the reason animated placeholders are usually a mistake, and the moment a
   * shopper focuses the field they have their own idea — the suggestion has done
   * its job or it has not.
   */
  const showPrompt = !query && !focused;

  // Advance the prompt on a timer, and only while one is on screen: a rotation
  // running behind a focused field is work nobody can see, and it would resume
  // mid-cycle when the field empties instead of showing a fresh line.
  useEffect(() => {
    if (!showPrompt) return;
    const timer = setInterval(
      () => setPrompt((current) => (current + 1) % SEARCH_PROMPTS.length),
      PROMPT_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, [showPrompt]);

  // Debounced suggestion fetch. Every state update happens inside the timer or
  // the response handler, never synchronously in the effect body.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (term.length < 2) {
        setSuggestions([]);
        setStores([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setStores(data.stores ?? []);
      } catch {
        setSuggestions([]);
        setStores([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  // Close on outside click.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
        setCursor(-1);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ---- The keyboard walks ONE list, even though the panel shows two ----
  //
  // `cursor` is an index into this array rather than into `suggestions`, which
  // is what lets ↓ carry on from the last store into the first product instead
  // of stopping at a section boundary the keyboard cannot see. Stores lead
  // because they are the more specific answer: someone who typed a shop's name
  // wants the shop, and a product row cannot give them that.
  const rows: ({ kind: "store"; store: StoreHit } | { kind: "product"; product: Suggestion })[] = [
    ...stores.map((store) => ({ kind: "store" as const, store })),
    ...suggestions.map((product) => ({ kind: "product" as const, product })),
  ];

  const goToStore = (slug: string) => {
    setOpen(false);
    setCursor(-1);
    inputRef.current?.blur();
    router.push(`/sellers/${slug}`);
  };

  const goToSearch = (value: string) => {
    setOpen(false);
    setCursor(-1);
    inputRef.current?.blur();
    // The scope rides along only when one is chosen, so an unscoped search
    // keeps producing the same clean /search?q=… URL it always has.
    const scoped = scope ? `&category=${encodeURIComponent(scope)}` : "";
    router.push(`/search?q=${encodeURIComponent(value)}${scoped}`);
  };

  const goToProduct = (id: number) => {
    setOpen(false);
    setCursor(-1);
    inputRef.current?.blur();
    router.push(`/products/${id}`);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const row = cursor >= 0 ? rows[cursor] : undefined;
    if (row) {
      if (row.kind === "store") goToStore(row.store.slug);
      else goToProduct(row.product.id);
      return;
    }
    if (term) goToSearch(term);
  };

  // ↑/↓ walk the list, Enter opens the highlighted row, Escape closes.
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setCursor(-1);
      return;
    }
    if (!open || rows.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c <= 0 ? rows.length - 1 : c - 1));
    }
  };

  const showPanel = open && (term.length >= 2 || (focused && term.length === 0));

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit} role="search">
        {/* A squared-off white field with the action as a solid block on the
            right — the widest, most obvious target on the page. The magnifier
            lives inside that block: with a placeholder this explicit, a second
            icon on the left was decoration taking up room the query needs.

            ---- The edge, now that the row behind it is white again ----

            The resting edge spent the orange era as the field's own white,
            which made the pill read as one clean shape against the brand
            colour. On a white masthead that is not an edge at all — the field
            and the row are the same colour, and a search box with no boundary
            is the one control in this shop that cannot afford to go missing.

            So the resting edge is `shop-line` again, the pale grey it had the
            last time this row was neutral. Focus stays near-black rather than
            going back to brand orange: near-black is unambiguous against both
            the white field and the white row, and it is already what the
            submit block beside it is drawn in, so focusing the field pulls its
            edge into the same colour as its action. `border-2` stays — it is
            what gives the most-used control in the shop its weight now that
            the ground is not doing that job. */}
        <div
          className={`flex items-center gap-2 overflow-hidden rounded-lg border-2 bg-white pl-4 transition-colors duration-200 ${
            focused ? "border-shop-nav" : "border-shop-line hover:border-shop-nav/25"
          }`}
        >
          {/* ---- Scope ----
               The dropdown the reference puts at the head of its search field.
               It is a real control, not a decoration: picking a department
               limits the query to that category, which is the difference between
               "shoes" returning the whole catalogue's shoes and returning the
               men's ones.

               A native `<select>` rather than a custom menu. It carries its own
               keyboard handling, its own mobile picker and its own accessibility
               for free, and this is a control that has to work on a cheap
               Android browser first and look considered second. */}
          <label className="sr-only" htmlFor="search-scope">
            Search within
          </label>
          <select
            id="search-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="hidden max-w-[130px] shrink-0 cursor-pointer truncate border-r border-shop-line bg-transparent py-2.5 pr-2 text-[13px] font-normal text-shop-ink focus:outline-none sm:block"
          >
            <option value="">All</option>
            {SCOPES.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.label}
              </option>
            ))}
          </select>

          {/* The input and its animated prompt share a positioned box, so the
              prompt lands exactly on the placeholder rather than against the
              outer field — which starts 16px further left, before the padding. */}
          <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(-1);
              setOpen(true);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            /* The static placeholder is still set, and still carries the real
               instruction. The animated line below sits on top of it and is
               `aria-hidden`, so a screen reader hears one stable prompt rather
               than a field whose label changes every 2.6 seconds. It is also
               what shows if JavaScript never runs. */
            placeholder="Search for products, brands and more"
            /* `.search-input` is the scale's search row — 400 at 14px — rather
               than the 15px this had picked up on its own. */
            className={`search-input w-full bg-transparent py-2.5 focus:outline-none ${
              // Hide the real placeholder only while the animated one is
              // covering it, so the two can never be legible at once.
              showPrompt ? "placeholder:text-transparent" : "placeholder:text-shop-muted"
            }`}
          />

          {/* ---- The rotating prompt ----
               A suggestion sliding up out of the field every few seconds, the
               way the large marketplaces prompt an empty search box. It is
               advertising the catalogue, not labelling the input — which is why
               it is decoration to assistive tech and why it disappears the
               instant the field is focused or typed into.

               `pointer-events-none` so it cannot intercept the click that would
               have focused the input underneath it. */}
          {showPrompt && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden"
            >
              <span
                // Keyed on the index so React remounts the span each time,
                // which is what replays the animation — a CSS animation on a
                // persistent node only ever runs once.
                key={prompt}
                className="ticker-line block truncate text-[14px] text-shop-muted"
              >
                {SEARCH_PROMPTS[prompt]}
              </span>
            </span>
          )}
          </div>

          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setCursor(-1);
                inputRef.current?.focus();
              }}
              className="shrink-0 text-shop-muted transition-colors hover:text-shop-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}

          {/* Near-black, not brand orange.

              The orange block was the loudest thing in the chrome while the
              masthead was neutral. It sits at the right edge of the field, so
              on an orange row it touches the row's own colour and the field
              stops looking like it ends — the button bleeds into the masthead
              and the pill reads as a white notch cut out of it. Near-black
              separates from both surfaces and keeps the submit the heaviest
              object in the field, which is the property that mattered. */}
          <button
            type="submit"
            aria-label="Search"
            className="flex h-10 w-12 shrink-0 items-center justify-center self-stretch bg-shop-primary text-white transition-colors hover:bg-shop-primary-dark"
          >
            <svg className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
              />
            </svg>
          </button>
        </div>
      </form>

      {showPanel && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-shop-line bg-white shadow-lg"
        >
          {term.length === 0 ? (
            <div className="p-4">
              <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-shop-muted">
                Popular right now
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToSearch(label)}
                    className="rounded-full border border-shop-line px-3 py-1.5 text-[13px] text-shop-body transition-colors hover:border-shop-ink hover:text-shop-ink"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : loading && rows.length === 0 ? (
            <p className="px-4 py-3 text-[14px] text-shop-muted">Searching…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-3 text-[14px] text-shop-muted">
              No matches for “{term}”
            </p>
          ) : (
            <>
              {/* ---- Stores ----
                   Its own section with a label, not store rows mixed into the
                   product list. A shop and a pair of shoes are different kinds
                   of destination, and a row that looks like the product above
                   it but navigates somewhere else entirely is the sort of thing
                   that gets clicked once and never trusted again.

                   Capped at three by the API. This is a shortcut to a shop
                   somebody already had in mind, not a directory — /sellers is
                   the directory, and it is one tap from the footer. */}
              {stores.length > 0 && (
                <div className="border-b border-shop-hairline">
                  <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-shop-muted">
                    Stores
                  </p>
                  <ul>
                    {stores.map((store, i) => (
                      <li key={store.slug}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === cursor}
                          onMouseEnter={() => setCursor(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => goToStore(store.slug)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            i === cursor ? "bg-shop-surface" : ""
                          }`}
                        >
                          {/* Round, where a product thumbnail is square — the
                              shape alone says "this is a shop" before a word of
                              the row is read. A store with no logo uploaded
                              gets its initial rather than a broken image. */}
                          {store.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={store.logo}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full border border-shop-line bg-white object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shop-ink text-[14px] font-semibold text-white">
                              {store.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 block text-[14px] font-medium text-shop-ink">
                              {highlight(store.name, term)}
                            </span>
                            <span className="block text-[12px] text-shop-muted">
                              {store.product_count === 1
                                ? "1 product"
                                : `${store.product_count} products`}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] font-semibold text-shop-primary">
                            Visit store ›
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ul className="divide-y divide-shop-hairline">
                {suggestions.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      /* Offset by the store rows above: `cursor` indexes the
                         combined list, so a product's own position is its index
                         plus however many stores were rendered. */
                      aria-selected={i + stores.length === cursor}
                      onMouseEnter={() => setCursor(i + stores.length)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goToProduct(s.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i + stores.length === cursor ? "bg-shop-surface" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.image}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-shop-line bg-white object-contain p-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block text-[14px] text-shop-body">
                          {highlight(s.name, term)}
                        </span>
                        {s.category && (
                          <span className="block text-[12px] text-shop-muted">{s.category}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 text-[14px] font-semibold ${
                          s.on_sale ? "text-shop-primary-ink" : "text-shop-ink"
                        }`}
                      >
                        {formatPrice(s.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToSearch(term)}
                className="w-full bg-shop-surface py-3 text-center text-[13px] font-semibold text-shop-ink transition-colors hover:bg-shop-hairline"
              >
                View all results for “{term}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
