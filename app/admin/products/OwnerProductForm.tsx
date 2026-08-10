"use client";

import { useEffect, useState } from "react";
import {
  ownerApi,
  type OwnerCategory,
  type OwnerProduct,
  type OwnerProductInput,
  type OwnerProductStatus,
} from "@/lib/owner";
import { formatPrice, discountPercent } from "@/lib/currency";

type Props = {
  /** null creates a new listing; a product edits that one. */
  product: OwnerProduct | null;
  categories: OwnerCategory[];
  onSaved: (product: OwnerProduct, created: boolean) => void;
  onClose: () => void;
};

/** Comma- or newline-separated free text into a clean list. */
function toList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * The full listing form, used for both adding and editing.
 *
 * One form rather than two screens: the fields are identical, and the only real
 * difference is that a new product needs a price before it can be saved at all,
 * which the same validation covers.
 */
export default function OwnerProductForm({ product, categories, onSaved, onClose }: Props) {
  const creating = product === null;

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState(product?.categories[0] ?? "");
  const [regular, setRegular] = useState(
    product?.regular_price ? String(product.regular_price) : ""
  );
  const [sale, setSale] = useState(product?.sale_price ? String(product.sale_price) : "");
  const [stock, setStock] = useState(String(product?.stock_quantity ?? 0));
  const [status, setStatus] = useState<OwnerProductStatus>(product?.status ?? "publish");
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [images, setImages] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes, and the list behind stops scrolling while this is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const regularNumber = Number(regular) || 0;
  const saleNumber = sale.trim() === "" ? null : Number(sale);
  const discount =
    saleNumber !== null && saleNumber > 0 ? discountPercent(regularNumber, saleNumber) : 0;

  const save = async () => {
    setError(null);

    if (name.trim().length < 2) {
      setError("The product needs a name.");
      return;
    }
    if (regularNumber <= 0) {
      setError("Set a price above zero.");
      return;
    }
    if (saleNumber !== null && (Number.isNaN(saleNumber) || saleNumber <= 0)) {
      setError("The sale price must be a number above zero, or empty.");
      return;
    }
    if (saleNumber !== null && saleNumber >= regularNumber) {
      setError("The sale price has to be below the normal price.");
      return;
    }

    const payload: OwnerProductInput = {
      name: name.trim(),
      sku: sku.trim(),
      category: category.trim(),
      regular_price: regularNumber,
      sale_price: saleNumber,
      stock_quantity: Math.max(0, Number(stock) || 0),
      status,
      short_description: shortDescription,
      description,
    };

    // Attributes and photos are only sent when something was typed: an empty
    // box means "leave these alone", not "clear them".
    const sizeList = toList(sizes);
    const colorList = toList(colors);
    if (sizeList.length || colorList.length) {
      payload.sizes = sizeList;
      payload.colors = colorList;
    }
    const imageList = toList(images);
    if (imageList.length) {
      payload.image_urls = imageList;
    }

    setBusy(true);
    try {
      const { product: saved } = creating
        ? await ownerApi.createProduct(payload)
        : await ownerApi.updateProduct(product.id, payload);
      onSaved(saved, creating);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the product.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close form"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={creating ? "Add a product" : `Edit ${product.name}`}
        className="step-in relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-shop-line px-5 py-4">
          <h2 className="text-[19px] text-shop-ink">
            {creating ? "Add a product" : "Edit product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] leading-none text-shop-muted hover:bg-shop-hairline hover:text-shop-ink"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
              Product name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus={creating}
              className="field-shop text-[15px]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">SKU</span>
              <input
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Your own reference code"
                className="field-shop text-[15px]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
                Category
              </span>
              {/* A free text box backed by a list: pick an existing category, or
                  type a new name and it is created on save. */}
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                list="owner-categories"
                placeholder="e.g. Shoes"
                className="field-shop text-[15px]"
              />
              <datalist id="owner-categories">
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.name} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
                Price (UGX)
              </span>
              <input
                type="number"
                min={0}
                step={500}
                value={regular}
                onChange={(event) => setRegular(event.target.value)}
                className="field-shop text-[15px]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
                Sale price
                <span className="ml-1 font-normal text-shop-muted">(optional)</span>
              </span>
              <input
                type="number"
                min={0}
                step={500}
                value={sale}
                onChange={(event) => setSale(event.target.value)}
                placeholder="Leave empty"
                className="field-shop text-[15px]"
              />
            </label>
          </div>

          {discount > 0 && (
            <p className="rounded-lg bg-pop-green-soft px-4 py-3 text-[14px] font-semibold text-pop-green">
              Shoppers see {formatPrice(saleNumber ?? 0)} — a {discount}% saving on{" "}
              {formatPrice(regularNumber)}.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
                In stock
              </span>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="field-shop text-[15px]"
              />
              <span className="mt-1.5 block text-[13px] text-shop-muted">
                {Number(stock) > 0 ? "Buyable." : "Shows as sold out."}
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
                Visibility
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as OwnerProductStatus)}
                className="field-shop text-[15px]"
              >
                <option value="publish">Live in the shop</option>
                <option value="draft">Hidden</option>
                <option value="pending">Pending review</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
              Short description
            </span>
            <textarea
              rows={2}
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value)}
              placeholder="The line shoppers read beside the price"
              className="field-shop text-[15px]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
              Full description
            </span>
            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field-shop text-[15px]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
              Photo URLs
            </span>
            <textarea
              rows={3}
              value={images}
              onChange={(event) => setImages(event.target.value)}
              placeholder={"One URL per line. The first becomes the main photo."}
              className="field-shop text-[15px]"
            />
            <span className="mt-1.5 block text-[13px] text-shop-muted">
              {creating
                ? "Copied into your WordPress media library on save."
                : "Leave empty to keep the photos this product already has."}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">Sizes</span>
              <input
                value={sizes}
                onChange={(event) => setSizes(event.target.value)}
                placeholder="39, 40, 41"
                className="field-shop text-[15px]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">Colours</span>
              <input
                value={colors}
                onChange={(event) => setColors(event.target.value)}
                placeholder="Black, White"
                className="field-shop text-[15px]"
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex gap-3 border-t border-shop-line px-5 py-4">
          <button type="button" onClick={onClose} className="btn-shop-outline flex-1 py-3 text-[15px]">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-shop flex-1 py-3 text-[15px]">
            {busy ? "Saving…" : creating ? "Add product" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
