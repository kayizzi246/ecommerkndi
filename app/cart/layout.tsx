import type { Metadata } from "next";

/**
 * A layout that exists only to carry metadata.
 *
 * `app/cart/page.tsx` is a client component, and a client component cannot
 * export `metadata` — so the only place to say anything about this route to a
 * crawler is a server file wrapped around it. That is all this does; it renders
 * its children untouched.
 *
 * ---- Why the cart needed telling at all ----
 *
 * `kandiug.com/cart` was in Google's index, ranking on the shop's own brand name
 * with the title "Online Shopping in Uganda - Kandi Store". On a domain with
 * only a handful of indexed pages, one of them being an empty basket is a real
 * cost: it is a result that can never satisfy the search that produced it, and
 * it displaces a product or category page that could.
 *
 * It got there despite `Disallow: /cart` in robots.txt, because that directive
 * does not do what it is usually assumed to do. It stops Google fetching the
 * page. It does not stop Google listing the URL — and a URL it may not fetch is
 * one it cannot learn anything about, including that it should be dropped.
 *
 * So the two changes go together and neither works alone: the disallow has been
 * lifted in `app/robots.ts` so the page can be read, and the `noindex` below is
 * what it now reads. `follow: true` because the cart links back into the shop
 * and there is no reason to waste those links.
 */
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
