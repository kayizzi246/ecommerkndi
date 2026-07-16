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

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced suggestion fetch
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xl">
      <form onSubmit={submit}>
        <div className="flex items-center bg-gray-100 rounded-full px-5 focus-within:ring-2 focus-within:ring-black/10">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search for items or brands"
            className="w-full bg-transparent py-2.5 text-sm focus:outline-none placeholder:text-gray-400"
          />
          <button type="submit" aria-label="Search" className="shrink-0 text-gray-500 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
              />
            </svg>
          </button>
        </div>
      </form>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
          {loading && suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">
              No matches for “{query.trim()}”
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/products/${s.id}`);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.image}
                        alt=""
                        className="w-10 h-10 object-contain bg-gray-50 rounded shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm line-clamp-1">{s.name}</span>
                        {s.category && (
                          <span className="block text-xs text-gray-400">{s.category}</span>
                        )}
                      </span>
                      <span className={`text-sm font-bold shrink-0 ${s.on_sale ? "text-sale" : ""}`}>
                        {formatPrice(s.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
                className="w-full text-center text-xs font-bold uppercase tracking-wider py-3 bg-gray-50 hover:bg-gray-100"
              >
                View all results
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
