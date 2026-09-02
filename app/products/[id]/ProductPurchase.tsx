"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import { DEFAULT_SETTINGS } from "@/lib/site-settings";
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
import BackInStockForm from "@/components/BackInStockForm";
import Link from "next/link";

type Modal = "delivery" | "sizing" | "rrp" | null;

/** The green check in front of each guarantee line. */
function Tick() {
  return (
    <svg
      aria-hidden
      className="mt-[3px] h-3 w-3 shrink-0 text-shop-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

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
   * The returns window, from wp-admin, for the same reason as the threshold
   * above: this page states it in the terms bar, in the guarantees panel and in
   * the delivery dialog, and all three used to have "14" typed into them. Three
   * literals is three chances to disagree with the returns policy the shop
   * actually operates — and with the `merchantReturnDays` in the product's own
   * structured data, which has always come from the setting.
   */
  returnsDays = DEFAULT_SETTINGS.commerce.returns_days,
  /**
   * The ratings split, counted on the server from the same reviews the section
   * at the foot of the page lists — so the summary beside the price and the one
   * below can never report different numbers for the same product.
   */
  ratingAverage = 0,
  ratingCount = 0,
  ratingBreakdown = [],
  /**
   * The description and spec tabs, rendered in the left column under the
   * gallery.
   *
   * Passed as children from the server page rather than built here: the tabs
   * are made of the product's imported HTML, the settings-driven shipping copy
   * and a sanitiser that all belong on the server. A slot keeps them there —
   * this component only decides WHERE the block sits, not what is in it.
   */
  children,
}: {
  product: Product;
  isNew: boolean;
  freeDeliveryFrom?: number;
  returnsDays?: number;
  ratingAverage?: number;
  ratingCount?: number;
  ratingBreakdown?: number[];
  children?: React.ReactNode;
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
      {/* ---- The row, as a two-column grid rather than a flex row ----

           Flex could only ever put two things side by side, so the description
           and the spec tabs had to live in a full-width section BELOW the row —
           and on a wide screen that left a column of white the height of the
           buy box, directly under the photograph, with the copy that sells the
           product pushed under it. The screenshot that prompted this shows it:
           the left half of the page is empty from the gallery to the fold.

           A grid can put a third block in the left column instead. `children`
           is that block — the tabs — placed in row 2 of column 1, with the buy
           box spanning both rows on the right. There is one copy of the markup,
           not a `lg:hidden` duplicate: two copies of a description is two
           copies in the DOM for a crawler to read and two `ExpandableContent`
           states to disagree with each other.

           On a phone the grid collapses back to the flex column and DOM order
           decides: gallery, buy box, then description. The buy box must not end
           up below the copy on the screen where it is hardest to reach.

           ---- Why the row is capped well inside the shell ----

           The shell is 1720px, and this row does not want it. Nothing in the
           buy box gets better as it widens: the price, the delivery promise and
           the two buttons are all short, so the extra width goes into the
           product NAME, which is the one string on the page long enough to take
           it — and a title running 700px across the top of a 480px photograph
           reads as a page whose columns have come apart. 1200 is the same cap
           the cart and the Seller Centre sit on, and it puts the buy box at
           roughly 640: wide enough for the delivery line to stay on one row,
           narrow enough that the title wraps like a title. */}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 rounded-lg bg-white p-0 lg:grid lg:grid-cols-[44%_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6">
        {/* ---- Gallery ----
             44% of the row, capped at 560px including the thumbnail rail — so
             the frame itself lands near 480 square.

             It was 52% and 720px, and this is the second time the cap has moved.
             The first move made it BIGGER, to fix a photograph squeezed into a
             narrow row; that was right at the time and is wrong now, because the
             column no longer ends at the bottom of the picture. The description
             sits under it, so the gallery is competing for the same space as the
             copy that sells the thing rather than with white.

             480 square is still the largest object on the page and still bigger
             than the thumbnails a shopper arrived from. Past roughly that size a
             product photograph stops answering new questions — the shopper who
             wants a closer look taps it and gets the 900px lightbox, which is
             where the detail actually lives. */}
        <div className="w-full lg:col-start-1 lg:row-start-1">
          <div className="mx-auto w-full max-w-[560px] lg:mx-0">
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

        {/* ---- Buy box, pinned ----
             Spans both grid rows on the right and sticks to the top of the
             viewport, so the price, the size picker and the two buttons stay on
             screen while the shopper reads the description beside them. That is
             the whole point of moving the copy into the left column: a shopper
             who has just been convinced by a spec line should not have to scroll
             back up to act on it.

             `top-[112px]` clears the desktop masthead. The masthead slides away
             on scroll DOWN and returns on scroll UP (see `Header`), so the offset
             only matters in the one direction where it would otherwise sit on
             top of the price.

             `self-start` is what makes sticky work at all here: a stretched grid
             item is exactly as tall as its area and has nowhere to travel. It is
             set explicitly rather than left to the row's `items-start`, so the
             pinning does not quietly stop working the day someone changes the
             row's alignment.

             Below `lg` none of this applies — the column is a block in a flex
             stack, and `StickyBuyBar` already pins the actions to the foot of a
             phone screen. */}
        <div className="w-full lg:sticky lg:top-[112px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {/* ---- Title ----
               The fulfilment badge runs inline with the name rather than above
               it, so it costs no line of its own, and the name itself is set at
               the interface weight rather than the display one.

               That is a reversal. The title used to be `heading-800` at 24px —
               the heaviest thing on the page — on the reasoning that it is what
               a shopper reads first. It is not: they arrived from a photograph
               of the product and already know what it is. What they came to the
               page to find is the price, the rating and the delivery date, and a
               heavy 24px name pushed all three further down and outweighed them
               when they got there. A marketplace title is a label on the thing
               in the picture, so it is set like one — 15px, regular, two lines
               of it, and the price beneath it is now unambiguously the loudest
               element in the column. */}
          <h1 className="font-normal-heading text-[15px] leading-[22px] text-shop-ink md:text-[16px] md:leading-[24px]">
            <span className="mr-1.5 inline-flex items-center gap-1 align-[1px] text-[13px] font-semibold text-shop-success">
              <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z" />
              </svg>
              Ships from Uganda
            </span>
            {product.name}
          </h1>

          {/* ---- The credentials line ----
               Units sold and who is selling on the left, the star rating pushed
               to the right edge. One row instead of the two this used to take,
               and the split is what makes it readable at a glance: the eye picks
               up "2.2K sold" and the rating without reading a sentence.

               Every figure is from WooCommerce and each half disappears when
               there is nothing behind it. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-shop-muted">
              {product.total_sales > 0 && (
                <span className="font-semibold text-shop-body">
                  {product.total_sales} sold
                </span>
              )}
              {product.total_sales > 0 && (product.seller || brand) && <span>|</span>}
              {product.seller ? (
                <span>
                  Sold by{" "}
                  <span className="font-medium text-shop-body">
                    {product.seller.store_name}
                  </span>
                </span>
              ) : (
                brand && (
                  <Link href={`/category/${brand.slug}`} className="hover:text-shop-ink">
                    {brand.name}
                  </Link>
                )
              )}
            </div>

            {product.rating_count > 0 && (
              <a href="#reviews" className="flex shrink-0 items-center gap-1.5">
                <span className="text-[14px] font-semibold text-shop-ink">
                  {product.average_rating.toFixed(1)}
                </span>
                <StarRating rating={product.average_rating} size="md" showCount={false} />
              </a>
            )}
          </div>

          {/* ---- Earned, not decorated ----
               A green rank pill, and the condition on it is the point: it needs
               a genuinely high average over a meaningful number of reviews. The
               obvious version of this badge is one every product wears, which is
               worth nothing to the products that deserve it and misleads on the
               ones that do not. No position number is printed either — this shop
               does not rank its catalogue, and inventing "#10" would be a claim
               with nothing behind it. */}
          {brand && product.rating_count >= 10 && product.average_rating >= 4.5 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-[4px] bg-shop-successbg px-2 py-1 text-[12.5px] font-semibold text-shop-success">
              Top rated
              <span className="font-normal text-shop-body">in {brand.name}</span>
            </p>
          )}

          {/* ---- Price ----
               Set at 30px, up from 22, and the single largest thing in the
               column now that the title has stepped back. This is the number the
               page is built around and every other decision above is in service
               of reading it quickly. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className={`price text-[30px] leading-none ${
                soldOut
                  ? "text-shop-muted line-through"
                  : discount > 0
                    ? "text-shop-primary-ink"
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
                <span className="rounded-full bg-shop-primary-ink px-2.5 py-1 text-[12px] font-semibold text-white">
                  Save {discount}%
                </span>
              </>
            )}

            {/* Scarcity, in the price row where the decision is made rather than
                as a line further down. Outlined rather than filled: it is a
                qualifier on the price, not a third badge competing with the
                discount beside it. Only ever rendered off a real stock figure —
                an "almost sold out" on an item with 400 in the warehouse is the
                fastest way to teach shoppers to ignore every urgency signal the
                shop prints. */}
            {!soldOut && !onBackorder && product.stock_quantity !== null && product.stock_quantity <= 10 && (
              <span className="rounded-[4px] border border-shop-primary px-2 py-[3px] text-[12px] font-bold uppercase tracking-[0.03em] text-shop-primary-ink">
                Almost sold out
              </span>
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

          {/* ---- The terms bar ----
               Delivery and returns as one quiet grey strip directly under the
               price, which is where both questions are actually asked: a shopper
               who has just read the number wants to know what it will really
               cost them and what happens if it is wrong.

               They were previously two separate coloured panels — a green or
               orange free-delivery banner and a delivery promise block — sitting
               between the price and the button. Two saturated panels in the
               middle of the buy path is two things to read before the action,
               and the colour made them look like promotions rather than terms.
               Grey, one line each, and the figures still come from wp-admin. */}
          {!soldOut && (
            <div className="mt-3 rounded-lg bg-shop-surface px-3 py-2.5 text-[13px] leading-snug text-shop-body">
              <p className="flex items-start gap-2">
                <svg aria-hidden className="mt-px h-4 w-4 shrink-0 text-shop-success" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z" />
                </svg>
                {freeDeliveryFrom > 0 && product.price >= freeDeliveryFrom ? (
                  <span>
                    <strong className="font-semibold text-shop-ink">
                      This item ships free.
                    </strong>{" "}
                    Delivery across Uganda in 1–3 business days.
                  </span>
                ) : freeDeliveryFrom > 0 ? (
                  <span>
                    Free delivery on orders over{" "}
                    <strong className="font-semibold text-shop-ink">
                      {formatPrice(freeDeliveryFrom)}
                    </strong>{" "}
                    — add {formatPrice(freeDeliveryFrom - product.price)} more.
                  </span>
                ) : (
                  <span>Delivery across Uganda in 1–3 business days.</span>
                )}
              </p>
              <p className="mt-1.5 flex items-start gap-2">
                <svg aria-hidden className="mt-px h-4 w-4 shrink-0 text-shop-success" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                {/* Not "Pay on delivery" any more. Cash on delivery is limited
                    to a few neighbourhoods (see `lib/cod-zones.ts`), and a
                    promise made on the product page that the checkout then
                    withdraws is the most expensive kind of copy a shop can
                    run — the shopper has already chosen by then. */}
                <span>Secure payment · {returnsDays}-day returns</span>
              </p>
            </div>
          )}

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

              {/* ---- Keeping the shopper who wanted THIS one ----
                   The link above serves the shopper who will take a substitute.
                   This serves the one who will not, and who is the more
                   valuable of the two: they came for a specific thing and
                   found it gone, and every other route out of this page loses
                   them for good. Ten seconds of typing turns a dead end into a
                   sale the week the box is refilled. */}
              <BackInStockForm productId={product.id} productName={product.name} />
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
              Pay with
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <MtnMark />
              <AirtelMark />
              <VisaMark />
              <MastercardMark />
            </span>
          </div>

          {/* ---- Who ships it, and when ----
               The free-delivery banner that used to sit here has gone: it now
               says the same thing in the terms bar above the button, where it is
               read before the decision rather than after it. Two copies of one
               promise on one screen is how a page stops being believed.

               What replaces it is the part the page never answered — the
               despatch detail a shopper checks once they have decided. */}
          {!soldOut && (
            <div className="mt-3.5 border-t border-shop-hairline pt-3.5">
              <p className="flex items-center gap-2 text-[14.5px] font-semibold text-shop-success">
                <svg aria-hidden className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z" />
                </svg>
                {product.seller
                  ? `Ships from ${product.seller.store_name}`
                  : "Ships from our Kampala warehouse"}
              </p>
              <DeliveryPromise className="mt-2" />
            </div>
          )}

          {/* ---- The guarantees ----
               Two columns of what the shop stands behind, in a quiet panel below
               the action. It is deliberately *below*: these answer the doubt of a
               shopper who has not committed yet, and putting them above the
               button makes a page that argues before it offers.

               Every line here is a term the shop already operates — the returns
               window, pay-on-delivery, the buyer protection in the policies — so
               nothing in this panel is a claim the business has not made
               elsewhere. */}
          <div className="mt-3.5 rounded-lg border border-shop-line bg-white p-3.5">
            <p className="flex items-center gap-2 text-[14.5px] font-semibold text-shop-ink">
              <svg aria-hidden className="h-[18px] w-[18px] shrink-0 text-shop-success" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
              </svg>
              Why shop with us
            </p>
            <div className="mt-2.5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <div>
                <p className="text-[13px] font-semibold text-shop-body">
                  Payment &amp; privacy
                </p>
                <ul className="mt-1 space-y-1 text-[12.5px] text-shop-body">
                  <li className="flex items-start gap-1.5">
                    <Tick /> Cash on delivery in selected areas
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Tick /> Card details never stored by the shop
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-shop-body">
                  Delivery guarantee
                </p>
                <ul className="mt-1 space-y-1 text-[12.5px] text-shop-body">
                  <li className="flex items-start gap-1.5">
                    <Tick /> Refund if the item arrives damaged
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Tick /> {returnsDays}-day returns, in original condition
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* What other buyers made of it. Below the action rather than beside
              the price: the star average is already in the credentials line at
              the top, and this is the breakdown for a shopper who wants to know
              whether the 4.6 is fifty fives and ten ones. Links straight to the
              full section at the foot of the page. */}
          <RatingSummary
            average={ratingAverage}
            count={ratingCount}
            breakdown={ratingBreakdown}
            className="mt-3.5"
          />

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

        {/* ---- The copy, under the picture ----
             Row 2 of the left column: description, spec table and the shipping
             terms, in the space that used to be blank. `min-w-0` because a
             percentage-sized grid column does not stop an imported spec table
             from widening it — without this a supplier's 900px table stretches
             the column and pushes the buy box off the right of the page. */}
        {children && (
          <div className="w-full min-w-0 lg:col-start-1 lg:row-start-2">{children}</div>
        )}
      </div>

      {/* Info dialogs */}
      <InfoModal open={modal === "delivery"} title="Delivery and returns" onClose={() => setModal(null)}>
        {/* Every figure in this dialog comes from wp-admin. It used to say
            `formatPrice(50000)` and "14 days" as literals, which meant the
            modal a shopper opens to check the terms could contradict both the
            terms bar a few centimetres above it and the structured data Google
            reads off the same page. */}
        <p className="font-semibold text-shop-ink">Delivery</p>
        <p>
          Standard delivery across Uganda takes 1–3 business days.
          {freeDeliveryFrom > 0 ? (
            <>
              {" "}
              Delivery is free on orders over {formatPrice(freeDeliveryFrom)}; below that the fee is
              calculated by distance at checkout.
            </>
          ) : (
            <> The fee is calculated by distance at checkout.</>
          )}
        </p>
        <p className="mt-4 font-semibold text-shop-ink">Payment</p>
        <p>
          Pay by MTN Mobile Money, Airtel Money or card at checkout. Cash on delivery is
          available in selected areas only — the checkout tells you before you pay.
        </p>
        <p className="mt-4 font-semibold text-shop-ink">Returns</p>
        <p>
          Items can be returned within {returnsDays} days of delivery in their original condition
          with tags attached. Underwear, swimwear and pierced jewellery cannot be returned for
          hygiene reasons.
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
