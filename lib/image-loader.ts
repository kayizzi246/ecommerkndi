/**
 * Where every product photograph is resized.
 *
 * ---- Why not `/_next/image` ----
 *
 * Vercel's optimiser is metered, and once the plan's monthly allowance of
 * transformations is spent it stops serving: every photo not already in its
 * cache is answered `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`, which a
 * browser draws as a broken-image question mark. On a catalogue that gains new
 * photographs every day that is not an edge case, it is the product page
 * going blank for every new listing until the month rolls over.
 *
 * wsrv.nl is a free, open-source resizing proxy behind Cloudflare. It does
 * the same job — fetch the WordPress original once, resize to the width the
 * page asked for, re-encode to WebP, cache it on a CDN — without a quota that
 * can switch the shop's photographs off.
 *
 * `we` ("without enlargement") stops a small upload being blown up to a 1440px
 * file that is bigger and no sharper. Anything that is not an absolute http(s)
 * URL — a file in `public/`, a data or blob URI — is returned untouched.
 */
export function resizedImage(src: string, width: number, quality = 75): string {
  if (!/^https?:\/\//i.test(src)) return src;

  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=${width}&q=${quality}&output=webp&we`;
}

/** The `next/image` loader, wired up in next.config.ts. */
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return resizedImage(src, width, quality);
}
