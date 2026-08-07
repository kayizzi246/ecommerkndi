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

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Keyboard cursor into the suggestion list; -1 means "no row selected". */
  const [cursor, setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const term = query.trim();

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
    router.push(`/search?q=${encodeURIComponent(value)}`);
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
        <div
          className={`flex items-center gap-2 rounded-full border bg-white px-5 transition-all duration-200 ${
            focused
              ? "border-shop-primary shadow-[0_0_0_3px_rgba(192,90,28,0.12)]"
              : "border-shop-line hover:border-[#d4d1cc]"
          }`}
        >
          <svg
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              focused ? "text-shop-primary" : "text-shop-muted"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            />
          </svg>

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
            placeholder="Search for items or brands"
            className="w-full bg-transparent py-2.5 text-[13px] placeholder:text-[#8a8a8a] focus:outline-none"
          />

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
            className="-mr-3 shrink-0 rounded-full bg-shop-primary px-4 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-85"
          >
            Search
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
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-shop-muted">
                Popular right now
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToSearch(label)}
                    className="rounded-full border border-shop-line px-3 py-1.5 text-[12px] text-shop-body transition-colors hover:border-shop-ink hover:text-shop-ink"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : loading && suggestions.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-shop-muted">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-shop-muted">
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
                        <span className="line-clamp-1 block text-[13px] text-shop-body">
                          {highlight(s.name, term)}
                        </span>
                        {s.category && (
                          <span className="block text-[11px] text-shop-muted">{s.category}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 text-[13px] font-semibold ${
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
                className="w-full bg-shop-surface py-3 text-center text-[12px] font-semibold text-shop-ink transition-colors hover:bg-shop-hairline"
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
