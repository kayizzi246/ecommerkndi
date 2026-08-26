"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sellerApi, type SellerProduct } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import ProductEditor from "./ProductEditor";

type Filter = "all" | "publish" | "pending" | "lowstock" | "outofstock";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "publish", label: "Live" },
  { value: "pending", label: "Awaiting approval" },
  { value: "lowstock", label: "Low stock" },
  { value: "outofstock", label: "Out of stock" },
];

const STATUS_BADGE: Record<string, string> = {
  publish: "bg-shop-successbg text-shop-success",
  pending: "bg-pop-orange-soft text-pop-orange",
  draft: "bg-shop-hairline text-shop-muted",
};

const STATUS_LABEL: Record<string, string> = {
  publish: "Live",
  pending: "In review",
  draft: "Hidden",
};

/** At or below this, a listing is flagged as running out. */
const LOW_STOCK_AT = 5;

/**
 * Product management: the screen a seller lives in.
 *
 * Restocking is the thing done most often, so it happens inline on the row —
 * type a number, press Save, done. Everything else opens the slide-over
 * editor. Neither needs a page load.
 */
export default function SellerProductsPage() {
  const params = useSearchParams();
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  // The dashboard links here with a filter already chosen ("Restock now"), so
  // the query string seeds the initial state rather than being applied by an
  // effect after the first paint.
  const [filter, setFilter] = useState<Filter>(() => {
    const requested = params.get("filter");
    return requested && FILTERS.some((entry) => entry.value === requested)
      ? (requested as Filter)
      : "all";
  });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<SellerProduct | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { products: list } = await sellerApi.products();
        if (!cancelled) setProducts(list);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load your products.");
        setProducts([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const replace = (saved: SellerProduct) => {
    setProducts((current) =>
      (current ?? []).map((entry) => (entry.id === saved.id ? saved : entry))
    );
  };

  const counts = useMemo(() => {
    const all = products ?? [];
    return {
      all: all.length,
      publish: all.filter((p) => p.status === "publish").length,
      pending: all.filter((p) => p.status === "pending").length,
      lowstock: all.filter(
        (p) =>
          p.stock_status !== "outofstock" &&
          p.stock_quantity !== null &&
          p.stock_quantity > 0 &&
          p.stock_quantity <= LOW_STOCK_AT
      ).length,
      outofstock: all.filter((p) => p.stock_status === "outofstock").length,
    };
  }, [products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "outofstock"
            ? product.stock_status === "outofstock"
            : filter === "lowstock"
              ? product.stock_status !== "outofstock" &&
                product.stock_quantity !== null &&
                product.stock_quantity > 0 &&
                product.stock_quantity <= LOW_STOCK_AT
              : product.status === filter;

      const matchesQuery =
        needle.length === 0 ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle);

      return matchesFilter && matchesQuery;
    });
  }, [products, filter, query]);

  const restock = async (product: SellerProduct, quantity: number) => {
    setBusyId(product.id);
    setError(null);
    try {
      const { product: saved } = await sellerApi.updateProduct(product.id, {
        stock_quantity: Math.max(0, quantity),
      });
      replace(saved);
      setNotice(`${saved.name} set to ${saved.stock_quantity ?? 0} in stock.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the stock.");
    } finally {
      setBusyId(null);
    }
  };

  const setVisibility = async (product: SellerProduct, hide: boolean) => {
    setBusyId(product.id);
    setError(null);
    try {
      // A seller may hide their own listing but never self-publish one, so
      // un-hiding sends it back for approval — which is what the API enforces.
      const { product: saved } = await sellerApi.updateProduct(product.id, {
        status: hide ? "draft" : "pending",
      });
      replace(saved);
      setNotice(hide ? `${saved.name} is hidden from the shop.` : `${saved.name} sent for review.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the listing.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (product: SellerProduct) => {
    if (!window.confirm(`Delete "${product.name}"? Past orders keep their record of it.`)) {
      return;
    }
    setBusyId(product.id);
    try {
      await sellerApi.deleteProduct(product.id);
      setProducts((current) => (current ?? []).filter((entry) => entry.id !== product.id));
      setNotice(`${product.name} deleted.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the product.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-extrabold leading-tight text-shop-ink">Products</h1>
          <p className="mt-1 text-[15px] text-shop-muted">
            Edit prices, restock and manage what shoppers can see.
          </p>
        </div>
        <Link href="/seller/products/new" className="btn-shop px-6 py-3 text-[15px]">
          Add a product
        </Link>
      </div>

      {/* Filters + search */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((entry) => {
            const active = filter === entry.value;
            const count = counts[entry.value];
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => setFilter(entry.value)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
                  active
                    ? "border-shop-primary bg-shop-primary-soft text-shop-primary"
                    : "border-shop-line bg-white text-shop-body hover:border-shop-primary"
                }`}
              >
                {entry.label}
                <span className={active ? "ml-1.5 font-semibold" : "ml-1.5 text-shop-muted"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or SKU"
          className="field-shop ml-auto w-full max-w-[280px] text-[15px]"
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-pop-red-soft px-4 py-3 text-[15px] font-medium text-pop-red">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mb-4 rounded-xl bg-shop-successbg px-4 py-3 text-[15px] font-medium text-shop-success">
          {notice}
        </p>
      )}

      {products === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-skeleton rounded-2xl bg-shop-hairline" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-shop-line bg-white p-12 text-center">
          <p className="text-[17px] font-semibold text-shop-ink">
            {products.length === 0 ? "No products yet" : "Nothing matches that"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-shop-muted">
            {products.length === 0
              ? "Add your first listing and it goes for approval straight away."
              : "Try a different filter or clear the search."}
          </p>
          {products.length === 0 && (
            <Link href="/seller/products/new" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
              Add a product
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              busy={busyId === product.id}
              onRestock={(quantity) => restock(product, quantity)}
              onEdit={() => setEditing(product)}
              onVisibility={(hide) => setVisibility(product, hide)}
              onDelete={() => remove(product)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            replace(saved);
            setEditing(null);
            setNotice(`${saved.name} updated.`);
          }}
        />
      )}
    </div>
  );
}

function ProductRow({
  product,
  busy,
  onRestock,
  onEdit,
  onVisibility,
  onDelete,
}: {
  product: SellerProduct;
  busy: boolean;
  onRestock: (quantity: number) => void;
  onEdit: () => void;
  onVisibility: (hide: boolean) => void;
  onDelete: () => void;
}) {
  const [stock, setStock] = useState(String(product.stock_quantity ?? 0));
  const [menuOpen, setMenuOpen] = useState(false);

  // The row can be updated from the slide-over editor as well as from here, so
  // the input has to follow the saved value. Adjusting during render is React's
  // own answer to this — an effect would paint the stale number first, then
  // immediately re-render with the right one.
  const [syncedFrom, setSyncedFrom] = useState(product.stock_quantity);
  if (product.stock_quantity !== syncedFrom) {
    setSyncedFrom(product.stock_quantity);
    setStock(String(product.stock_quantity ?? 0));
  }

  const dirty = String(product.stock_quantity ?? 0) !== stock;
  const soldOut = product.stock_status === "outofstock";
  const low =
    !soldOut &&
    product.stock_quantity !== null &&
    product.stock_quantity > 0 &&
    product.stock_quantity <= LOW_STOCK_AT;

  return (
    <li
      className={`rounded-2xl border bg-white p-4 transition-opacity ${
        busy ? "opacity-60" : ""
      } ${soldOut ? "border-pop-red/40" : "border-shop-line"}`}
    >
      <div className="flex flex-wrap items-center gap-4">
        {/* Thumbnail + title */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-shop-hairline">
            {product.image && (
              <Image src={product.image} alt="" fill sizes="64px" className="object-cover" quality={90} />
            )}
          </div>

          <div className="min-w-0">
            <p className="line-clamp-1 text-[16px] font-semibold text-shop-ink">{product.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                  STATUS_BADGE[product.status] ?? STATUS_BADGE.draft
                }`}
              >
                {STATUS_LABEL[product.status] ?? product.status}
              </span>
              {soldOut && (
                <span className="rounded-full bg-pop-red-soft px-2 py-0.5 text-[12px] font-semibold text-pop-red">
                  Out of stock
                </span>
              )}
              {low && (
                <span className="rounded-full bg-pop-orange-soft px-2 py-0.5 text-[12px] font-semibold text-pop-orange">
                  Only {product.stock_quantity} left
                </span>
              )}
              {product.sku && (
                <span className="text-[13px] text-shop-muted">SKU {product.sku}</span>
              )}
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="w-28 shrink-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-shop-muted">
            Price
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-shop-ink">
            {formatPrice(product.price)}
          </p>
          {product.sale_price ? (
            <p className="text-[12px] text-shop-muted line-through">
              {formatPrice(product.regular_price)}
            </p>
          ) : null}
        </div>

        {/* Sold */}
        <div className="w-20 shrink-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-shop-muted">
            Sold
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-shop-ink">{product.units_sold}</p>
        </div>

        {/* Inline restock — the job done most often, so it is on the row. */}
        <div className="shrink-0">
          <label className="block">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-shop-muted">
              In stock
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && dirty) onRestock(Number(stock) || 0);
                }}
                aria-label={`Stock for ${product.name}`}
                className="h-10 w-20 rounded-lg border border-shop-line px-2.5 text-center text-[15px] font-semibold text-shop-ink focus:border-shop-primary focus:outline-none"
              />
              <button
                type="button"
                disabled={!dirty || busy}
                onClick={() => onRestock(Number(stock) || 0)}
                className="h-10 rounded-lg bg-shop-primary px-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:bg-shop-hairline disabled:text-shop-muted"
              >
                Save
              </button>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="relative flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-shop-line px-4 py-2.5 text-[14px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`More actions for ${product.name}`}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-shop-line text-shop-body hover:border-shop-primary hover:text-shop-primary"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-shop-line bg-white py-1 shadow-xl">
                <Link
                  href={`/products/${product.id}`}
                  target="_blank"
                  className="block px-4 py-2.5 text-[14px] text-shop-body hover:bg-shop-hairline"
                >
                  View in the shop
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onVisibility(product.status !== "draft");
                  }}
                  className="block w-full px-4 py-2.5 text-left text-[14px] text-shop-body hover:bg-shop-hairline"
                >
                  {product.status === "draft" ? "Send for review" : "Hide from shop"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-pop-red hover:bg-pop-red-soft"
                >
                  Delete listing
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
