"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { sellerApi, type SellerProduct } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";

type Filter = "all" | "publish" | "pending" | "outofstock";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "publish", label: "Live" },
  { value: "pending", label: "Awaiting approval" },
  { value: "outofstock", label: "Out of stock" },
];

const STATUS_BADGE: Record<string, string> = {
  publish: "bg-[#e7f7ea] text-[#0a7a2f]",
  pending: "bg-[#fff6dd] text-[#8a6100]",
  draft: "bg-bfl-surface text-bfl-grey",
};

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "outofstock"
            ? product.stock_status === "outofstock"
            : product.status === filter;
      const matchesQuery =
        needle.length === 0 ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [products, filter, query]);

  const remove = async (product: SellerProduct) => {
    const confirmed = window.confirm(
      `Delete “${product.name}”? This removes the listing from the storefront and cannot be undone.`
    );
    if (!confirmed) return;

    setBusyId(product.id);
    setError(null);
    try {
      await sellerApi.deleteProduct(product.id);
      setProducts((current) => (current ?? []).filter((item) => item.id !== product.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete that product.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-black">Products</h1>
          <p className="mt-1 text-[13px] text-bfl-grey">
            {products === null
              ? "Loading your catalogue…"
              : `${products.length} ${products.length === 1 ? "listing" : "listings"} in your catalogue`}
          </p>
        </div>
        <Link href="/seller/products/new" className="btn-bfl px-5 py-2.5 text-[13px]">
          Add a product
        </Link>
      </div>

      {/* Filters in one row above the table */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`rounded border px-3 py-1.5 text-[12px] transition-colors ${
                filter === item.value
                  ? "border-black bg-black font-bold text-white"
                  : "border-bfl-line bg-white text-[#333] hover:border-[#b0b0b0]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or SKU"
          className="ml-auto w-full max-w-[260px] rounded border border-bfl-line px-3 py-1.5 text-[13px] focus:border-black focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[13px] text-[#a51f1f]">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded border border-bfl-line bg-white">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="border-b border-bfl-line bg-bfl-surface text-left text-[12px] text-bfl-grey">
            <tr>
              <th className="px-4 py-3 font-bold">Product</th>
              <th className="px-4 py-3 font-bold">SKU</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 text-right font-bold">Price</th>
              <th className="px-4 py-3 text-right font-bold">Stock</th>
              <th className="px-4 py-3 text-right font-bold">Sold</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {products === null && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-bfl-grey">
                  Loading…
                </td>
              </tr>
            )}

            {products !== null && visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <p className="text-[14px] font-bold text-black">No products here yet</p>
                  <p className="mt-1 text-[13px] text-bfl-grey">
                    {products.length === 0
                      ? "Add your first listing to start selling on Kandi."
                      : "Try a different filter or search term."}
                  </p>
                  {products.length === 0 && (
                    <Link href="/seller/products/new" className="btn-bfl mt-4 inline-block px-5 py-2.5 text-[13px]">
                      Add a product
                    </Link>
                  )}
                </td>
              </tr>
            )}

            {visible.map((product) => (
              <tr key={product.id} className="border-b border-bfl-line last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-10 shrink-0 overflow-hidden bg-bfl-surface">
                      {product.image && (
                        <Image src={product.image} alt="" fill sizes="40px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-black">{product.name}</p>
                      <p className="truncate text-[12px] text-bfl-grey">
                        {product.categories.join(", ") || "Uncategorised"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-bfl-grey">{product.sku || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-1 text-[11px] font-bold ${
                      STATUS_BADGE[product.status] ?? STATUS_BADGE.draft
                    }`}
                  >
                    {product.status === "publish"
                      ? "Live"
                      : product.status === "pending"
                        ? "Awaiting approval"
                        : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold text-black">{formatPrice(product.price)}</span>
                  {product.sale_price !== null && product.regular_price > product.price && (
                    <span className="ml-1.5 text-[11px] text-bfl-grey line-through">
                      {formatPrice(product.regular_price)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {product.stock_status === "outofstock" ? (
                    <span className="font-bold text-bfl-red">Out of stock</span>
                  ) : (
                    <span className="text-[#333]">{product.stock_quantity ?? "In stock"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[#333]">{product.units_sold}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/products/${product.id}`} className="link-bfl text-[12px] font-bold">
                      View
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === product.id}
                      onClick={() => remove(product)}
                      className="text-[12px] font-bold text-bfl-red underline underline-offset-[3px] hover:text-[#a51f1f] disabled:opacity-50"
                    >
                      {busyId === product.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
