import Link from "next/link";
import {
  MtnMark,
  AirtelMark,
  VisaMark,
  MastercardMark,
} from "@/components/PaymentMarks";

/**
 * The closing reassurance panel: four promises, and what the shop takes.
 *
 * Placed last on purpose, and that has not changed. Reassurance answers an
 * objection, and an objection is something a shopper only has once they are
 * considering buying — putting this above the products spends the first screen
 * on a promise nobody has asked for yet. {@link TrustRibbon} at the top of the
 * page is the short version, delivered early; this is the long one, delivered
 * to the reader who has scrolled the catalogue and is deciding.
 *
 * Four items, not five or six: each one added dilutes the rest, and these are
 * the four that come up in Ugandan ecommerce specifically — is it real, is my
 * money safe, do I have to pay before I see it, and what if it is wrong.
 *
 * ---- What was added, and why it is not a fifth promise ----
 *
 * The payment marks. They sit under the four, on their own line, and they are
 * doing something the promises cannot: "Secure Payments — card and mobile
 * money" is the shop asserting a capability, whereas the MTN, Airtel, Visa and
 * Mastercard marks are four other companies' names on the page. A shopper who
 * has never heard of this shop has certainly heard of those, and recognising
 * one of them is the fastest way a stranger's checkout becomes plausible. It is
 * the only trust on this panel that is not the shop vouching for itself.
 *
 * They cost no new asset either — `PaymentMarks` draws all four as type and two
 * SVG circles, so this is four inline shapes rather than four logo files. The
 * footer and the checkout already render the same component, so a shopper meets
 * the same row in all three places rather than four marks that drift apart.
 *
 * ---- And the line out of the panel ----
 *
 * A shopper still unconvinced at the foot of the homepage needs somewhere to
 * go, and until now the panel was a dead end: four claims, no way to check any
 * of them. `/help` is where buying here is explained at length, and a link is
 * cheaper than a fifth promise.
 */
const PROMISES = [
  {
    title: "Authentic Products",
    copy: "Checked before dispatch",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 5 6.5v5c0 4.4 3 8 7 9 4-1 7-4.6 7-9v-5l-7-3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.2 12 2 2 3.6-3.8" />
      </>
    ),
  },
  {
    title: "Secure Payments",
    copy: "Card and mobile money",
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M3 10h18" />
      </>
    ),
  },
  {
    title: "Pay on Delivery",
    copy: "Pay when it arrives",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6Z" />
        <circle cx="7" cy="18.5" r="1.6" />
        <circle cx="17.5" cy="18.5" r="1.6" />
      </>
    ),
  },
  {
    title: "Easy Returns",
    // Filled in from wp-admin by the component below — this used to read
    // "14 days, no questions" as a literal, which is a promise the shop can
    // change in its settings without this line noticing.
    copy: "",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h11a5 5 0 0 1 0 10h-4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 5.5-3.5 3.5 3.5 3.5" />
      </>
    ),
  },
];

/**
 * `returnsDays` comes down as a prop rather than through `useCommerceTerms`,
 * because this bar renders on the homepage — a server component with the
 * settings already in hand — and there is no reason to ship it to the browser
 * just to read one number.
 */
export default function TrustBar({ returnsDays }: { returnsDays: number }) {
  const promises = PROMISES.map((promise) =>
    promise.title === "Easy Returns"
      ? { ...promise, copy: `${returnsDays} days, no questions` }
      : promise
  );

  return (
    <section
      aria-labelledby="confidence-heading"
      /* This drew its own panel by hand — a 24px radius, a real border and its
         own padding — back when it was the only bordered block on a flat white
         page. Every section is a panel now, so it takes the shared class and
         stops being a slightly different shape from the twelve shelves above
         it. `py-` is added back on top because this block is text rather than
         merchandise and wants a little more air than a rail does. */
      className="shop-panel py-6 md:py-7"
    >
      {/* ---- A heading, where there was only an `aria-label` ----

          The panel was four unlabelled cells with a screen-reader-only name on
          the section. Sighted readers got the icons and had to infer what the
          row was for; a screen reader got a name nobody else could see. One
          visible `<h2>` serves both, and it is the sentence the panel is
          actually making — the four cells below are its evidence.

          Deliberately NOT a {@link SectionHeader}: that component sets 22/26px
          for a merchandising signpost competing with product photography, and
          this is a quiet closing statement under a rule. Borrowing it here
          would make "Buy with confidence" the largest heading on the lower half
          of the page, louder than the department rails it follows. */}
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="confidence-heading" className="heading-black text-[17px] text-shop-ink md:text-[19px]">
          Buy with confidence
        </h2>
        <Link
          href="/help"
          className="text-[13px] font-semibold text-shop-primary transition-colors hover:text-shop-primary-dark"
        >
          How buying here works ›
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        {promises.map((promise) => (
          /* `items-start` rather than `items-center`, now that the copy is
             allowed to run to two lines — see the note on the text below. A
             centred icon beside a two-line label sits half a line low and makes
             a tidy grid look loose; aligned to the top it stays on the same
             baseline as the title in all four cells whether they wrap or not.
             The `mt-0.5` on the disc is the optical correction for the
             cap-height of the 14px title beside it. */
          <li key={promise.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shop-primary-soft">
              <svg
                aria-hidden
                className="h-5 w-5 text-shop-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                viewBox="0 0 24 24"
              >
                {promise.icon}
              </svg>
            </span>
            {/* ---- Not truncated ----

               Both lines carried `truncate`, and on a phone every one of them
               hit it: two columns at 390px leaves about 110px for the text, so
               the panel read "Authentic Pro…", "Secure Paym…", "Card and
               mobil…", "Pay when it arri…", "14 days, no que…". A panel headed
               "Buy with confidence" whose four promises are all cut off
               mid-word is arguing against itself — an ellipsis is the shop
               saying the sentence was not worth finishing, on the one block of
               the page whose entire job is being believed.

               `truncate` is the right default for a product title, which is
               arbitrary text of unknown length coming out of WooCommerce. These
               four are a fixed list written in this file; they are short, they
               are known, and the correct answer to "it does not fit" is a
               second line rather than an ellipsis. The tallest cell sets the
               row height and the grid stays even because every cell wraps at
               the same width. */}
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-snug text-shop-ink">{promise.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-shop-muted">{promise.copy}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Under a hairline rather than beside the promises. The marks are a
          different KIND of statement — other people's names rather than the
          shop's own — and a rule is the cheapest way to say so. On a phone the
          row wraps rather than scrolls: four marks at 11px fit two lines
          comfortably, and unlike the ribbon at the top of the page there is no
          height budget to defend down here. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-shop-hairline pt-5">
        <span className="text-[12.5px] text-shop-muted">Pay with</span>
        <MtnMark />
        <AirtelMark />
        <VisaMark />
        <MastercardMark />
        {/* Cash last, and as words rather than a mark, because it is the only
            one of the five with no brand behind it — and on this shop it is the
            method most orders actually use. */}
        <span className="rounded-[3px] border border-shop-line bg-white px-1.5 py-[3px] text-[10px] font-extrabold uppercase leading-none tracking-[0.04em] text-shop-body">
          Cash
        </span>
      </div>
    </section>
  );
}
