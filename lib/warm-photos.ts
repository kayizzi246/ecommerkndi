import { getImageProps } from "next/image";
import { GRID_SIZES } from "@/lib/product-grid";

/**
 * Downloads product photos before their tiles are on the page, so a row the
 * shopper scrolls to shows its pictures at once rather than grey boxes.
 *
 * The request is built from the same `srcset` and `sizes` the tile will use,
 * so the browser picks the same file and the tile is served from its cache;
 * nothing is downloaded twice. Skipped when the shopper has asked their
 * browser to save data, or is on a 2G connection.
 */

/** Photos already asked for, so a page is never warmed twice. */
const warmed = new Set<string>();
/** Held until loaded: an image nothing refers to may be dropped mid-download. */
const loading = new Set<HTMLImageElement>();

type Connection = { saveData?: boolean; effectiveType?: string };

export function warmPhotos(products: { image: string }[], sizes: string = GRID_SIZES): void {
  if (typeof window === "undefined") return;
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) return;

  for (const product of products) {
    if (!product.image || warmed.has(product.image)) continue;
    warmed.add(product.image);

    // The same props `ProductCard` gives its photo.
    const { props } = getImageProps({ src: product.image, alt: "", fill: true, sizes, quality: 90 });
    const photo = new window.Image();
    const release = () => loading.delete(photo);
    photo.onload = release;
    photo.onerror = release;
    photo.decoding = "async";
    if (props.sizes) photo.sizes = props.sizes;
    if (props.srcSet) photo.srcset = props.srcSet;
    photo.src = props.src;
    loading.add(photo);
  }
}
