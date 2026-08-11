"use client";

import { useEffect, useState } from "react";
import { sellerApi, type SellerProduct } from "@/lib/seller";
import { formatPrice, discountPercent } from "@/lib/currency";
import ImageUploader from "./ImageUploader";

type Props = {
  product: SellerProduct;
  onSaved: (product: SellerProduct) => void;
  onClose: () => void;
};

/**
 * Slide-over editor for one listing.
 *
 * The fields a seller changes day to day — name, prices, stock, SKU — plus the
 * photographs, because a bad or missing photo is the single most common reason
 * a listing does not sell and it should not take the full form to fix one. The
 * long-form description still lives there.
 *
 * Nothing is sent until Save, and the payload carries only what actually
 * changed, so a stray keystroke in one field cannot quietly rewrite another —
 * `image_urls` in particular is omitted unless the gallery was touched, since
 * sending it replaces every photo on the product.
 */
export default function ProductEditor({ product, onSaved, onClose }: Props) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [regular, setRegular] = useState(String(product.regular_price || ""));
  const [sale, setSale] = useState(product.sale_price ? String(product.sale_price) : "");
  const [stock, setStock] = useState(String(product.stock_quantity ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Older payloads only carried the main photo, so fall back to it rather than
  // opening the editor on an empty gallery for a product that plainly has one.
  const originalPhotos =
    product.images?.length ? product.images : product.image ? [product.image] : [];
  const [photos, setPhotos] = useState<string[]>(originalPhotos);
  const [uploading, setUploading] = useState(false);
  const photosChanged = photos.join("\n") !== originalPhotos.join("\n");

  // Escape closes, and the page behind stops scrolling while it is open.
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
    if (uploading) {
      setError("Wait for the photos to finish uploading.");
      return;
    }
    if (photos.length === 0) {
      setError("Keep at least one photo — a listing without a picture does not sell.");
      return;
    }

    setBusy(true);
    try {
      const { product: saved } = await sellerApi.updateProduct(product.id, {
        name: name.trim(),
        sku: sku.trim(),
        regular_price: regularNumber,
        sale_price: saleNumber,
        stock_quantity: Math.max(0, Number(stock) || 0),
        ...(photosChanged ? { image_urls: photos } : {}),
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${product.name}`}
        className="step-in relative flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-shop-line px-5 py-4">
          <h2 className="text-[18px] font-extrabold text-shop-ink">Edit listing</h2>
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
          <div>
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">Photos</span>
            <ImageUploader
              initialUrls={originalPhotos}
              onChange={setPhotos}
              onBusyChange={setUploading}
              shape="soft"
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">Product name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field-shop text-[15px]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">SKU</span>
            <input
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="Your own reference code"
              className="field-shop text-[15px]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">Price (UGX)</span>
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
            <p className="rounded-xl bg-pop-green-soft px-4 py-3 text-[14px] font-semibold text-pop-green">
              Shoppers see {formatPrice(saleNumber ?? 0)} — a {discount}% saving on{" "}
              {formatPrice(regularNumber)}.
            </p>
          )}

          <div>
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">Stock</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStock(String(Math.max(0, (Number(stock) || 0) - 1)))}
                aria-label="Decrease stock"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-shop-line text-[20px] text-shop-body hover:border-shop-primary hover:text-shop-primary"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="field-shop text-center text-[16px] font-semibold"
              />
              <button
                type="button"
                onClick={() => setStock(String((Number(stock) || 0) + 1))}
                aria-label="Increase stock"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-shop-line text-[20px] text-shop-body hover:border-shop-primary hover:text-shop-primary"
              >
                +
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 25, 50].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setStock(String((Number(stock) || 0) + amount))}
                  className="rounded-full border border-shop-line px-3 py-1.5 text-[13px] font-semibold text-shop-body hover:border-shop-primary hover:text-shop-primary"
                >
                  +{amount}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-shop-muted">
              {Number(stock) > 0
                ? "This listing is buyable."
                : "At zero the listing shows as sold out and nobody can order it."}
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex gap-3 border-t border-shop-line px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-shop-outline flex-1 py-3 text-[15px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || uploading}
            className="btn-shop flex-1 py-3 text-[15px]"
          >
            {busy ? "Saving…" : uploading ? "Uploading photos…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
