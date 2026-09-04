"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { sellerApi, type Seller } from "@/lib/seller";
import { inkFor } from "@/lib/contrast";

/**
 * The seller's own marketing panel: the colour of their store header, the short
 * link they hand out, and a QR code of it they can print.
 *
 * All three are the same job — getting somebody who is standing in front of the
 * seller onto the seller's page — so they belong on one card rather than
 * scattered through a settings form.
 */

/**
 * Eight grounds, and no free-form picker.
 *
 * A colour input would let a seller choose #fafafa and produce a header that is
 * invisible against the page, or a neon that makes their own name unreadable.
 * Every swatch here is dark enough or saturated enough to carry type — the
 * storefront still derives the ink from whatever is chosen, so nothing can
 * break, but the choice is between eight good answers rather than sixteen
 * million of which most are bad.
 *
 * The hex is still accepted by the API, so a shop that wants an exact brand
 * colour can be set from wp-admin. This is the seller-facing safe set.
 */
const SWATCHES = [
  { hex: "#1c1a18", name: "Charcoal" },
  { hex: "#7c2d12", name: "Rust" },
  { hex: "#14532d", name: "Forest" },
  { hex: "#1e3a5f", name: "Navy" },
  { hex: "#4c1d95", name: "Plum" },
  { hex: "#831843", name: "Berry" },
  { hex: "#78350f", name: "Bronze" },
  { hex: "#0f766e", name: "Teal" },
];

export default function StorefrontCard({
  seller,
  onSaved,
}: {
  seller: Seller;
  onSaved: () => Promise<void> | void;
}) {
  const [colour, setColour] = useState(seller.store_color || "#1c1a18");
  const [slug, setSlug] = useState(seller.store_slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* The address as the seller will say it out loud. Built from the browser's
     own origin rather than an env var, so it is right on whatever domain the
     Seller Centre is actually being used on. */
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // Reading a browser global after mount is what an effect is for, and it
    // cannot be done during render: the server has no `window`, and seeding
    // the state lazily would make the first client render disagree with the
    // HTML it is hydrating. Waived the way lib/cart.tsx and DeliveryPromise
    // already waive it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/${seller.store_slug}`;
  const spoken = link.replace(/^https?:\/\//, "");

  /* Drawn from the SAVED slug, never from what is being typed. A QR code of a
     link that does not exist yet is the one thing on this card that could send
     a customer to a 404 — and a seller mid-edit would be photographing it. */
  useEffect(() => {
    if (!canvasRef.current || !origin) return;

    void QRCode.toCanvas(canvasRef.current, link, {
      width: 320,
      margin: 2,
      // Black on white, whatever the store colour is. A tinted QR is a QR that
      // some phone in a dim shop cannot read, and this one gets printed.
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }, [link, origin]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${seller.store_slug}-qr.png`;
    anchor.click();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused outside a secure context and in some in-app browsers. The link
      // is on screen and selectable either way.
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await sellerApi.updateSettings({ store_color: colour, store_slug: slug });
      await onSaved();
      setNotice("Your storefront has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  const { ink, veil } = inkFor(colour);
  const dirty = colour !== (seller.store_color || "#1c1a18") || slug !== seller.store_slug;

  return (
    <section className="rounded border border-bfl-line bg-white p-5">
      <h2 className="text-[16px] font-extrabold text-black">Your storefront</h2>
      <p className="mt-1 text-[14px] text-bfl-grey">
        How your shop looks to customers, and the link you give them.
      </p>

      {/* ---- The header, exactly as a shopper sees it ----
           A swatch grid with no preview asks a seller to imagine the result.
           This is the real thing at a smaller size, ink and all. */}
      <div
        className="mt-4 overflow-hidden rounded-lg px-4 py-4"
        style={{ backgroundColor: colour, color: ink }}
      >
        <div className="flex items-center gap-3">
          {/* The uploaded picture, not a stand-in for it. A preview captioned
              "how your shop looks to customers" that ignores the picture the
              seller just uploaded is telling them the upload did not take. */}
          {seller.logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={seller.logo}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full border border-white/60 bg-white object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[18px] font-bold text-shop-primary">
              {seller.store_name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-extrabold leading-tight">
              {seller.store_name}
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: veil(0.7) }}>
              Sold and delivered through Kandi
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <span className="mb-2 block text-[13px] font-semibold text-black">Header colour</span>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => setColour(swatch.hex)}
              aria-label={swatch.name}
              aria-pressed={colour === swatch.hex}
              title={swatch.name}
              style={{ backgroundColor: swatch.hex }}
              className={`h-9 w-9 rounded-full transition-transform ${
                colour === swatch.hex
                  ? "scale-110 ring-2 ring-black ring-offset-2"
                  : "ring-1 ring-black/10 hover:scale-105"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ---- The link ---- */}
      <div className="mt-5">
        <label htmlFor="store-slug" className="mb-1.5 block text-[13px] font-semibold text-black">
          Your store link
        </label>
        <div className="flex items-center overflow-hidden rounded border border-bfl-line focus-within:border-black">
          <span className="shrink-0 border-r border-bfl-line bg-bfl-surface px-2.5 py-2.5 text-[13px] text-bfl-grey">
            {origin.replace(/^https?:\/\//, "") || "kandiug.com"}/
          </span>
          <input
            id="store-slug"
            value={slug}
            onChange={(event) =>
              /* Lower case, and only the characters a URL can carry without
                 encoding. A seller typing "Sports Kicks" gets "sports-kicks"
                 as they type rather than an error when they save. */
              setSlug(
                event.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]+/g, "-")
                  .replace(/^-+/, "")
              )
            }
            className="w-full px-2.5 py-2.5 text-[15px] text-black focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-[13px] text-bfl-grey">
          Short, easy to say, and yours. Changing it stops the old link working, so anything you
          have already printed will need reprinting.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-shop-sale bg-[#fdeeeb] px-3 py-2 text-[14px] text-shop-sale"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 border-l-2 border-[#0a7a2f] bg-[#e7f7ea] px-3 py-2 text-[14px] text-[#0a7a2f]">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="btn-bfl mt-4 px-6 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save storefront"}
      </button>

      {/* ---- Share ---- */}
      <div className="mt-6 border-t border-bfl-line pt-5">
        <h3 className="text-[14px] font-bold text-black">Share your shop</h3>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0">
            {/* Fixed display size, drawn at 320px. A QR photographed off a
                screen or printed on a flyer wants the extra resolution; the
                page does not need to show it at that size. */}
            <canvas
              ref={canvasRef}
              aria-label={`QR code linking to ${spoken}`}
              className="h-[132px] w-[132px] rounded border border-bfl-line bg-white"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="break-all text-[14px] font-semibold text-black">{spoken}</p>
            <p className="mt-1 text-[13px] text-bfl-grey">
              Print the code on a flyer or your shopfront. A customer points a camera at it and
              lands on your products.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copy}
                className="rounded border border-bfl-line px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={download}
                className="rounded border border-bfl-line px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
              >
                Download QR
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Shop ${seller.store_name} on Kandi: ${link}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-bfl-line px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
              >
                Share on WhatsApp
              </a>
            </div>

            {dirty && slug !== seller.store_slug && (
              <p className="mt-3 text-[13px] font-medium text-[#8a6100]">
                The code and the link above are still your current address. Save to change them.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
