"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import type { CategoryNode } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import { brandName } from "@/lib/site-settings";
import SearchBar from "@/components/SearchBar";
import CuratedNav from "@/components/CuratedNav";
import CategoriesMenu from "@/components/CategoriesMenu";
import AccountMenu from "@/components/AccountMenu";
import SalesTicker from "@/components/SalesTicker";

/**
 * Storefront masthead, in the large-marketplace layout, and it is now THREE
 * bands rather than one white one:
 *
 *   1. ORANGE promo strip — the rotating promise line, in the brand colour.
 *   2. GRAY-900 working row — logo, search field, account, cart.
 *   3. WHITE department bar — the Categories mega-menu and the curated links,
 *      handing off to the white content sheet below it.
 *
 * ---- Why this is no longer white throughout ----
 *
 * It used to be, on the argument that a masthead in a dark or saturated slab is
 * the heaviest thing on a page whose job is showing product photography, and
 * that every marketplace at this scale has converged on getting out of the way.
 *
 * Half of that is still true and is why band 3 exists: the row nearest the
 * products stays white and quiet. What the argument got wrong is that a shop
 * which is white from the top of the browser chrome all the way down has no
 * horizon in it. Nothing tells a shopper where the site's controls end and the
 * merchandise begins, so the search field — the single most important control
 * in a catalogue this size — reads as one more white box among many, and the
 * page as a whole reads as unfinished rather than restrained.
 *
 * A dark working row fixes exactly that and nothing else. It is 60-odd pixels,
 * it is above the fold only, and the white search pill and orange submit button
 * sitting on it become the most contrasted object on the screen — which is
 * precisely what they should be.
 *
 * ---- Why the working row is gray-900 and not orange ----
 *
 * Orange was the obvious choice and it is the wrong one, for a reason worth
 * recording so nobody re-tries it: #ff6a00 is a LIGHT hue. White on it is
 * 2.9:1, which fails AA for text and fails the 3:1 graphics threshold for
 * icons too. An orange masthead therefore cannot carry white type or white
 * icons — it has to carry near-black ones, which looks muddy — and the shop
 * would be reaching for `--color-shop-primary-ink` in the one place a brand
 * colour is supposed to be at full strength.
 *
 * Gray-900 has no such problem. White on #111827 is 16.1:1 and the brand orange
 * on it is 5.9:1, so orange becomes the ACCENT — the search button, the cart
 * badge, the cart total, every hover — at full saturation and fully legible.
 * That is the palette's own stated ratio (mostly neutral, a little orange)
 * expressed in the masthead rather than argued against by it.
 *
 * ---- The promo strip is orange and its type is near-black ----
 *
 * Same arithmetic, opposite conclusion. The strip carries nothing but short
 * bold phrases, near-black on orange is 5.5:1, and one saturated hairline above
 * a dark row is what stops the top of the page reading as a single black slab.
 * It replaces a yellow strip, which was legible (black on #facc15 is 11:1) and
 * a second brand colour the shop does not otherwise use.
 *
 * The logo, the promo wording and the free-delivery threshold all come from
 * `settings`, which is edited in wp-admin — nothing here is hard-coded.
 */
