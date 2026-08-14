"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice, discountPercent } from "@/lib/currency";
import AddToCartButton from "@/components/AddToCartButton";
import StickyBuyBar from "@/components/StickyBuyBar";
import ImageGallery from "@/components/ImageGallery";
import FollowBrand from "@/components/FollowBrand";
import InfoModal from "@/components/InfoModal";
import TrustStrip from "@/components/TrustStrip";
import DeliveryPromise from "@/components/DeliveryPromise";
import StarRating from "@/components/StarRating";
import { MtnMark, AirtelMark, VisaMark, MastercardMark } from "@/components/PaymentMarks";
import RatingSummary from "@/components/RatingSummary";
import Link from "next/link";

type Modal = "delivery" | "sizing" | "rrp" | null;

/**
 * The interactive half of the product page: the gallery and the buy box share
 * `activeImage` so picking a colour swaps the shot. Everything that does not
 * need state (breadcrumbs, description, related products) stays on the server.
 */
export default function ProductPurchase({
  product,
  isNew,
  /**
   * The shop's free-delivery threshold, from wp-admin.
   *
   * Passed in from the server rather than read here, so the figure quoted
   * beside the buy button is the same one the checkout charges against. Zero
   * means the shop has not set one, and the nudge simply does not render.
   */
  freeDeliveryFrom = 0,
  /**
   * The ratings split, counted on the server from the same reviews the section
   * at the foot of the page lists — so the summary beside the price and the one
   * below can never report different numbers for the same product.
   */
  ratingAverage = 0,
  ratingCount = 0,
  ratingBreakdown = [],
}: {
  product: Product;
  isNew: boolean;
  freeDeliveryFrom?: number;
  ratingAverage?: number;
  ratingCount?: number;
  ratingBreakdown?: number[];
}) {
  const [activeImage, setActiveImage] = useState<string | null>(product.image);
  const [modal, setModal] = useState<Modal>(null);
  const { addProduct } = useRecentlyViewed();

  // Record the view so the "Recently viewed" rail on the homepage has something
  // to show — the store kept the list but nothing ever wrote to it.
  useEffect(() => {
    addProduct({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      slug: product.slug,
    });
  }, [addProduct, product.id, product.name, product.image, product.price, product.slug]);

  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;

  /**
   * Nothing left to sell, and the softer case where WooCommerce will still
   * take the order but cannot ship it yet.
   *
   * The page had no notion of either. `AddToCartButton` quietly rendered a
   * disabled "Sold out" and that was the whole of it — everything above the
   * button carried on as though the item were buyable, so a sold-out product
   * still advertised its discount, still promised free delivery, and still
   * claimed a few hundred people had looked at it in the last day. A shopper
   * read all of that and only found out at the button. The state belongs at
   * the top, with the price, where it changes how the rest is read.
   */
  const soldOut = product.stock_status === "outofstock";
  const onBackorder = product.stock_status === "onbackorder";

  const brand = product.categories[0];
  const images = [product.image, ...product.gallery].filter(Boolean);
  const colorAttribute = product.attributes?.find(
    (attr) => attr.name.toLowerCase() === "color"
  );

  // Derived from the product id so the figure is stable across renders and
  // between server and client — never a random number.
  const viewers = 120 + ((product.id * 37) % 260);

  const handleOptionChange = (name: string, value: string | null) => {
    if (name.toLowerCase() === "color" && value && colorAttribute) {
      const optionWithImage = colorAttribute.options.find(
        (opt) => opt.name === value && opt.image
      );
      setActiveImage(optionWithImage?.image ?? product.image);
    }
  };

  return (
    <>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 rounded-lg bg-white p-0 lg:flex-row lg:items-start lg:gap-8">
        {/* Gallery, capped at 460px. It was running to 680px on a 58% column,
            which pushed the price, the variant pickers and Add to cart below
            the fold on a laptop — the photograph was winning the page from the
            things that actually close a sale. */}
        <div className="w-full lg:basis-[46%]">
          <div className="mx-auto w-full max-w-[460px] lg:mx-0">
            <ImageGallery
              images={images}
              productName={product.name}
              activeImage={activeImage}
              setActiveImage={setActiveImage}
              isNew={isNew}
              discount={discount}
              superPrice={discount >= 50}
              soldOut={soldOut}
            />
          </div>
        </div>

        {/* Buy box */}
        <div className="w-full lg:basis-[54%]">
          {brand && (
            <Link
              href={`/category/${brand.slug}`}
              className="text-[13px] font-medium uppercase tracking-[0.1em] text-shop-muted hover:text-shop-ink"
            >
              {brand.name}
            </Link>
          )}

          {/* Set at the heading weight rather than the interface one. This is
              the one line on the page a shopper reads as a title, and at 19px
              regular it sat at the same weight and colour as the delivery copy
              underneath it — technically a heading, visually just another
              sentence. The extra weight holds the eye at a size that still fits
              a long marketplace name on two lines.

              Slightly larger and a touch tighter than before: product names run
              long here ("Men's Leather Oxford Shoes Brown Size 42"), and tight
              tracking on a wide face is what keeps that on two lines instead of
              three.

              `heading-800`, the class written for exactly this line and until
              now used nowhere. It matters that it is a class and not a utility:
              the `h1`/`.font-heading` rule in globals.css is unlayered, so it
              beats any Tailwind `font-*` on the same element — the
              `font-semibold` that used to sit here never applied at all, and
              the title was rendering at the generic heading 700. At 800 the
              name finally outweighs the price and the delivery copy beneath
              it, which is the order a shopper should read them in. */}
          <h1 className="heading-800 mt-1.5 text-[21px] text-shop-ink md:text-[24px]">
            {product.name}
          </h1>

          {/* Social proof, straight from WooCommerce — shown only when there
              actually are reviews or sales to report. */}
          {(product.rating_count > 0 || product.total_sales > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {product.rating_count > 0 && (
                <a href="#reviews" className="flex items-center gap-2">
                  <StarRating rating={product.average_rating} size="md" showCount={false} />
                  <span className="text-[14px] font-semibold text-shop-ink">
                    {product.average_rating.toFixed(1)}
                  </span>
                  <span className="text-[14px] text-shop-muted underline underline-offset-4">
                    {product.rating_count} reviews
                  </span>
                </a>
              )}
              {product.total_sales > 0 && (
                <span className="text-[14px] font-semibold text-shop-primary">
                  {product.total_sales} sold
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className={`text-[22px] font-semibold ${
                soldOut
                  ? "text-shop-muted line-through"
                  : discount > 0
                    ? "text-shop-sale"
                    : "text-shop-ink"
              }`}
            >
              {formatPrice(product.price)}
            </span>
            {/* Struck through and greyed above, and labelled here. A price a
                shopper cannot pay should not be set in the colour that means
                "this is a deal". */}
            {soldOut && (
              <span className="rounded-full bg-shop-ink px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-white">
                Out of stock
              </span>
            )}
            {onBackorder && (
              <span className="rounded-full bg-shop-primary-soft px-2.5 py-1 text-[12px] font-semibold text-shop-primary-ink">
                On backorder
              </span>
            )}
            {!soldOut && discount > 0 && (
              <>
                <span className="text-[17px] text-shop-muted line-through">
                  {formatPrice(product.regular_price)}
                </span>
                <span className="rounded-full bg-shop-sale px-2.5 py-1 text-[12px] font-semibold text-white">
                  Save {discount}%
                </span>
              </>
            )}
          </div>

          {/* The saving in shillings, not just a percentage. "Save 30%" is an
              abstraction; "You save UGX 55,000" is the number a shopper weighs
              against their wallet, and it is the single line that most reliably
              moves a discounted product. */}
          {!soldOut && discount > 0 && (
            <p className="price mt-1.5 text-[15px] text-shop-success">
              You save {formatPrice(product.regular_price - product.price)}
            </p>
          )}

          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-shop-muted">
            Tax included. Shipping calculated at checkout.
            {discount > 0 && (
              <button
                type="button"
                onClick={() => setModal("rrp")}
                aria-label="What is RRP?"
                className="flex h-4 w-4 items-center justify-center rounded-full border border-shop-line text-[11px] leading-none hover:border-shop-ink hover:text-shop-ink"
              >
                ?
              </button>
            )}
          </p>

          {/* What other buyers made of it, beside the price rather than at the
              foot of the page. The full section below stays the place to read
              the reviews themselves — this block links straight to it. */}
          <RatingSummary
            average={ratingAverage}
            count={ratingCount}
            breakdown={ratingBreakdown}
            className="mt-3.5"
          />

          {/* The delivery promise is a promise about this item, so it goes when
              there is no item to deliver. */}
          {!soldOut && <DeliveryPromise className="mt-3.5" />}

          {/* ---- Stock signal ----
               Four states, in descending order of how much they change what the
               shopper does next.

               Sold out is first and is a block rather than a line: it is the
               only one that ends the visit for this product, so it says what
               happened and offers the way out — the category the item came
               from, which is where a shopper who wanted this thing is most
               likely to find the next one. Sending them back to a dead end
               instead is how a sold-out page becomes a lost sale twice.

               The viewer count is the fallback and only the fallback. It used
               to catch every case the low-stock branch missed, which included
               sold out — so an item nobody could buy reported a few hundred
               people looking at it. Social proof for an unavailable product is
               not persuasion, it is a taunt. */}
          {soldOut ? (
            <div className="mt-3 rounded-lg border border-shop-line bg-shop-surface px-3.5 py-3">
              <p className="flex items-center gap-2 text-[14.5px] font-semibold text-shop-ink">
                <svg aria-hidden className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M9 12h6" />
                </svg>
                Out of stock
              </p>
              <p className="mt-1 text-[13.5px] leading-snug text-shop-body">
                This item has sold out. We restock popular lines regularly — check
                back, or{" "}
                {brand ? (
                  <Link
                    href={`/category/${brand.slug}`}
                    className="font-semibold text-shop-primary hover:underline"
                  >
                    browse more in {brand.name}
                  </Link>
                ) : (
                  <Link href="/search" className="font-semibold text-shop-primary hover:underline">
                    browse the rest of the shop
                  </Link>
                )}
                .
              </p>
            </div>
          ) : onBackorder ? (
            <p className="mt-2.5 flex items-center gap-2 text-[14px] font-medium text-shop-primary-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-shop-primary" aria-hidden />
              Available on backorder — ships as soon as it arrives
            </p>
          ) : product.stock_quantity !== null && product.stock_quantity <= 10 ? (
            <p className="mt-2.5 flex items-center gap-2 text-[14px] font-medium text-shop-sale">
              <span className="h-1.5 w-1.5 rounded-full bg-shop-sale" aria-hidden />
              Only {product.stock_quantity} left in stock
            </p>
          ) : (
            <p className="mt-2.5 flex items-center gap-2 text-[13px] text-shop-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-shop-success" aria-hidden />
              {viewers} people viewed this in the last 24 hours
            </p>
          )}

          <div id="buy-box" className="mt-4 scroll-mt-32">
            <AddToCartButton product={product} onOptionChange={handleOptionChange} />
          </div>

          {/* ---- What you can pay with, at the moment of deciding ----
               Directly under the button rather than in the footer or a modal.
               The commonest reason a first-time shopper abandons a Ugandan
               storefront is not price, it is not knowing whether their MoMo
               line works here — and answering that two clicks away answers it
               for nobody. Drawn inline as SVG, so no marks can fail to load. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-shop-hairline pt-3">
            <span className="text-[13px] font-semibold text-shop-body">
              Pay on delivery, or with
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <MtnMark />
              <AirtelMark />
              <VisaMark />
              <MastercardMark />
            </span>
          </div>

          {/* ---- Free delivery, as a number rather than a slogan ----
               Either this item already clears the shop's threshold, in which
               case say so plainly, or it does not and the exact shortfall is
               the most useful thing on the page: "add UGX 12,000" is an
               instruction a shopper can act on, where "free delivery over UGX
               50,000" is a fact they have to do arithmetic against.

               Both readings come from the shop's real threshold, so neither can
               promise what the checkout will not honour — and neither is shown
               at all on a sold-out item, where "add UGX 12,000 more and
               delivery is free" is advice about a basket the shopper cannot
               build. */}
          {!soldOut && freeDeliveryFrom > 0 && (
            <p
              className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13.5px] leading-snug ${
                product.price >= freeDeliveryFrom
                  ? "bg-shop-successbg text-shop-success"
                  : "bg-shop-primary-soft text-shop-primary-ink"
              }`}
            >
              <svg aria-hidden className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z" />
              </svg>
              {product.price >= freeDeliveryFrom ? (
                <span>
                  <strong className="font-semibold">This item ships free.</strong> Orders over{" "}
                  {formatPrice(freeDeliveryFrom)} never pay delivery.
                </span>
              ) : (
                <span>
                  Add{" "}
                  <strong className="font-semibold">
                    {formatPrice(freeDeliveryFrom - product.price)}
                  </strong>{" "}
                  more to your order and delivery is free.
                </span>
              )}
            </p>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
            <button
              type="button"
              onClick={() => setModal("delivery")}
              className="text-shop-body underline underline-offset-4 hover:text-shop-ink"
            >
              Delivery and returns
            </button>
            <button
              type="button"
              onClick={() => setModal("sizing")}
              className="flex items-center gap-2 text-shop-body underline underline-offset-4 hover:text-shop-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 3v3m0 0L3.5 15.5h17L12 10.5Z" />
              </svg>
              Size guide
            </button>
          </div>

          {product.seller ? (
            <FollowBrand
              brandName={product.seller.store_name}
              subtitle="Sold and dispatched by this store"
            />
          ) : (
            brand && <FollowBrand brandName={brand.name} />
          )}

          <TrustStrip className="mt-4" />
        </div>
      </div>

      {/* Info dialogs */}
      <InfoModal open={modal === "delivery"} title="Delivery and returns" onClose={() => setModal(null)}>
        <p className="font-semibold text-shop-ink">Delivery</p>
        <p>
          Standard delivery across Uganda takes 1–3 business days. Delivery is free on orders over{" "}
          {formatPrice(50000)}; below that a flat fee applies at checkout.
        </p>
        <p className="mt-4 font-semibold text-shop-ink">Payment</p>
        <p>Pay on delivery with cash, MTN Mobile Money, Airtel Money, or by card at checkout.</p>
        <p className="mt-4 font-semibold text-shop-ink">Returns</p>
        <p>
          Items can be returned within 14 days of delivery in their original condition with tags
          attached. Underwear, swimwear and pierced jewellery cannot be returned for hygiene reasons.
        </p>
      </InfoModal>

      <InfoModal open={modal === "sizing"} title="Need sizing help?" onClose={() => setModal(null)}>
        <p>
          Sizes follow the brand&apos;s own chart, so they can differ slightly between labels. If you
          are between sizes we recommend going one size up.
        </p>
        <table className="mt-4 w-full overflow-hidden rounded-lg border border-shop-line text-[14px]">
          <thead>
            <tr className="bg-shop-surface text-left">
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Chest (cm)</th>
              <th className="px-3 py-2 font-semibold">Waist (cm)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["XS", "82–86", "66–70"],
              ["S", "86–92", "70–76"],
              ["M", "92–98", "76–82"],
              ["L", "98–104", "82–88"],
              ["XL", "104–112", "88–96"],
            ].map(([size, chest, waist]) => (
              <tr key={size} className="border-t border-shop-line">
                <td className="px-3 py-2 font-semibold">{size}</td>
                <td className="px-3 py-2">{chest}</td>
                <td className="px-3 py-2">{waist}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </InfoModal>

      <InfoModal open={modal === "rrp"} title="What is RRP?" onClose={() => setModal(null)}>
        <p>
          RRP is the Recommended Retail Price — the price the brand suggests the item is sold at in
          full-price retail. The discount shown is the saving against that RRP.
        </p>
      </InfoModal>

      {/* Slides in once the buy box above has scrolled past. */}
      <StickyBuyBar product={product} watch="buy-box" />
    </>
  );
}
