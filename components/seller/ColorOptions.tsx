"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { sellerApi } from "@/lib/seller";

export type ColorOption = {
  /** Local row identity. Not sent — the name is the key on the wire. */
  key: number;
  name: string;
  /** Media-library URL, uploaded as soon as it is picked. */
  image: string | null;
  uploading: boolean;
};

let nextKey = 1;

export function emptyColorRow(): ColorOption {
  return { key: nextKey++, name: "", image: null, uploading: false };
}

/**
 * The colours a listing comes in, each with a photograph of the product in it.
 *
 * ---- Why this replaced a comma-separated text box ----
 *
 * Colours used to be one input: "Multicolor, Beige, Black". That is the whole
 * information a shopper got, and it is close to none — "Multicolor" describes
 * nothing, and a colour name on a printed fabric describes barely more. The
 * storefront could only draw it as a CSS dot, so `backgroundColor: "beige"` was
 * the browser's idea of beige rather than the product's, and "Multicolor" fell
 * back to a transparent circle.
 *
 * A picture of the product in that colour says all of it at once, which is what
 * every marketplace this shop competes with shows. The picker on the product
 * page already knew how to display one and already swaps the main gallery shot
 * when a colour with a photograph is chosen — see `ColorSwatch` and the
 * `handleOptionChange` in `ProductPurchase`. Nothing was ever filling that
 * field for a seller's own listing. This is the form that fills it.
 *
 * ---- The image is optional, per colour ----
 *
 * A seller with eight colours and photographs of three should be able to list
 * all eight. A row with a name and no picture is valid and files as a plain
 * colour; the swatch falls back to the dot for that one option. Requiring a
 * photograph per colour would push sellers into either dropping colours or
 * uploading the same shot eight times.
 */
export default function ColorOptions({
  rows,
  onChange,
  onBusyChange,
}: {
  rows: ColorOption[];
  onChange: (rows: ColorOption[]) => void;
  /** Fires while any row is uploading, so the form can hold back submit. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // One hidden input per row would be one ref per row; a single input that
  // remembers which row opened it is simpler and cannot get out of step.
  const fileRef = useRef<HTMLInputElement>(null);
  const targetKey = useRef<number | null>(null);

  const update = (next: ColorOption[]) => {
    onChange(next);
    onBusyChange?.(next.some((row) => row.uploading));
  };

  const patch = (key: number, changes: Partial<ColorOption>) => {
    // Read from the ref-free latest list the caller holds, so two uploads
    // finishing at once cannot each overwrite the other's row.
    onChange(rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  const pickImage = (key: number) => {
    targetKey.current = key;
    setError(null);
    fileRef.current?.click();
  };

  const upload = async (file: File) => {
    const key = targetKey.current;
    if (key === null) return;

    update(rows.map((row) => (row.key === key ? { ...row, uploading: true } : row)));

    try {
      const { url } = await sellerApi.uploadImage(file);
      onChange(
        rows.map((row) => (row.key === key ? { ...row, image: url, uploading: false } : row))
      );
      onBusyChange?.(false);
    } catch (caught) {
      onChange(rows.map((row) => (row.key === key ? { ...row, uploading: false } : row)));
      onBusyChange?.(false);
      setError(caught instanceof Error ? caught.message : "That photo would not upload.");
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared before the upload so picking the same file twice in a row
          // still fires a change event.
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => pickImage(row.key)}
            disabled={row.uploading}
            aria-label={row.name ? `Photo for ${row.name}` : "Photo for this colour"}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-shop-photo ring-1 ring-shop-line transition-colors hover:ring-shop-primary disabled:opacity-60"
          >
            {row.uploading ? (
              <span className="flex h-full items-center justify-center text-[11px] font-semibold text-shop-muted">
                …
              </span>
            ) : row.image ? (
              <Image src={row.image} alt="" fill sizes="56px" className="object-cover" />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-0.5 text-shop-muted">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[9px] font-semibold uppercase tracking-wide">Photo</span>
              </span>
            )}
          </button>

          <input
            value={row.name}
            onChange={(event) => patch(row.key, { name: event.target.value })}
            placeholder="Colour name, e.g. Black"
            aria-label="Colour name"
            className="h-11 min-w-0 flex-1 rounded-lg border border-shop-line px-3 text-[15px] text-shop-ink focus:border-shop-primary focus:outline-none"
          />

          {row.image && (
            <button
              type="button"
              onClick={() => patch(row.key, { image: null })}
              className="shrink-0 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-shop-body transition-colors hover:text-shop-ink"
            >
              Remove photo
            </button>
          )}

          <button
            type="button"
            onClick={() => update(rows.filter((entry) => entry.key !== row.key))}
            aria-label={row.name ? `Remove ${row.name}` : "Remove this colour"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-shop-line text-shop-body transition-colors hover:border-shop-ink hover:text-shop-ink"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-[13px] font-medium text-shop-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => update([...rows, emptyColorRow()])}
        className="rounded-lg border border-shop-line px-3.5 py-2 text-[13.5px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
      >
        + Add a colour
      </button>
    </div>
  );
}

/** The finished rows, as the two fields the API takes. */
export function colorPayload(rows: ColorOption[]) {
  const named = rows
    .map((row) => ({ ...row, name: row.name.trim() }))
    .filter((row) => row.name.length > 0);

  const images: Record<string, string> = {};
  for (const row of named) {
    if (row.image) images[row.name] = row.image;
  }

  return {
    // De-duplicated: two rows named "Black" would otherwise become two
    // identical, separately-pickable options on the product page.
    colors: [...new Set(named.map((row) => row.name))],
    color_images: images,
  };
}