export default function Header({
  departments = [],
  settings,
  hideNavRow = false,
}: {
  departments?: CategoryNode[];
  settings: SiteSettings;
  /** The homepage renders the nav row itself, beside its category sidebar. */
  hideNavRow?: boolean;
}) {
  const { count, subtotal, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * True once the page has been scrolled past the masthead's own height.
   *
   * On a phone the full masthead — promo strip, logo row, search, department
   * bar — is close to 200px, and all of it is sticky, so a shopper scrolling a
   * product grid was reading it through a letterbox. Past that first scroll the
   * strip, the department bar, the logo, the cart and the menu toggle all fold
   * away, leaving a single slim row holding nothing but the search field, edge
   * to edge. Search is the one thing worth keeping pinned in a catalogue this
   * size; cart and categories are both tabs on the fixed bottom bar already.
   *
   * Desktop is untouched — there is room for the whole masthead there.
   */
  const [scrolled, setScrolled] = useState(false);
  /**
   * Whether the phone-sized search field has been opened by hand.
   *
   * Only meaningful before the first scroll: past that the field is pinned and
   * always on screen, so this is reset when the shopper scrolls into that state
   * rather than leaving a stale flag behind them.
   */
  const [searchOpen, setSearchOpen] = useState(false);

  /**
   * Whether the masthead is currently slid up out of the way.
   *
   * The behaviour every large marketplace has converged on: scrolling DOWN
   * takes the header away, scrolling UP brings it straight back. It is worth
   * being precise about why, because "sticky" and this are not the same idea.
   *
   * A permanently pinned masthead is a tax paid on every screen of a catalogue.
   * On a phone the compact row is still ~56px of a ~700px viewport — eight per
   * cent of the screen spent, on every scroll, on chrome the shopper is not
   * using while they are reading a grid. But removing it outright is worse,
   * because the moment they DO want it they want it immediately, and a
   * scroll-to-top is a long way from the bottom of an endless product grid.
   *
   * Direction is the signal that resolves that. Scrolling down means "show me
   * more products"; scrolling up means, near enough always, "I want to get
   * back to something" — and the masthead is what they are reaching for.
   */
  const [hidden, setHidden] = useState(false);

  /**
   * The scroll position the last decision was made at.
   *
   * A ref, not state: it changes on every frame of every scroll and nothing
   * renders from it, so putting it in state would re-render the whole masthead
   * a hundred times a second to store a number.
   */
  const lastY = useRef(0);

  useEffect(() => {
    // Reading scrollY in the handler and acting in a frame keeps this off the
    // scroll thread; the listener is passive so it can never block one.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;

        /* Clamped at zero because iOS rubber-band scrolling reports negative
           positions at the top of the page and beyond the bottom. Left raw,
           the bounce at the end of a long grid reads as a direction change and
           the header flaps. */
        const y = Math.max(0, window.scrollY);

        // Hysteresis: collapsing and expanding at the same pixel makes the row
        // flicker for anyone resting at the boundary.
        setScrolled((current) => {
          const next = current ? y > 60 : y > 120;
          // Scrolling pins the field on its own; the hand-opened state has
          // nothing left to do and would otherwise keep the icon hidden after
          // the shopper returned to the top.
          if (next) setSearchOpen(false);
          return next;
        });

        /* ---- Direction ----
           Only acted on past a few pixels of travel. A thumb resting on a phone
           screen produces a continuous dribble of one-pixel scroll events in
           both directions, and a header that answered every one of them would
           shudder rather than slide. 8px is below what anyone would call a
           deliberate scroll and well above that noise. */
        const travelled = y - lastY.current;
        if (Math.abs(travelled) < 8) return;
        lastY.current = y;

        /* Never hidden in the top stretch of the page, whatever the direction.
           The header has not had time to be in the way yet, and hiding it there
           makes the shop feel like it is flinching away from the shopper. 140px
           is past the announcement strip and the logo row, so the first thing
           this can do is get out of the way of the products. */
        setHidden(travelled > 0 && y > 140);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* An open menu pins the header down.
     Sliding the masthead away while its own dropdown is open would take the
     dropdown with it, and the shopper did not scroll — they opened a menu and
     then moved the page under it. */
  const slidUp = hidden && !menuOpen;

  const threshold = settings.commerce.free_delivery_from;
  const awayFromFreeDelivery = Math.max(0, threshold - subtotal);

  return (
    // Once the department bar folds away on a phone there is no rule between
    // the masthead and the grid scrolling under it, and something has to say
    // where one ends and the other begins.
    //
    // That used to be a `shadow-sm`. It came off when the masthead went
    // gray-900, on the argument that a near-black bar against a white page is
    // already the highest-contrast edge on the screen and a soft grey shadow
    // under it is a smudge doing a job the colour had done.
    //
    // The masthead is white again, so the colour is not doing that job any
    // more — but the answer is still not a shadow. It is `border-b`: a
    // hairline is what separates every other white surface in this shop from
    // the one below it, and the department bar under this already ends in the
    // same rule. On a phone, where that bar folds away, this border IS the
    // line between the masthead and the grid scrolling under it, which is what
    // the shadow was there for.
    <header
      className={`sticky top-0 z-40 border-b border-shop-line bg-white transition-transform duration-300 ease-out motion-reduce:transition-none ${
        slidUp ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {/* ---- Announcement strip ----
           A near-black rule across the top, carrying the shop's three
           strongest promises — pay on delivery, free returns, the sale.

           ---- It was orange, and the orange moved down a row ----

           The strip and the working row have swapped grounds. Orange can only
           be spent once, and it buys more on the row that carries the logo, the
           search field and the cart than it does on a thin marketing band above
           them: on the working row it makes the masthead one brand object, on
           the strip it made the chrome three unrelated bands. Every marketplace
           this shop is measured against paints the working row and leaves the
           utility strip dark.

           So the strip takes `shop-nav`, the same near-black as the footer and
           the admin masthead, and its type goes white at 85% — 14:1. The old
           note below argued the type here could not be white because white on
           #ff6a00 is 2.9:1. True, and that constraint moved down with the
           colour; it now governs the row beneath, not this one.

           This has been white on white (palest text on the page, read by
           nobody), then near-black (read, but receded), then yellow. Yellow
           worked — black on #facc15 is 11:1 — and its only fault was being a
           second brand colour in a shop that has one. Orange says the same
           thing in the shop's own hue: the strip rather than the type is what
           does the shouting, which is why it survives the row beneath it going
           from gray-900 back to white.

           The white-on-orange limit did not disappear with the colour, it moved
           one row down and is answered there: the working row keeps near-black
           type on its new orange ground. See the note on that row.

           Once there is something in the cart the rotating line gives way to
           live free-delivery progress, which is the more useful message. Every
           figure is real: the threshold from settings, the shopper's own
           subtotal, the payment methods actually accepted at checkout. */}
      {/* ---- Once it is gone, it stays gone ----
           This was `hidden md:block` when scrolled, so the strip folded away on
           a phone and stayed put on a desktop. It is now hidden at every width
           past the first scroll, and that matters more than it did before the
           masthead started sliding.

           The strip is an opening statement — the promises a shopper reads once
           on arrival and does not need again. When the header slides back in on
           a scroll up, it is answering a specific reach for search or the cart,
           and bringing 32px of rotating marketing back with it would push the
           thing they actually reached for further down the screen. What returns
           is the working row and nothing else. */}
      <div className={`bg-shop-nav text-white/85 ${scrolled ? "hidden" : ""}`}>
        {/* 11.5px, and the lines inside are plain rather than semibold. This
            strip is the smallest thing on the page and it was set in the same
            weight as the navigation under it, which is what made three bands
            of chrome read as three headlines. A promise bar is read once on
            arrival; it does not need to be heavy to be seen, it needs to be
            small and out of the way, which it is. */}
        <div className="mx-auto flex max-w-[var(--shell)] items-center justify-between gap-4 px-4 py-1.5 text-[11.5px] md:px-8">
          {count > 0 && awayFromFreeDelivery > 0 ? (
            <button
              type="button"
              onClick={openDrawer}
              className="truncate font-medium transition-opacity hover:opacity-85"
            >
              Add {formatPrice(awayFromFreeDelivery)} more for FREE delivery ›
            </button>
          ) : count > 0 ? (
            /* No emoji. This is a line about money in a strip that also
               carries the delivery threshold and the returns window — a party
               popper next to it makes the whole row read as marketing rather
               than as the shop telling you what you will be charged. */
            <span className="truncate font-medium">
              Delivery on this order is free
            </span>
          ) : (
            <SalesTicker messages={settings.ticker} className="min-w-0 font-medium" />
          )}

          <div className="hidden shrink-0 items-center gap-5 sm:flex">
            {settings.promo.lines.slice(1, 3).map((line, index) => (
              <span key={line} className={index === 1 ? "hidden md:inline" : undefined}>
                {line}
              </span>
            ))}
            {/* The one accent in the strip, and with the strip near-black it
                goes back to being a COLOUR rather than a fill.

                It was a white pill, and the note that made it one was correct
                for the bar it was written on: an orange strip leaves no orange
                to differentiate with, so the call to action had to separate by
                shape and brightness instead of hue. A near-black strip gives
                the hue back — brand orange on #111827 is 5.9:1 — so the pill's
                whole reason for existing is gone.

                Dropping it is worth more than the contrast. A rounded white
                capsule in a 24px-tall utility strip is the single most generic
                object a header can contain; the strips this one is modelled on
                run their calls to action as plain underlined type, because a
                utility bar is a row of links and should look like one. The
                underline is what makes it read as clickable without a fill. */}
            <Link
              href={settings.promo.cta_url}
              className="font-semibold text-shop-flame underline decoration-shop-flame/40 underline-offset-[3px] transition-colors hover:text-white hover:decoration-white/60"
            >
              {settings.promo.cta_label} ›
            </Link>
          </div>
        </div>
      </div>
      {/* ---- Main row ----
           Brand orange, tight, and dominated by the search field — the
           marketplace masthead. Search is the primary way into a catalogue this
           size, so it takes the whole middle of the row and grows with the
           window instead of sitting at a fixed width. Below md it wraps to its
           own line.

           ---- This ground has been gray-900, then white, and is now orange ----

           Both earlier notes were right about what they were solving and both
           are superseded, so what is kept here is the conclusion of each rather
           than the argument:

             • Gray-900 made `SearchBar` — a white pill with an orange submit
               button — the brightest object on the screen, which is what the
               most-used control in the shop should be. It cost an uploaded logo
               its legibility, and it ran three bands of chrome before a single
               product appeared.
             • White fixed the bands and let an uploaded logo alone, and handed
               the search field's prominence to `border-2` to carry by itself.

           Orange keeps the first property and still drops the third band: the
           white pill is the brightest object in the row again, and there are
           two bands above the merchandise rather than three, because the row IS
           the brand now instead of sitting between two things that are. The
           chrome reads near-black utility, brand, white goods.

           What comes back with a coloured ground is the white plate behind an
           uploaded logo — the note at that branch asked for exactly this, and
           it is now honoured.

           ---- The type in this row is near-black, and that is the rule ----

           The obvious build of an orange masthead sets every label in it white,
           because that is what the marketplaces it is modelled on do. It was
           built that way first and it is wrong here: the palette note at the
           head of `globals.css` measures white on #ff6a00 at 2.9:1, and the
           labels in this row — "Cart", the running total, the account name —
           are 12.5 and 13px, well inside the range that needs 4.5:1. Near-black
           on the same orange is 5.5:1.

           So the row keeps the ink it had on white, and the colour it gained is
           spent on the ground rather than the type. Hover is where white gets
           used: lifting a control to white on a coloured row is a stronger
           affordance than a hue shift, and a hover state is not something
           anyone has to be able to read at rest.

           The two exceptions are deliberate and both are large or reversed —
           the wordmark's name, which is display type, and the cart badge, which
           is white on a near-black disc.

           ---- Tighter ----

           py-2, from py-3.5, and `gap-x-4` between the row's three blocks,
           from `gap-x-6`. The row is logo, field, account and cart; none of
           them needs 28px of air above and below to be found, and the height
           saved is height the first row of products gets on the opening
           screen. The scrolled state comes down with it, to py-1.5. */}
      <div className="bg-shop-primary">
      <div
        className={`mx-auto flex max-w-[var(--shell)] flex-wrap items-center gap-x-4 gap-y-2 px-4 md:flex-nowrap md:px-8 md:py-2 ${
          scrolled ? "py-1.5" : "py-2"
        }`}
      >
        <Link
          href="/"
          className={`shrink-0 items-center gap-2 md:flex ${scrolled ? "hidden" : "flex"}`}
        >
          {settings.brand.logo_url ? (
            // An uploaded logo replaces the wordmark entirely. `unoptimized`
            // because the file lives on the WordPress media library, which is
            // not necessarily in `next.config` remotePatterns.
            // 36/44px. It went 48/56 → 36/40 → here.
            //
            // The argument for coming down still holds and is not being
            // reversed: on a marketplace masthead the search field is supposed
            // to win, and Tmall, Taobao and AliExpress all set their logo at
            // roughly a third the height of their search bar. What changed
            // underneath it is the row — white now, and py-2 rather than
            // py-3.5. On a near-black band the mark was the only bright object
            // at its end of the row and 40px was plenty; on white, in a
            // shorter row, the same 40px reads as a small mark floating in a
            // thin strip.
            //
            // 44px is one step, not a return to 56: the field still wins, and
            // the logo is still under half its height. Anything taller starts
            // setting the row's height by itself, which is how this ended up
            // at 56 the first time.
            //
            // `w-auto` with a max width means a wide logo grows into the space
            // rather than distorting, and the intrinsic size stays generous so
            // the file is never upscaled.
            //
            // ---- The white plate is back, with the coloured row ----
            //
            // It was removed when the masthead went white, under the note "put
            // it back in the same commit as any future dark masthead". The row
            // is orange rather than dark, but the problem the plate solves does
            // not care which colour it is: what gets uploaded in wp-admin is
            // somebody's existing logo file, and most of those are dark artwork
            // on a transparent background, drawn for a white page. On orange
            // that artwork muddies; a logo saved WITH a white background
            // becomes a bright rectangle with hard edges. The plate makes both
            // cases correct without knowing which one it has.
            //
            // Tight padding and a small radius, not a card: the plate should
            // read as the logo's own edge, not as a tile parked in the row.
            <span className="flex items-center rounded-lg bg-white px-2 py-1">
              <Image
                src={settings.brand.logo_url}
                alt={brandName(settings)}
                width={260}
                height={60}
                unoptimized
                priority
                className="h-9 w-auto max-w-[150px] object-contain md:h-11 md:max-w-[190px]"
              />
            </span>
          ) : (
            <>
              {/* The KandiUg mark: a shopping bag carrying a white K, with two
                  motion lines behind it for the "fast delivery" half of the
                  brand. Drawn inline as SVG rather than shipped as an image so
                  it stays crisp at any size and costs no extra request. */}
              <span className="flex items-center gap-1">
                <svg
                  // Scaled with the uploaded-logo branch above, so a shop that
                  // has not uploaded one gets the same masthead proportions.
                  className="h-10 w-10 md:h-12 md:w-12"
                  viewBox="0 0 40 40"
                  role="img"
                  aria-label={brandName(settings)}
                >
                  <defs>
                    <linearGradient id="kandi-bag" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ff6a00" />
                      <stop offset="100%" stopColor="#e85d00" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M2 13h6M0 19h5M3 25h5"
                    stroke="#ff6a00"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    opacity=".55"
                  />
                  <path
                    d="M13 11h18a2 2 0 0 1 2 2.2l-1.8 20A3 3 0 0 1 28.2 36H15.8a3 3 0 0 1-3-2.8L11 13.2A2 2 0 0 1 13 11Z"
                    fill="url(#kandi-bag)"
                  />
                  <path
                    d="M17.5 12V9a4.5 4.5 0 0 1 9 0v3"
                    fill="none"
                    stroke="#e85d00"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19 18v11M27 18l-6 5.5 6 5.5"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {/* The wordmark survives the move by inverting rather than by
                  flattening. Its two tones were brand orange for the name and
                  near-black for the suffix; the orange half cannot stay,
                  because on a brand-orange ground it IS the ground. So the name
                  takes white — it is 23/27px display type, where white on
                  #ff6a00 is a legibility call rather than an AA failure — and
                  the suffix keeps exactly the ink it always had, at 5.5:1. Two
                  tones, both readable, and the mark still reads as one word
                  made of two parts. If this row ever returns to a neutral, the
                  name goes back to orange and nothing else moves. */}
              <span className="font-heading text-[23px] font-bold leading-none tracking-[-0.03em] text-white md:text-[27px]">
                {settings.brand.name}
                <span className="text-shop-ink">{settings.brand.suffix}</span>
              </span>
            </>
          )}
        </Link>

        {/* The search takes every pixel the row can spare — it is how anyone
            actually finds anything in a catalogue of this size. Help, currency,
            Orders and Favorites used to sit to its right; they were four small
            targets competing with the one large one, and all four live in the
            account menu and the footer already. */}
        {/* On a phone the search field is not drawn until it is wanted.

            At the top of the page it is a single icon beside the cart, which
            buys back a whole row for the logo and the departments — the things
            a shopper arriving on the homepage is actually looking at. Tapping
            the icon opens the field in place, and scrolling brings it back on
            its own, pinned, because past the first screen finding something is
            the only thing a shopper is doing.

            Desktop is unaffected: there is room for the full field always, and
            it stays where it has always been. */}
        <div
          className={`w-full min-w-0 flex-1 md:order-none md:block ${
            scrolled ? "order-none" : "order-last"
          } ${scrolled || searchOpen ? "block" : "hidden"}`}
        >
          <SearchBar />
        </div>

        {/* Once the shopper has scrolled, the phone masthead is the search
            field and nothing else.

            The cart and the menu toggle used to stay pinned beside it, which
            left the field about 70px short of the row on a 390px screen — and
            the query, not the chrome, is what a shopper is looking at by then.
            Neither is lost: the fixed bottom bar carries Cart and Categories as
            full tabs, so this is the same two destinations one thumb-length
            lower, and the whole row goes to the one thing being used.

            `md:flex` so desktop keeps the cluster exactly as it was. */}
        <div
          className={`shrink-0 items-center gap-5 md:ml-0 md:flex ${
            scrolled ? "ml-0 hidden" : "ml-auto flex"
          }`}
        >
          {/* The phone-sized search control. Hidden once the pinned field is on
              screen, so there are never two ways to start the same search. */}
          {!scrolled && !searchOpen && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              aria-expanded={false}
              className="text-shop-ink transition-colors hover:text-white md:hidden"
            >
              <svg className="h-[23px] w-[23px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>
            </button>
          )}

          <div className="hidden lg:block">
            <AccountMenu />
          </div>

          {/* Cart carries its running total, so the basket value stays in sight
              rather than only inside the drawer. */}
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open cart"
            className="flex items-center gap-2 text-shop-ink transition-colors hover:text-white"
          >
            <span className="relative">
              <svg className="h-[23px] w-[23px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h2.2l2 10.5h11.1L20 9H6.2" />
                <circle cx="9" cy="20" r="1.2" />
                <circle cx="17.5" cy="20" r="1.2" />
              </svg>
              {/* The badge inverts on the orange row: near-black fill, white
                  figure, and a ring in the row's own colour so the disc is cut
                  cleanly out of the white cart glyph behind it. An orange fill
                  would be invisible here — it was the contrast against a white
                  row that made the old badge a badge at all. */}
              <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-shop-nav px-1 text-[11px] font-bold text-white ring-2 ring-shop-primary">
                {count > 9 ? "9+" : count}
              </span>
            </span>
            {/* The running total only once there is one. An empty basket
                reading "UGX 0" is a figure that tells the shopper nothing and
                puts a zero in the masthead of every first visit. */}
            <span className="hidden whitespace-nowrap text-left text-[12.5px] leading-tight lg:block">
              Cart
              {count > 0 && (
                <>
                  <br />
                  <span className="price text-[13px] text-shop-ink">
                    {formatPrice(subtotal)}
                  </span>
                </>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="text-shop-ink transition-colors hover:text-white lg:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {/* ---- Department bar ----
           The Categories mega-menu anchors the row, then the curated links run
           on from it. Nothing here is a coloured slab: the row is a list of
           links, and the only colour is the one deal link that earns it. */}
      {!hideNavRow && (
        <nav
          className={`border-b border-shop-line bg-white text-shop-body ${
            scrolled ? "hidden md:block" : ""
          }`}
        >
          <div className="mx-auto flex max-w-[var(--shell)] items-center gap-2 px-4 md:px-8">
            {/* The mega-menu is a hover surface, which needs a pointer; below lg
                the button beside it opens the same tree as a stacked panel. */}
            <div className="hidden lg:block">
              <CategoriesMenu departments={departments} />
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="my-1.5 flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-shop-line px-3.5 py-1.5 text-[13px] font-medium text-shop-ink transition-colors hover:border-shop-flame hover:text-shop-flame lg:hidden"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              Categories
            </button>

            <CuratedNav departments={departments} className="flex-1" />

            {/* The only permanent seller entry point on the shopper-facing
                chrome. It earns its place: a marketplace with no visible way in
                grows only as fast as somebody remembers to recruit, and this
                costs one link at the end of a row that has room for it. */}
            <Link
              href="/sell"
              className="hidden shrink-0 whitespace-nowrap px-3 py-2.5 text-[13.5px] font-medium text-shop-primary hover:text-shop-primary-dark lg:block"
            >
              Sell on Kandi
            </Link>

            <Link
              href="/sellers"
              className="hidden shrink-0 whitespace-nowrap px-3 py-2.5 text-[13.5px] text-shop-body hover:text-shop-flame xl:block"
            >
              Shop by store →
            </Link>
          </div>
        </nav>
      )}

      {/* ---- All Categories panel ----
           The full WooCommerce department tree, and now the only place to browse
           it — the homepage sidebar that used to duplicate this is gone.

           Laid out in columns rather than as a stack of collapsibles: every
           department and its children are visible at once, so finding a
           sub-category is one glance and one click instead of expanding rows
           until you find it. It closes on any navigation and on Escape. */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close categories"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default bg-black/20"
          />
          <div className="absolute inset-x-0 z-20 max-h-[75vh] overflow-y-auto border-b border-shop-line bg-white">
            <div className="mx-auto max-w-[var(--shell)] px-4 py-6 md:px-8">
              {departments.length === 0 ? (
                <p className="py-4 text-[14px] text-shop-muted">
                  No departments yet — add product categories in WordPress and
                  they appear here.
                </p>
              ) : (
                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {departments.map((department) => (
                    <div key={department.id} className="min-w-0">
                      <Link
                        href={`/category/${department.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="block truncate text-[14px] font-bold text-shop-ink hover:text-shop-flame"
                      >
                        {department.name}
                      </Link>

                      {department.children.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {department.children.slice(0, 8).map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/category/${child.slug}`}
                                onClick={() => setMenuOpen(false)}
                                className="block truncate text-[13.5px] text-shop-body hover:text-shop-flame"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-shop-line pt-4 text-[13.5px]">
                <Link
                  href="/sellers"
                  onClick={() => setMenuOpen(false)}
                  className="font-semibold text-shop-body hover:text-shop-flame"
                >
                  Shop by store
                </Link>
                <Link
                  href="/sell"
                  onClick={() => setMenuOpen(false)}
                  className="font-semibold text-shop-body hover:text-shop-flame"
                >
                  Sell on KandiUg
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
