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
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
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
    if (cursor >= 0 && suggestions[cursor]) {
      goToProduct(suggestions[cursor].id);
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
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c <= 0 ? suggestions.length - 1 : c - 1));
    }
  };

  const showPanel = open && (term.length >= 2 || (focused && term.length === 0));

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit} role="search">
        {/* A rounded field with the action as a solid orange block on the right
            — the widest, most obvious target on the page, and the one place the
            brand orange gets to be loud. The magnifier lives inside that block:
            with a placeholder this explicit, a second icon on the left was
            decoration taking up room the query needs. */}
        <div
          className={`flex items-center gap-2 overflow-hidden rounded-lg border-2 bg-white pl-4 transition-colors duration-200 ${
            focused ? "border-shop-flame" : "border-shop-line hover:border-shop-flame/50"
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
            className="hidden max-w-[130px] shrink-0 cursor-pointer truncate border-r border-shop-line bg-transparent py-2.5 pr-2 text-[14px] font-semibold text-shop-ink focus:outline-none sm:block"
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
            className={`w-full bg-transparent py-2.5 text-[15px] focus:outline-none ${
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
                className="ticker-line block truncate text-[15px] text-shop-muted"
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

          <button
            type="submit"
            aria-label="Search"
            className="flex h-11 w-14 shrink-0 items-center justify-center self-stretch bg-shop-flame text-white transition-colors hover:bg-shop-primary"
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
          ) : loading && suggestions.length === 0 ? (
            <p className="px-4 py-3 text-[14px] text-shop-muted">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-[14px] text-shop-muted">
              No matches for “{term}”
            </p>
          ) : (
            <>
              <ul className="divide-y divide-shop-hairline">
                {suggestions.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === cursor}
                      onMouseEnter={() => setCursor(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goToProduct(s.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === cursor ? "bg-shop-surface" : ""
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
                          s.on_sale ? "text-shop-sale" : "text-shop-ink"
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
