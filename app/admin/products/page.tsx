"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ownerApi, OwnerApiError, type OwnerCategory, type OwnerProduct } from "@/lib/owner";
import { formatPrice } from "@/lib/currency";
import OwnerProductForm from "./OwnerProductForm";

type Filter = "all" | "publish" | "draft" | "outofstock" | "mine" | "sellers";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "publish", label: "Live" },
  { value: "draft", label: "Hidden" },
  { value: "outofstock", label: "Out of stock" },
  { value: "mine", label: "Mine" },
  { value: "sellers", label: "Sellers'" },
];

const STATUS_BADGE: Record<string, string> = {
  publish: "bg-shop-successbg text-shop-success",
  pending: "bg-pop-orange-soft text-pop-orange",
  draft: "bg-shop-hairline text-shop-muted",
  private: "bg-pop-violet-soft text-pop-violet",
};

const STATUS_LABEL: Record<string, string> = {
  publish: "Live",
  pending: "In review",
  draft: "Hidden",
  private: "Private",
};

/**
 * The owner's product manager.
 *
 * This is the screen the Seller Centre could never be: it lists every product
 * in the shop, whoever created it, including everything added straight in
 * wp-admin. Adding a product here publishes it immediately — the owner is the
 * approver, so there is nobody to wait for.
 */
