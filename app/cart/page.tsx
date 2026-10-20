"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/currency";
import CartRecommendations from "@/components/cart/CartRecommendations";
import { useCommerceTerms } from "@/lib/commerce-terms";
import { CheckoutLabel } from "@/components/BuyNowLabel";
import QuantityStepper from "@/components/QuantityStepper";

/**
 * The basket, built for a phone first.
 *
 * One column of plain white cards on the grey page: the free delivery bar, one
 * card per item, then the summary with a single big Checkout button. Every
 * item that is in the basket goes to checkout; there is no selecting, because
 * checkout has always taken the whole basket and a box that looked like it
 * left something out was a promise the order did not keep.
 *
 * WhatsApp is offered as a second way to order. Plenty of shoppers here would
 * rather message a person than fill in a form, and a sale taken by message is
 * still a sale.
 */
export default function CartPage() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();
  const { notify } = useToast();
  const { freeDeliveryFrom, whatsapp } = useCommerceTerms();

  const freeDeliveryOn = freeDeliveryFrom > 0;
  const qualifiesFree = freeDeliveryOn && subtotal >= freeDeliveryFrom;
  const away = freeDeliveryOn ? Math.max(0, freeDeliveryFrom - subtotal) : 0;
  const progress = freeDeliveryOn ? Math.min(100, (subtotal / freeDeliveryFrom) * 100) : 0;

  const whatsappHref = whatsappOrderLink(
    whatsapp,
    items.map((item) => `${item.quantity} x ${item.name} (${formatPrice(item.price * item.quantity)})`),
    formatPrice(subtotal)
  );

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white">
          <svg aria-hidden className="h-10 w-10 text-shop-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11h11.2L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          </svg>
        </div>
        <h1 className="text-[22px] font-[800] text-black">Your cart is empty</h1>
        <p className="mt-2 text-[15px] text-shop-body">Find something you like.</p>
        <Link href="/" className="btn-shop mt-6 inline-flex rounded-full px-10 py-3.5 text-[16px] font-[800]">
          Start shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="pb-32 lg:pb-16">
      <div className="mx-auto max-w-[1100px] px-3 py-4 md:px-6 md:py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-[800] text-black md:text-[26px]">Your cart ({count})</h1>
          <Link href="/" className="text-[14px] font-bold text-shop-primary">
            + Add more
          </Link>
        </div>

        {freeDeliveryOn && (
          <div className="mb-3 rounded-xl bg-white p-3.5">
            <p className="text-[15px] font-bold text-black">
              {qualifiesFree ? (
                <span className="text-[#0a8a3a]">You get free delivery!</span>
              ) : (
                <>
                  Add <span className="text-[#7a5a00]">{formatPrice(away)}</span> more for free delivery
                </>
              )}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eceef1]">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${qualifiesFree ? "bg-[#0a8a3a]" : "bg-[#ffcc00]"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
          <div className="min-w-0">
            <ul className="space-y-2.5">
              {items.map((item) => {
                const href = `/products/${item.productId}`;
                return (
                  <li key={item.key} className="relative flex gap-3 rounded-xl bg-white p-3">
                    <Link
                      href={href}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-shop-line bg-white"
                    >
                      {item.image && (
                        <Image src={item.image} alt={item.name} fill sizes="96px" className="object-contain" quality={85} />
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col pr-9">
                      <Link href={href} className="line-clamp-2 text-[15px] leading-snug text-black">
                        {item.name}
                      </Link>
                      {item.options && Object.keys(item.options).length > 0 && (
                        <p className="mt-0.5 truncate text-[13px] text-shop-muted">
                          {Object.entries(item.options)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(", ")}
                        </p>
                      )}
                      <p className="price mt-1 text-[18px] font-[800] text-black">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-[12px] text-shop-muted">{formatPrice(item.price)} each</p>
                      )}

                      <div className="mt-2">
                        <QuantityStepper
                          name={item.name}
                          quantity={item.quantity}
                          onChange={(quantity) => updateQuantity(item.key, quantity)}
                          onRemove={() => {
                            removeItem(item.key);
                            notify("Item removed");
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.key);
                        notify("Item removed");
                      }}
                      aria-label={`Remove ${item.name}`}
                      className="close-x absolute right-2 top-2"
                    >
                      <CloseIcon />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <CartRecommendations excludeIds={items.map((item) => item.productId)} />
            </div>
          </div>

          <aside className="rounded-xl bg-white p-4 lg:sticky lg:top-32">
            <h2 className="text-[20px] font-[800] text-black">Summary</h2>
            <dl className="mt-3 space-y-2 text-[15px]">
              <div className="flex justify-between gap-3">
                <dt className="text-shop-body">Items ({count})</dt>
                <dd className="font-bold text-black">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-shop-body">Delivery</dt>
                <dd className={qualifiesFree ? "font-bold text-[#0a8a3a]" : "text-shop-body"}>
                  {qualifiesFree ? "Free" : "At checkout"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t border-shop-line pt-3">
              <span className="text-[18px] font-[800] text-black">Total</span>
              <span className="price text-[24px] font-[800] text-black">{formatPrice(subtotal)}</span>
            </div>

            <Link
              href="/checkout"
              className="btn-shop mt-4 flex w-full items-center justify-center rounded-full py-4 text-[18px] font-[800]"
            >
              <CheckoutLabel />
            </Link>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#25d366] py-3 text-[16px] font-[800] text-[#128c4a]"
              >
                <WhatsAppIcon />
                Order on WhatsApp
              </a>
            )}

            <ul className="mt-4 space-y-1.5 text-[14px] font-semibold text-black">
              <li className="flex items-center gap-2">
                <Tick /> Pay with MTN or Airtel Money
              </li>
              <li className="flex items-center gap-2">
                <Tick /> We call you before delivery
              </li>
              <li className="flex items-center gap-2">
                <Tick /> Easy returns
              </li>
            </ul>
          </aside>
        </div>

        <div className="lg:hidden">
          <CartRecommendations excludeIds={items.map((item) => item.productId)} />
        </div>
      </div>

      {/* The phone's checkout bar: the total and one button, always in reach.
          The bottom nav steps aside on /cart, so this owns the bottom edge. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-shop-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-none text-shop-body">Total ({count})</p>
            <p className="price mt-1 truncate text-[20px] font-[800] leading-none text-black">
              {formatPrice(subtotal)}
            </p>
          </div>
          <Link
            href="/checkout"
            className="btn-shop flex shrink-0 items-center justify-center rounded-full px-6 py-3.5 text-[17px] font-[800]"
          >
            <span>Checkout</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * A wa.me link with the basket written out, or null when the shop has no
 * WhatsApp number. A local 07… or 03… number is turned into 256…, which is
 * the only form wa.me accepts.
 */
function whatsappOrderLink(number: string | undefined, lines: string[], total: string): string | null {
  let digits = (number ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `256${digits.slice(1)}`;
  const text = `Hello, I want to order:\n${lines.join("\n")}\nTotal: ${total}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function CloseIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function Tick() {
  return (
    <svg aria-hidden className="h-4 w-4 shrink-0 text-[#0a8a3a]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="#25d366" viewBox="0 0 24 24">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z" />
    </svg>
  );
}
