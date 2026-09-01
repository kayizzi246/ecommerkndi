"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import type { CategoryNode } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import { brandName } from "@/lib/site-settings";
import SearchBar from "@/components/SearchBar";
import CuratedNav from "@/components/CuratedNav";
import CategoriesMenu from "@/components/CategoriesMenu";
import CategoryDrawer from "@/components/CategoryDrawer";
import AccountMenu from "@/components/AccountMenu";

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
  // Stable identity: `CategoryDrawer` keys its Escape-and-scroll-lock effect on
  // this, and an inline arrow would tear that listener down and rebuild it on
  // every render of the masthead.
  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
    <>
    <header
      className={`sticky top-0 z-40 border-b border-shop-line bg-white transition-transform duration-300 ease-out motion-reduce:transition-none ${
        slidUp ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {/* ---- The announcement strip is gone ----

           An orange band across the very top of every page, carrying the
           rotating promise ticker, the free-delivery progress line once there
           was something in the basket, and the sale link on the right. It was
           the third band of chrome above the fold — strip, masthead, department
           bar — and on a phone those three took about 150px before a shopper
           saw anything they could buy.

           Nothing it said is lost, and that is what made it safe to remove:

             " The free-delivery threshold is in the account panel on the
               homepage, on every product page beside the price, and in the
               footer.
             " Pay on delivery and the returns window are stated on every
               product page and in the footer.
             " The sale is a channel in the homepage strip and a link in the
               department bar on every page.

           What it uniquely carried was the LIVE nudge — "add UGX 12,000 more
           for free delivery" — which is genuinely useful and is now only in the
           basket drawer. If that is missed, the place to put it back is the
           drawer's own header or the basket page, not a band above the logo.

           The markup is deleted rather than hidden, since a block behind a
           permanent `false` is a block nobody knows is dead. `SalesTicker` goes
           with it: this strip was its only caller, so the component is deleted
           too rather than left sitting unimported. `settings.ticker` still
           carries the lines in wp-admin, and the history has the component if a
           rotating promise line is ever wanted somewhere else. */}
      {/* ---- Main row ----
           White, tight, and dominated by the search field — the marketplace
           masthead. Search is the primary way into a catalogue this size, so it
           takes the whole middle of the row and grows with the window instead
           of sitting at a fixed width. Below md it wraps to its own line.

           ---- Gray-900, then white, then orange, and white again ----

           Every earlier note was right about what it was solving, so what is
           kept here is the conclusion of each rather than the argument:

             • Gray-900 made `SearchBar` — a white pill with a dark submit
               button — the brightest object on the screen, which is what the
               most-used control in the shop should be. It cost an uploaded logo
               its legibility, and it ran three bands of chrome before a single
               product appeared.
             • White fixed the bands and let an uploaded logo alone, and handed
               the search field's prominence to `border-2` to carry by itself.
             • Orange kept the pill bright and kept the count of bands down, at
               the price of a saturated slab across the top of every page.

           White is where it lands, and the argument this time is about the PAGE
           rather than the row: the shop wants a light storefront, and a
           full-width block of #ff6a00 above the fold was the largest and
           heaviest object on the homepage. The brand still gets its colour —
           the wordmark, the deal links, the buttons, the hero disc — but it is
           spent on marks rather than on a ground.

           The row draws its own `border-b` because the department bar under it
           is white too. Without it the two are one undivided white block and
           the masthead loses its edge.

           ---- What moves with the ground, and what does not ----

           The type in this row is near-black and stays near-black. It was
           picked to clear 4.5:1 against orange and it clears 16:1 against
           white, so nothing in the resting state has to change.

           Three things DO depend on the ground and are corrected with it:

             • Hover was `text-white`, a lift that only reads on a coloured row.
               On white it would erase the control, so hover goes to brand
               orange instead.
             • The wordmark's name was white, because orange on orange is not a
               colour. It goes back to orange — which is exactly what the note
               at that branch said would happen if this row ever returned to a
               neutral, and nothing else in the mark moves.
             • The search field's resting edge was its own white, which is no
               edge at all on a white row. It goes back to `shop-line`. See the
               note in `SearchBar`.

           ---- Tighter ----

           py-2, from py-3.5, and `gap-x-4` between the row's three blocks,
           from `gap-x-6`. The row is logo, field, account and cart; none of
           them needs 28px of air above and below to be found, and the height
           saved is height the first row of products gets on the opening
           screen. The scrolled state comes down with it, to py-1.5. */}
      <div className="border-b border-shop-line bg-white">
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
            // 28/36px. It went 48/56 → 36/40 → 36/44 → here.
            //
            // Down a step again, and the reason is the same one that took it
            // off 56 twice: a masthead logo that sets the row's own height has
            // stopped being a mark and started being a banner. At 44 it was
            // doing that on a py-2 row — the plate, its padding and the mark
            // together were the tallest object in the band, so the row could
            // not get any shorter no matter what else came out of it.
            //
            // At 36 the search field is unambiguously the tallest thing in the
            // row, which is the arrangement every marketplace this is modelled
            // on uses. The max widths came down by the same proportion so a
            // wide uploaded logo shrinks with it rather than staying long and
            // getting thin.
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
            // ---- The white plate is gone; the logo is recoloured instead ----
            //
            // The plate solved a real problem and solved it bluntly. What gets
            // uploaded in wp-admin is somebody's existing logo file: usually
            // dark artwork on transparency, drawn for a white page. On orange
            // that artwork muddies, and a logo saved WITH a white background
            // becomes a bright rectangle with hard edges. A white plate makes
            // both cases legible without knowing which one it has.
            //
            // What it costs is that the masthead then carries a white card
            // parked on an orange bar. It reads as a sticker rather than as
            // branding, and it is the one element on the row that does not
            // belong to the row.
            //
            // ---- The logo is drawn in its own colours ----
            //
            // No plate behind it and no filter over it. The file uploaded in
            // wp-admin is what appears in the masthead.
            //
            // ---- The two things this replaces, and why they are gone ----
            //
            // A white PLATE came first: a rounded box behind the artwork, so a
            // dark logo drawn for a white page stayed legible on the orange bar.
            // It worked and it read as a sticker parked on the masthead — the
            // one element in the row that did not belong to the row.
            //
            // Then a FILTER, twice. `brightness(0) invert(1)` flattened the mark
            // to a single white silhouette, which lost the white K inside the
            // bag because both ended up the same white. A four-step chain
            // replaced it and brought the K back as black. Both were solving the
            // same problem: making an unknown file work on a saturated ground
            // without knowing what is in it.
            //
            // ---- What is being traded, stated plainly ----
            //
            // The shop asked for its own colours and that is the call. What it
            // costs is the guarantee: a filter produced a predictable result
            // from ANY upload, and artwork does not.
            //
            // The row is white again, which makes this cheaper than it was.
            // The two files that used to break here were a dark-on-transparent
            // logo, which muddied against #ff6a00, and a logo saved WITH a
            // white rectangle behind it, which showed as a box parked on the
            // orange. On white both of those are simply correct — a
            // dark-on-transparent PNG is now the file this slot wants, and it
            // is also the file most shops already have.
            //
            // What breaks on white instead is the opposite case: light or
            // white artwork on transparency, drawn for a dark masthead, which
            // disappears here. That is an upload problem with an upload fix.
            // If the masthead ever looks wrong after a logo change, that is
            // the first thing to check — not this component, which does
            // nothing to the image at all.
            <span className="flex items-center">
              <Image
                src={settings.brand.logo_url}
                alt={brandName(settings)}
                width={260}
                height={60}
                unoptimized
                priority
                /* Up from 28/36px. The masthead lost two of its four bands on a
                   phone and gained an always-open search field, so the row the
                   logo sits in is doing more work and can afford to state the
                   brand properly — a 28px wordmark was the smallest thing in a
                   header that also carries a cart badge. `w-auto` with a
                   `max-w` cap at both steps: the file is an arbitrary upload,
                   so the height is what is being set and the width is only
                   being stopped from running away. */
                className="h-8 w-auto max-w-[130px] object-contain md:h-10 md:max-w-[170px]"
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
                  className="h-9 w-9 md:h-10 md:w-10"
                  viewBox="0 0 40 40"
                  role="img"
                  aria-label={brandName(settings)}
                >
                  <path
                    d="M2 13h6M0 19h5M3 25h5"
                    stroke="#ff6a00"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    opacity=".55"
                  />
                  <path
                    d="M13 11h18a2 2 0 0 1 2 2.2l-1.8 20A3 3 0 0 1 28.2 36H15.8a3 3 0 0 1-3-2.8L11 13.2A2 2 0 0 1 13 11Z"
                    /* Flat, not a gradient.

                       The bag was filled with a two-stop ramp from #ff6a00 to
                       #e85d00 — a 6% shift in lightness across 22 pixels. At
                       the size this mark actually renders, 32px on a phone and
                       40 on a desktop, that is invisible: it is a gradient
                       nobody can see, costing a `<defs>`, an id, and a
                       url() indirection.

                       Where it was NOT invisible was against the orange
                       masthead it now sits on, and there it worked against the
                       mark — a bag that starts at exactly the ground colour and
                       darkens across its width reads as a shape half-dissolving
                       into the bar rather than as a logo on it.

                       Flat #ff6a00 is also what the id in `globals.css` calls
                       "the one gradient allowed" being spent somewhere it
                       matters instead of here. A logo is the last thing on a
                       site that should carry a gradient: it is reproduced at
                       every size, in one colour on an invoice, and embroidered
                       on a shirt if the shop ever prints one. */
                    fill="#ff6a00"
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
              {/* Two tones: brand orange for the name, near-black for the
                  suffix, so the mark reads as one word made of two parts.

                  The name spent the orange era in white, because on a
                  brand-orange ground orange type IS the ground. That note ended
                  by saying the name goes back to orange if the row ever returns
                  to a neutral, and this is that return. Orange on white is
                  2.9:1, which is a legibility call rather than an AA failure at
                  23/27px display type — the same allowance the palette note in
                  `globals.css` makes for the logo. The suffix keeps the ink it
                  has always had, at 16:1. */}
              <span className="font-heading text-[19px] font-bold leading-none tracking-[-0.03em] text-shop-primary md:text-[22px]">
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
        {/* ---- The field is open on a phone now, not behind an icon ----

             It used to be `hidden` below `md` until the shopper either tapped
             the magnifier or scrolled far enough to pin it. The reasoning was
             that the masthead had no room for a full-width field beside the
             logo and the cart, which was true — and it was true because the
             phone header was four bands deep. Two of those are gone (the
             department row and the homepage trust ribbon), so the room exists,
             and the field is the single most-used control on a marketplace
             this size. Making the primary action of the page a two-tap
             discovery was buying vertical space that is no longer scarce.

             `order-last` on its own line below the logo row, which is what
             `w-full` in a `flex-wrap` container produces: logo and cart on the
             first line, the field across the whole of the second. From `md` it
             goes back into the row exactly as before.

             `searchOpen` is still honoured so the pinned-on-scroll behaviour
             and the icon fallback both keep working; it is simply no longer
             the only way to see the field. */}
        {/* ---- `basis-full` on a phone, and `w-full` was not enough ----

             The first attempt kept the element's existing `w-full min-w-0
             flex-1` and simply stopped hiding it. It rendered squeezed onto the
             logo line beside the cart and the hamburger, about 140px wide with
             its submit button crowding the field.

             `flex-1` is why. It expands to `flex: 1 1 0%`, and a zero
             flex-basis is what the wrapping algorithm measures — so the item
             was small enough to fit the first line and never wrapped, with
             `width: 100%` losing to the flex sizing that comes after it.
             `basis-full` sets the basis itself, which is the number the line
             is packed against, so the field takes a line of its own.

             From `md` it goes back to `flex-1` with an auto basis: the row is
             `md:flex-nowrap` there, everything is on one line by definition,
             and the field should grow into whatever the logo and the account
             cluster leave — which is exactly what `flex-1` is for. */}
        <div
          className={`order-last block w-full min-w-0 basis-full md:order-none md:block md:flex-1 md:basis-auto ${
            scrolled ? "order-none" : ""
          }`}
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
          {/* The magnifier that used to sit here is gone. It existed to open a
              field that was hidden on a phone; the field is open on a phone
              now, so the button was a second way to reach a control already on
              screen — which is precisely the "never two ways to start the same
              search" rule its own note was written to enforce. */}

          <div className="hidden lg:block">
            <AccountMenu />
          </div>

          {/* Cart carries its running total, so the basket value stays in sight
              rather than only inside the drawer. */}
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open cart"
            className="flex items-center gap-2 text-shop-ink transition-colors hover:text-shop-primary"
          >
            <span className="relative">
              <svg className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h2.2l2 10.5h11.1L20 9H6.2" />
                <circle cx="9" cy="20" r="1.2" />
                <circle cx="17.5" cy="20" r="1.2" />
              </svg>
              {/* The badge inverts on the orange row: near-black fill, white
                  figure, and a ring in the row's own colour so the disc is cut
                  cleanly out of the white cart glyph behind it. An orange fill
                  would be invisible here — it was the contrast against a white
                  row that made the old badge a badge at all. */}
              <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-shop-primary px-1 text-[11px] font-bold text-white ring-2 ring-white">
                {count > 9 ? "9+" : count}
              </span>
            </span>
            {/* The running total only once there is one. An empty basket
                reading "UGX 0" is a figure that tells the shopper nothing and
                puts a zero in the masthead of every first visit. */}
            <span className="hidden whitespace-nowrap text-left text-[12px] leading-tight lg:block">
              Cart
              {count > 0 && (
                <>
                  <br />
                  <span className="price text-[12.5px] text-shop-ink">
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
            className="text-shop-ink transition-colors hover:text-shop-primary lg:hidden"
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
          /* ---- Desktop only ----
             This row was the third band of chrome stacked above the merchandise
             on a phone — announcement strip, masthead, this — and on a 390px
             screen it showed four of its twelve links before running off the
             edge, so it was a horizontal scroll most shoppers never performed
             sitting on top of a vertical scroll they were already doing.

             Nothing is lost on a phone. The same tree is one tap away in the
             hamburger, which opens `CategoryDrawer` with the children as well;
             the fixed bottom bar carries Categories as a full tab; and the
             search field the masthead now keeps open is the route most people
             actually take into a catalogue this size.

             It was already `hidden md:block` once scrolled, which was the same
             judgement made half way — the row is worth its height on a desktop
             and is not worth it on a phone, and the scroll state was never the
             thing that decided that. */
          className={`hidden border-b border-shop-line bg-white text-shop-body md:block`}
        >
          <div className="mx-auto flex max-w-[var(--shell)] items-center gap-2 px-4 md:px-8">
            {/* The mega-menu is a hover surface, which needs a pointer; below lg
                the button beside it opens the same tree as a stacked panel. */}
            <div className="hidden lg:block">
              <CategoriesMenu departments={departments} />
            </div>

            {/* ---- The Categories pill is gone below `md` ----
                 It opened the same drawer as the hamburger sitting directly
                 above it in the masthead, and as the Categories tab in the
                 fixed bottom bar. Three controls for one drawer, two of them
                 on screen at once, and this was the one eating the left third
                 of the department row — so the curated links beside it started
                 half-scrolled and read as a row that had already been swiped.

                 It stays from `md` to `lg`, where there is width for it and no
                 bottom bar to carry Categories. */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="my-1.5 hidden shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-shop-line px-3.5 py-1.5 text-[12.5px] font-medium text-shop-ink transition-colors hover:border-shop-flame hover:text-shop-flame md:flex lg:hidden"
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
              className="hidden shrink-0 whitespace-nowrap px-3 py-2.5 text-[12.5px] font-medium text-shop-primary hover:text-shop-primary-dark lg:block"
            >
              Sell on Kandi
            </Link>

            {/* ---- "Shop by store →" is gone from this row ----

                 It was the second link in the same bar going to the same page:
                 "Top Brands" in the curated list is `/sellers` as well. One of
                 the two had to go, and this is the one whose label nobody was
                 searching for.

                 Removing it also fixes a real defect. The curated list is ten
                 fixed labels about 960px wide and it does not shrink; from
                 `lg` up this row stops scrolling, so once the labels plus the
                 two links on the right exceeded the row, the list simply
                 painted OVER them. Between 1280 and roughly 1400 — 1280x800
                 and 1366x768, which is most laptops — the bar read
                 "BeautySell on KandiUgTop Brands", three links stacked on one
                 another. Above 1400 there was room and it looked fine, which
                 is why it survived.

                 The sellers page keeps its two other routes in: "Top Brands"
                 here, and the footer. */}
          </div>
        </nav>
      )}

      {/* ---- The department tree, below `lg` ----
           This was a full-width dropdown laying the tree out in columns. That
           shape is right on a desktop and {@link CategoriesMenu} still serves
           it there — but `menuOpen` is only ever set by the two `lg:hidden`
           controls above, so the dropdown was in practice the PHONE menu, and
           on a phone its columns collapsed to one cramped stack inside a 75vh
           box: a scroll within a scroll, first department filling the viewport,
           everything else below the fold.

           {@link CategoryDrawer} is the phone shape instead — a slide-in panel
           that owns the screen, banded into account, categories and services. */}
    </header>

      {/* ---- Outside the <header>, and it has to be ----

           This sat inside the header and rendered as a panel roughly 180px
           tall, clipped straight across the second category row.

           Nothing was wrong with the drawer. The header carries
           `transition-transform` and `translate-y-0` so it can slide away on
           scroll, and ANY transform other than `none` makes that element the
           containing block for `position: fixed` descendants. So the drawer's
           `fixed inset-0` stopped meaning "the viewport" and started meaning
           "the masthead" — which is exactly as tall as the piece of drawer that
           was showing.

           `CartDrawer` never hit this because it renders from `StoreChrome`,
           outside the header entirely. This now sits in the same position
           relative to the transform: a sibling of the masthead rather than a
           child of it.

           Anything fixed that is added here later has to stay out here too. */}
      <CategoryDrawer
        departments={departments}
        open={menuOpen}
        onClose={closeMenu}
      />
    </>
  );
}