export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<OwnerProduct[] | null>(null);
  const [categories, setCategories] = useState<OwnerCategory[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** null = closed, "new" = create, a product = edit that one. */
  const [editing, setEditing] = useState<OwnerProduct | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ products: list }, { categories: cats }] = await Promise.all([
          ownerApi.products(),
          ownerApi.categories(),
        ]);
        if (cancelled) return;
        setProducts(list);
        setCategories(cats);
      } catch (caught) {
        if (cancelled) return;
        // No cookie, or a passcode that WordPress no longer accepts: there is
        // nothing to show and nothing to retry, so go and ask for it.
        if (caught instanceof OwnerApiError && caught.status === 401) {
          router.replace("/admin/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load your products.");
        setProducts([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const counts = useMemo(() => {
    const all = products ?? [];
    return {
      all: all.length,
      publish: all.filter((p) => p.status === "publish").length,
      draft: all.filter((p) => p.status === "draft").length,
      outofstock: all.filter((p) => p.stock_status === "outofstock").length,
      mine: all.filter((p) => p.seller_id === 0).length,
      sellers: all.filter((p) => p.seller_id > 0).length,
    } satisfies Record<Filter, number>;
  }, [products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "outofstock"
            ? product.stock_status === "outofstock"
            : filter === "mine"
              ? product.seller_id === 0
              : filter === "sellers"
                ? product.seller_id > 0
                : product.status === filter;

      const matchesQuery =
        needle.length === 0 ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle);

      return matchesFilter && matchesQuery;
    });
  }, [products, filter, query]);

  const replace = (saved: OwnerProduct) => {
    setProducts((current) =>
      (current ?? []).map((entry) => (entry.id === saved.id ? saved : entry))
    );
  };

  const run = async (product: OwnerProduct, work: () => Promise<void>) => {
    setBusyId(product.id);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setBusyId(null);
    }
  };

  const restock = (product: OwnerProduct, quantity: number) =>
    run(product, async () => {
      const { product: saved } = await ownerApi.updateProduct(product.id, {
        stock_quantity: Math.max(0, quantity),
      });
      replace(saved);
      setNotice(`${saved.name} set to ${saved.stock_quantity ?? 0} in stock.`);
    });

  const setVisibility = (product: OwnerProduct, publish: boolean) =>
    run(product, async () => {
      // The owner publishes directly — no approval step, because there is
      // nobody above them to approve it.
      const { product: saved } = await ownerApi.updateProduct(product.id, {
        status: publish ? "publish" : "draft",
      });
      replace(saved);
      setNotice(publish ? `${saved.name} is live.` : `${saved.name} is hidden from the shop.`);
    });

  const remove = (product: OwnerProduct) => {
    if (
      !window.confirm(
        `Delete "${product.name}"?\n\nIt goes to the WordPress trash, so past orders keep their record of it and you can restore it from wp-admin.`
      )
    ) {
      return;
    }
    return run(product, async () => {
      await ownerApi.deleteProduct(product.id);
      setProducts((current) => (current ?? []).filter((entry) => entry.id !== product.id));
      setNotice(`${product.name} deleted.`);
    });
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight text-shop-ink">Products</h1>
          <p className="mt-1 text-[15px] text-shop-muted">
            Every product in the shop — yours and your sellers&rsquo;. Changes go
            live on the storefront straight away.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshCatalogue />
          <button type="button" onClick={() => setEditing("new")} className="btn-shop px-6 py-3 text-[15px]">
            Add a product
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((entry) => {
            const active = filter === entry.value;
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
                <span className={active ? "ml-1.5" : "ml-1.5 text-shop-muted"}>
                  {counts[entry.value]}
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
        <p role="alert" className="mb-4 rounded-lg bg-pop-red-soft px-4 py-3 text-[15px] font-medium text-pop-red">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mb-4 rounded-lg bg-shop-successbg px-4 py-3 text-[15px] font-medium text-shop-success">
          {notice}
        </p>
      )}

      {products === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-skeleton rounded-lg bg-shop-hairline" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-shop-line bg-white p-12 text-center">
          <p className="text-[17px] font-semibold text-shop-ink">
            {products.length === 0 ? "No products yet" : "Nothing matches that"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-shop-muted">
            {products.length === 0
              ? "Add your first listing — it goes live on the shop immediately."
              : "Try a different filter or clear the search."}
          </p>
          {products.length === 0 && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]"
            >
              Add a product
            </button>
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
              onVisibility={(publish) => setVisibility(product, publish)}
              onDelete={() => remove(product)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <OwnerProductForm
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            if (created) {
              setProducts((current) => [saved, ...(current ?? [])]);
              setNotice(`${saved.name} added and live in the shop.`);
            } else {
              replace(saved);
              setNotice(`${saved.name} updated.`);
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Clears the storefront's cached catalogue by hand.
 *
 * WordPress pings the same endpoint automatically on every product change, but
 * only once *Kandi Storefront → Storefront URL* is filled in. Until it is — or
 * if the ping fails because the storefront was briefly unreachable — this is the
 * button that makes a deletion show up on the shop straight away.
 */
function RefreshCatalogue() {
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");

  return (
    <button
      type="button"
      disabled={state === "working"}
      onClick={async () => {
        setState("working");
        try {
          const response = await fetch("/api/revalidate", { method: "POST" });
          setState(response.ok ? "done" : "failed");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 4000);
      }}
      className="btn-shop-outline px-5 py-3 text-[14px] disabled:opacity-60"
    >
      {state === "working"
        ? "Refreshing…"
        : state === "done"
          ? "Shop refreshed ✓"
          : state === "failed"
            ? "Could not refresh"
            : "Refresh shop"}
    </button>
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
  product: OwnerProduct;
  busy: boolean;
  onRestock: (quantity: number) => void;
  onEdit: () => void;
  onVisibility: (publish: boolean) => void;
  onDelete: () => void;
}) {
  const [stock, setStock] = useState(String(product.stock_quantity ?? 0));

  // The row is also updated from the slide-over, so the input has to follow the
  // saved value. Adjusting during render is React's own answer to this — an
  // effect would paint the stale number first and re-render immediately after.
  const [syncedFrom, setSyncedFrom] = useState(product.stock_quantity);
  if (product.stock_quantity !== syncedFrom) {
    setSyncedFrom(product.stock_quantity);
    setStock(String(product.stock_quantity ?? 0));
  }

  const dirty = String(product.stock_quantity ?? 0) !== stock;
  const soldOut = product.stock_status === "outofstock";

  return (
    <li
      className={`rounded-lg border bg-white p-4 transition-opacity ${busy ? "opacity-60" : ""} ${
        soldOut ? "border-pop-red/40" : "border-shop-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-shop-hairline">
            {product.image && (
              // `unoptimized` because photos can come from any media library the
              // owner pastes a URL from, not only the hosts in next.config.
              <Image src={product.image} alt="" fill sizes="64px" unoptimized className="object-cover" />
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
              {product.seller_id > 0 && (
                <span className="rounded-full bg-pop-blue-soft px-2 py-0.5 text-[12px] font-semibold text-pop-blue">
                  {product.seller_name || "Seller listing"}
                </span>
              )}
              {product.sku && <span className="text-[13px] text-shop-muted">SKU {product.sku}</span>}
            </div>
          </div>
        </div>

        <div className="w-28 shrink-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-shop-muted">Price</p>
          <p className="mt-0.5 text-[16px] font-semibold text-shop-ink">
            {formatPrice(product.price)}
          </p>
          {product.sale_price ? (
            <p className="text-[12px] text-shop-muted line-through">
              {formatPrice(product.regular_price)}
            </p>
          ) : null}
        </div>

        <div className="w-20 shrink-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-shop-muted">Sold</p>
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

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/products/${product.id}`}
            target="_blank"
            className="rounded-lg border border-shop-line px-3 py-2.5 text-[14px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            View
          </Link>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-shop-line px-4 py-2.5 text-[14px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onVisibility(product.status !== "publish")}
            className="rounded-lg border border-shop-line px-4 py-2.5 text-[14px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary disabled:opacity-50"
          >
            {product.status === "publish" ? "Hide" : "Publish"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="rounded-lg border border-pop-red/30 px-4 py-2.5 text-[14px] font-semibold text-pop-red transition-colors hover:bg-pop-red-soft disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
