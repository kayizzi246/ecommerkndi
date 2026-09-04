"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { sellerApi } from "@/lib/seller";

/**
 * The store's profile picture, uploaded from the seller's own device.
 *
 * ---- What this replaces ----
 *
 * A text box labelled "Logo URL". To fill it a seller had to already have their
 * picture hosted somewhere with a public address, and then find that address —
 * which on a phone, which is what most of them are using, is not a thing that
 * happens. So almost every store on the marketplace showed the grey initial
 * circle, and the one piece of identity a seller could have given their page
 * was the one piece nobody could work out how to supply.
 *
 * The upload endpoint already existed: `sellerApi.uploadImage` is what the
 * product form has always used for photographs. This is that, pointed at the
 * logo field.
 *
 * ---- Why the preview is a circle ----
 *
 * Because the store page draws it in one. A square preview here would let a
 * seller approve a picture whose corners are about to be cut off, which is the
 * commonest way a logo ends up with half a word missing.
 */

/** Matches the plugin's own ceiling — see KANDI_SELLER_MAX_UPLOAD. */
const MAX_BYTES = 8 * 1024 * 1024;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export default function LogoUploader({
  value,
  onChange,
  storeName,
}: {
  value: string;
  onChange: (url: string) => void;
  storeName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;

    /* Checked here as well as on the server, because the useful thing about
       catching it here is the wait: an 8MB photo over a Ugandan mobile
       connection is a minute of upload before the server says no. */
    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is larger than 8 MB. Try a smaller one.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { url } = await sellerApi.uploadImage(file);
      onChange(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload that image.");
    } finally {
      setBusy(false);
      // Cleared so choosing the SAME file again still fires a change event —
      // which is exactly what somebody does after a failed upload.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-bfl-surface ring-1 ring-bfl-line">
        {value ? (
          <Image
            src={value}
            alt=""
            fill
            sizes="80px"
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[26px] font-bold text-shop-primary">
            {storeName.charAt(0).toUpperCase() || "?"}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={(event) => void pick(event.target.files?.[0])}
          className="hidden"
          id="store-logo-file"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded border border-black bg-black px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {busy ? "Uploading…" : value ? "Change picture" : "Upload a picture"}
          </button>

          {value && !busy && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded border border-bfl-line px-3 py-2 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
            >
              Remove
            </button>
          )}
        </div>

        <p className="mt-2 text-[13px] text-bfl-grey">
          Square works best — it is shown in a circle. Up to 8 MB.
        </p>

        {error && (
          <p role="alert" className="mt-1.5 text-[13px] font-medium text-shop-sale">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
