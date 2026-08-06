"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sellerApi } from "@/lib/seller";
import { formatPrice, discountPercent } from "@/lib/currency";
import { useSellerSession } from "@/lib/seller-session";

const CATEGORIES = [
  "Men",
  "Women",
  "Kids",
  "Sportswear",
  "Shoes",
  "Bags & accessories",
  "Home & Living",
  "Beauty",
];

const INPUT =
  "w-full border border-bfl-line px-3 py-2.5 text-[14px] focus:border-black focus:outline-none";

export default function NewProductPage() {
  const router = useRouter();
  const { seller } = useSellerSession();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("1");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [imageUrls, setImageUrls] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const regular = Number(regularPrice) || 0;
  const sale = Number(salePrice) || 0;
  const effectivePrice = sale > 0 && sale < regular ? sale : regular;
  const discount = sale > 0 && sale < regular ? discountPercent(regular, sale) : 0;
  const commissionRate = seller?.commission_rate ?? 0;
  const commission = (effectivePrice * commissionRate) / 100;

  const splitList = (value: string) =>
    value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (regular <= 0) {
      setError("Enter a regular price greater than zero.");
      return;
    }
    if (sale > 0 && sale >= regular) {
      setError("The sale price must be lower than the regular price.");
      return;
    }

    setSubmitting(true);
    try {
      await sellerApi.createProduct({
        name,
        sku,
        category,
        short_description: shortDescription,
        description,
        regular_price: regular,
        sale_price: sale > 0 ? sale : null,
        stock_quantity: Number(stock) || 0,
        sizes: splitList(sizes),
        colors: splitList(colors),
        image_urls: splitList(imageUrls),
      });
      router.push("/seller/products");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create that product.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1000px]">
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-bfl-grey">
        <Link href="/seller/products" className="hover:text-black hover:underline">
          Products
        </Link>
        <span>/</span>
        <span className="text-black">New listing</span>
      </nav>

      <h1 className="text-[24px] font-bold text-black">Add a product</h1>
      <p className="mt-1 text-[13px] text-bfl-grey">
        New listings are submitted for approval and appear on the storefront once our team clears them.
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* Basics */}
          <Section title="Product details">
            <Field label="Product name" hint="Shoppers see this exactly as written.">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Toddlers Girl 2 Pcs Floral Print Dress Jumpsuit"
                className={INPUT}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU / style code">
                <input value={sku} onChange={(e) => setSku(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Short description" hint="One or two lines, shown under the price.">
              <textarea
                rows={2}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Full description">
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fabric, fit, care instructions…"
                className={INPUT}
              />
            </Field>
          </Section>

          {/* Pricing */}
          <Section title="Pricing & stock">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Regular price (UGX)">
                <input
                  required
                  inputMode="numeric"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Sale price (UGX)" hint="Optional.">
                <input
                  inputMode="numeric"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Stock quantity">
                <input
                  required
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
          </Section>

          {/* Variants */}
          <Section title="Options">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sizes" hint="Comma separated, e.g. 12 M, 24 M">
                <input value={sizes} onChange={(e) => setSizes(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Colours" hint="Comma separated, e.g. Multicolor, Beige">
                <input value={colors} onChange={(e) => setColors(e.target.value)} className={INPUT} />
              </Field>
            </div>
          </Section>

          {/* Images */}
          <Section title="Images">
            <Field
              label="Image URLs"
              hint="One per line. The first becomes the main image; the rest fill the gallery."
            >
              <textarea
                rows={4}
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                placeholder={"https://…/front.jpg\nhttps://…/back.jpg"}
                className={INPUT}
              />
            </Field>
          </Section>

          {error && (
            <p role="alert" className="border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[13px] text-[#a51f1f]">
              {error}
            </p>
          )}
        </div>

        {/* Sticky summary */}
        <aside className="h-fit lg:sticky lg:top-20">
          <div className="border border-bfl-line bg-white p-5">
            <h2 className="text-[15px] font-bold text-black">Listing summary</h2>

            <dl className="mt-4 space-y-2.5 text-[13px]">
              <Row label="Selling price" value={effectivePrice > 0 ? formatPrice(effectivePrice) : "—"} bold />
              {discount > 0 && (
                <Row
                  label="Shopper sees"
                  value={`${formatPrice(regular)} · ${discount}% OFF`}
                />
              )}
              <Row label={`Commission (${commissionRate}%)`} value={`− ${formatPrice(commission)}`} />
              <div className="border-t border-bfl-line pt-2.5">
                <Row
                  label="You receive per unit"
                  value={effectivePrice > 0 ? formatPrice(effectivePrice - commission) : "—"}
                  bold
                />
              </div>
            </dl>

            <button type="submit" disabled={submitting} className="btn-bfl mt-5 w-full py-3 text-[14px]">
              {submitting ? "Submitting…" : "Submit for approval"}
            </button>

            <Link
              href="/seller/products"
              className="mt-2 block w-full border border-bfl-line py-2.5 text-center text-[13px] font-bold text-[#333] hover:border-black"
            >
              Cancel
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-bfl-line bg-white p-5">
      <h2 className="mb-4 text-[15px] font-bold text-black">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[#333]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-bfl-grey">{hint}</span>}
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-bfl-grey">{label}</dt>
      <dd className={bold ? "font-bold text-black" : "text-[#333]"}>{value}</dd>
    </div>
  );
}
