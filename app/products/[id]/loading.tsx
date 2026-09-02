import ProductPageSkeleton from "@/components/ProductPageSkeleton";

/**
 * Shown while a product page is being built on the server.
 *
 * `/products/[id]` prerenders the busiest 48 products and renders the rest on
 * demand, so a shopper who reaches anything outside that set — which is most of
 * the catalogue — was waiting on a WordPress round trip with the previous page
 * still frozen on screen and nothing to say a tap had registered.
 */
export default function Loading() {
  return <ProductPageSkeleton />;
}
