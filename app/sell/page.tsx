import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import EarningsCalculator from "./EarningsCalculator";

export const metadata: Metadata = {
  alternates: { canonical: "/sell" },
  title: "Sell on Kandi",
  description:
    "Open a store on Kandi and reach shoppers across Uganda. No listing fees, one flat commission, and payouts you request yourself.",
};

/* ============================================================================
   /sell — the seller prospectus
   ============================================================================

   ---- What this page was, and why it was rebuilt ----

   It was a software company's landing page: a pointer-reactive particle canvas
   behind the hero, two radial colour blooms and a masked dot grid stacked under
   that, a headline whose last four words ran through a three-stop gradient, six
   benefit cards each with its own pastel icon tile in a different hue, four
   numbered circles in a row, and a green-to-blue gradient band at the foot with
   a white pill in it.

   Every one of those is a decoration applied to the page rather than a decision
   about it, and together they are the house style of a template — which is the
   problem, because the reader is a shopkeeper deciding whether to hand a
   business to strangers. A page that looks generated suggests the operation
   behind it might be too. The particle field was the clearest tell: nothing
   else on this marketplace moves on its own, anywhere.

   They also contradicted the shop's own written rules. `globals.css` calls
   `--color-shop-ember` "the second stop of the one gradient allowed"; this page
   had three. It set its headline in `font-black`, and Poppins is downloaded at
   600 and 700 only, so with `font-synthesis-weight: none` the 900 was rendering
   as 700 — a design decision that existed solely in the comment explaining it.
   That comment credited the weight to Roboto, which is a fallback in the stack
   and was never downloaded either.

   ---- What replaced it ----

   The subject of this page is money: a fee, a commission, a payout interval.
   So the FIGURES are the artwork. There is no illustration, no gradient and no
   background texture anywhere on the page. The graphic interest comes from a
   ruled terms table under the hero that sets the whole offer in large tabular
   numerals — the first thing a seller wants to know, and the last thing a
   template leads with.

   Three devices carry the rest, used consistently:

     1. RULES, NOT CARDS. Related things are separated by hairlines and share a
        column grid, the way a prospectus or a price list does it. A white
        rounded box around every group is what made the old page read as six
        identical objects with nothing to say about their order.

     2. A LEFT SPINE. From lg, each section puts its heading in a 220px margin
        column with the content beside it, instead of centring a heading over a
        grid. Centred-head-then-three-cards is the shape the eye now reads as
        machine-made, and the asymmetry puts the section title at the top left,
        where somebody scanning down a long page is actually looking.

     3. ONE ACCENT. Brand orange appears on the primary buttons, the short rule
        above each section label, and the step figures. Nothing else is
        coloured. The old page used six hues — green, blue, violet, orange,
        pink and a second green — picked to fill a grid rather than to mean
        anything.

   The copy is largely the old page's, which was never the problem: it is
   specific, it states real numbers and it admits what the fee is for. It has
   been re-cut into the new structure and given the one section a template will
   never write — who should NOT apply.

   ---- The ground ----

   `#faf9f6`, a warm near-white, with white kept for the panels that have to
   lift off it. A literal rather than a token because it is this page only: the
   storefront is white paper because it is a catalogue of photographs, and this
   page is a document.
   ============================================================================ */

/**
 * The section label that sits in the left spine.
 *
 * A short orange rule, the label, and optionally a line of standfirst. From lg
 * it becomes the margin column and sticks to the top of the viewport while its
 * section scrolls past, so a reader always knows which part of the argument
 * they are in — a long page's table of contents, without a menu.
 */
function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="lg:sticky lg:top-[92px]">
      <span aria-hidden className="block h-[3px] w-7 bg-shop-primary" />
      <h2 className="mt-4 text-[24px] font-bold leading-tight tracking-[-0.02em] text-shop-ink md:text-[28px]">
        {title}
      </h2>
      {note && (
        <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-shop-body">{note}</p>
      )}
    </div>
  );
}

export default async function SellPage() {
  const settings = await getSiteSettings();
  const { seller, commerce, brand, support } = settings;

  /* The offer, as four figures. This is the hero's artwork — see the note at
     the head of the file. `detail` is the qualifier that stops each number
     reading as a slogan: "10%" alone is a marketing figure, "of each item you
     actually sell" makes it a term of business. */
  const terms = [
    {
      label: "Monthly fee",
      value: formatPrice(seller.registration_fee),
      detail: "first month refunded if we turn you down",
    },
    {
      label: "Commission",
      value: `${seller.commission_rate}%`,
      detail: "of each item you actually sell",
    },
    { label: "Listing fees", value: "None", detail: "list as many products as you like" },
    {
      label: "Payouts",
      value: `Every ${seller.payout_days} days`,
      detail: "requested by you, to mobile money or a bank",
    },
  ];

  /* Six terms of the deal, set as a definition list because that is what they
     are. The old page gave each one a coloured icon tile; not one of those
     icons carried meaning the two-word title did not already carry. */
  const included = [
    {
      title: "No listing fees, ever",
      copy: `List as many products as you like. We earn when you do — a flat ${seller.commission_rate}% of each item sold, and nothing else.`,
    },
    {
      title: "Delivery is handled",
      copy: `We collect the parcel, deliver anywhere in Uganda, and carry the free-delivery promise over ${formatPrice(commerce.free_delivery_from)}. You pack it; we move it.`,
    },
    {
      title: "You are paid on your say-so",
      copy: `Earnings clear once an order completes. Ask for a payout whenever you want it — settled every ${seller.payout_days} days to mobile money or your bank.`,
    },
    {
      title: "Numbers you can act on",
      copy: "Revenue, units, best sellers, what is running out of stock and exactly what you are owed, updated as orders land. Not a wall of charts.",
    },
    {
      title: "Your name stays on your goods",
      copy: "Your store gets its own page and its own name on every product you list. A shopper knows who they bought from, and comes back to you rather than to us.",
    },
    {
      title: "The payment risk is ours",
      copy: "Cash on delivery, MTN MoMo, Airtel Money and cards are all collected by Kandi. You are never the one chasing a customer for money.",
    },
  ];

  const steps = [
    {
      title: "Apply",
      copy: "Five short steps: your store, you, your password, your first month. About three minutes.",
    },
    {
      title: "Pay the first month",
      copy: `${formatPrice(seller.registration_fee)} by mobile money, quoting the reference we give you.`,
    },
    {
      title: "We check it",
      copy: "A person reads every application. Usually the same day, and we email you either way.",
    },
    {
      title: "List and sell",
      copy: "Add products from your dashboard. Each listing is checked once, then you are live.",
    },
  ];

  const feeCovers = [
    "Verifying your identity and your business, so a shopper can trust every store on the marketplace",
    "Setting up your store page, your seller account and your payout details",
    "The first review of your listings — photographs, descriptions and pricing, read by a person",
    "Onboarding: someone walks you through your first listing and your first payout",
  ];

  /* The section no template writes. Turning the wrong applicant away before
     they pay is worth more than the fee is, and a page confident enough to
     print its own exclusions is the strongest trust signal available to it. */
  const apply = [
    "You have stock now, or can get it within a few days of a sale",
    "You sell genuine goods and photograph them yourself",
    "You are in footwear or fashion — that is where the shoppers here are",
    "You can pack a parcel the day the order lands",
  ];

  const doNot = [
    "You have nothing to sell yet and are testing an idea",
    "You are reselling goods you have never seen or handled",
    "Your photographs came from the supplier rather than from you",
    "You deal in copies — a store selling them is closed the day we find out",
  ];

  const faqs = [
    {
      q: "Is the monthly fee refundable?",
      a: `If we reject your application, your first ${formatPrice(seller.registration_fee)} is refunded in full within five working days. After that it is a subscription rather than a purchase: stop paying whenever you like and your store simply comes off the shop when the month you have paid for ends. Part-months already running are not refunded.`,
    },
    {
      q: "Are there any other charges?",
      a: `No. No listing fees and no payout fee. There are two costs and no others: the ${formatPrice(seller.registration_fee)} monthly fee, and ${seller.commission_rate}% commission on items you actually sell.`,
    },
    {
      q: "What can I sell?",
      a: "Footwear and fashion are our core, and that is where the shoppers are. Genuine products only, with your own photographs. Counterfeits close a store immediately.",
    },
    {
      q: "Who handles returns?",
      a: `Kandi does. Shoppers get ${commerce.returns_days} days, the same across the whole site. A returned item comes back to you and the commission on it is reversed automatically.`,
    },
    {
      q: "How quickly do I get my money?",
      a: `Earnings sit as pending while an order is being fulfilled, become payable once it completes, and you request a payout from your dashboard. We settle every ${seller.payout_days} days.`,
    },
  ];

  return (
    <main className="bg-[#faf9f6]">
      {/* ================= Hero ================= */}
      <section className="border-b border-shop-line">
        <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-12 md:px-8 md:pb-16 md:pt-16">
          {/* 1.05 / 0.95 rather than a clean half and half. The copy column
              carries a display headline and wants the extra measure; the
              calculator is a fixed set of controls and does not. Equal columns
              are the proportion a layout falls into when nobody chose one. */}
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              {/* An eyebrow, not a status pill. The old one was a white lozenge
                  with a pulsing green dot reading "Now accepting new stores" —
                  a live indicator for something that is not live data, which is
                  decoration wearing the clothes of information. This says who
                  the page is for, which is the job an eyebrow has. */}
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-shop-primary-ink">
                For shop owners in Uganda
              </p>

              {/* ---- The headline ----
                   Set in ink at 700, the heaviest Poppins weight the site
                   actually downloads, with no coloured phrase and no gradient.
                   Restraint is the point: the one saturated thing in this
                   viewport should be the button the page is asking you to
                   press, and a headline competing with it costs the page its
                   only strong signal.

                   The break is hand-placed so the line divides where the sense
                   does — "Sell your shoes and fashion" is the offer, "to the
                   whole of Uganda" is the reach. Left to the browser it broke
                   after "to", stranding a preposition, which reads as text that
                   was enlarged rather than type that was set. */}
              <h1 className="mt-5 text-[36px] font-bold leading-[1.02] tracking-[-0.03em] text-shop-ink md:text-[50px] lg:text-[56px]">
                Sell your shoes and fashion
                <br className="hidden sm:block" /> to the whole of Uganda.
              </h1>

              <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.6] text-shop-body">
                Open a store on {brand.name} and list what you have. We run the storefront, take
                the payments and deliver the parcel — you pack it. There is nothing to build and
                nothing to host.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {/* The house button: an 8px rectangle, the same one the
                    storefront uses on every product page. The old page drew
                    pills here, which matched nothing else on the site. */}
                <Link href="/seller/register" className="btn-shop px-7 py-3.5 text-[16px]">
                  Start selling
                </Link>
                <Link href="#calculator" className="btn-shop-outline px-6 py-3.5 text-[16px]">
                  Work out what you would keep
                </Link>
              </div>

              <p className="mt-6 text-[14px] leading-relaxed text-shop-muted">
                Already selling with us?{" "}
                <Link
                  href="/seller/login"
                  className="font-semibold text-shop-ink underline underline-offset-4 hover:text-shop-primary"
                >
                  Sign in to your dashboard
                </Link>
              </p>
            </div>

            <div id="calculator" className="scroll-mt-24">
              <EarningsCalculator
                commissionRate={seller.commission_rate}
                registrationFee={seller.registration_fee}
                payoutDays={seller.payout_days}
              />
            </div>
          </div>
        </div>

        {/* ---- The terms ----
             The page's one piece of artwork, and it is a table.

             A seller's first question is what this costs, and the honest answer
             is four numbers. Setting them large, in tabular figures, on a rule
             does two jobs at once: it gives the hero the graphic weight the
             particle field was there to provide, and it puts the least
             flattering fact about the offer — a monthly fee — in the largest
             type on the page. A page that leads with its price reads as a page
             with nothing to hide.

             `divide-x` only from md; below that the cells stack two-up and
             vertical rules would be dividing nothing. */}
        <div className="border-t border-shop-ink/85 bg-white">
          <dl className="mx-auto grid max-w-[1200px] grid-cols-2 divide-shop-line px-4 md:grid-cols-4 md:divide-x md:px-8">
            {terms.map((term) => (
              <div key={term.label} className="py-6 md:px-6 md:py-7 md:first:pl-0 md:last:pr-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-shop-muted">
                  {term.label}
                </dt>
                <dd className="mt-2 text-[26px] font-bold leading-none tracking-[-0.02em] text-shop-ink tabular-nums md:text-[30px]">
                  {term.value}
                </dd>
                <dd className="mt-2 max-w-[26ch] text-[13px] leading-snug text-shop-muted">
                  {term.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ================= What you get ================= */}
      <section id="why" className="scroll-mt-20 border-b border-shop-line">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[220px_1fr] lg:gap-16">
          <SectionHead
            title="What you get"
            note="Everything a shop needs to trade online, none of it built by you."
          />

          {/* A definition list on hairlines. Each row is title-left,
              copy-right from sm, which lets the eye run down the titles alone
              and stop at the one it cares about. A grid of six cards has no
              such reading order, because every card is the same object. */}
          <dl className="divide-y divide-shop-line border-t border-shop-line">
            {included.map((item) => (
              <div
                key={item.title}
                className="grid gap-1.5 py-5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-8 md:py-6"
              >
                <dt className="text-[17px] font-bold leading-snug tracking-[-0.01em] text-shop-ink">
                  {item.title}
                </dt>
                <dd className="text-[15px] leading-[1.65] text-shop-body">{item.copy}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section id="how-it-works" className="scroll-mt-20 border-b border-shop-line bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[220px_1fr] lg:gap-16">
          <SectionHead title="How it works" note="Four steps, and a person at the third one." />

          <div>
            {/* Figures, not filled circles. `01` set in the brand orange above
                the step title is a printed-sequence device and it survives at
                any width. Four orange discs in a row is the shape every
                template draws, and on a phone they stack into a column of
                bullets that has lost its sequence.

                The 1px gaps in the grid are the rules: `gap-px` over an ink
                line ground draws hairlines between cells at every breakpoint
                without needing a different divide- utility per column count. */}
            <ol className="grid gap-px border-t border-shop-line bg-shop-line md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="bg-white pb-6 pt-5 md:px-5 md:first:pl-0">
                  <span className="text-[13px] font-bold tracking-[0.08em] text-shop-primary tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-[17px] font-bold tracking-[-0.01em] text-shop-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-[1.6] text-shop-body">{step.copy}</p>
                </li>
              ))}
            </ol>

            {/* The slow part, stated rather than hidden. Every marketplace that
                lets anyone list instantly ends up policing counterfeits
                afterwards, and the sellers who lose from that are the honest
                ones. Saying so here is also the argument for the fee, three
                sections early. */}
            <p className="mt-8 border-l-2 border-shop-primary pl-4 text-[15px] leading-[1.7] text-shop-body">
              None of this is automatic. A person approves your store and a person reads your first
              listings, which is slower than a form that lets anybody in — and it is the reason a
              shopper trusts the stores that get through it.
            </p>
          </div>
        </div>
      </section>

      {/* ================= The fee ================= */}
      {seller.registration_fee > 0 && (
        <section id="pricing" className="scroll-mt-20 border-b border-shop-line">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[220px_1fr] lg:gap-16">
            <SectionHead
              title={`What the ${formatPrice(seller.registration_fee)} a month is for`}
              note="A straight answer, because it is the question that stops most people applying."
            />

            <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="space-y-4 text-[15px] leading-[1.7] text-shop-body">
                <p>
                  It is a subscription, not a deposit and not commission in advance. It pays for
                  the shopfront your products sit in — the storefront, the photography standards,
                  the delivery network and the support line — for as long as you are trading here.
                </p>
                <p>
                  Stop paying and nothing is lost. Your listings stop showing to shoppers when the
                  month runs out; your account, your products and your order history stay exactly
                  as they are, and paying again puts everything straight back.
                </p>
                <p>
                  It does a second job as well. It is why every store here is real: a marketplace
                  that is free to join fills up with accounts that list one counterfeit and vanish,
                  and it is the honest sellers who pay for that in lost trust.
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-shop-muted">
                  What it covers
                </p>
                {/* Numbered rows on hairlines. The old version put a green tick
                    in a circle beside each line and finished with a pale green
                    box — but a tick means "done", and none of these are done.
                    They are things bought. */}
                <ol className="mt-3 divide-y divide-shop-line border-y border-shop-line">
                  {feeCovers.map((item, index) => (
                    <li key={item} className="flex gap-4 py-4">
                      <span className="mt-0.5 shrink-0 text-[13px] font-bold text-shop-primary tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[15px] leading-[1.6] text-shop-body">{item}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 text-[15px] font-semibold leading-relaxed text-shop-ink">
                  Turned down? Your first {formatPrice(seller.registration_fee)} comes back within
                  five working days.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= Who it is for ================= */}
      <section className="border-b border-shop-line bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[220px_1fr] lg:gap-16">
          <SectionHead
            title="Who this is for"
            note="We do turn applications down, and it is cheaper for everybody if that happens before you pay."
          />

          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-shop-ink">
                Apply if
              </h3>
              <ul className="mt-4 divide-y divide-shop-line border-t border-shop-line">
                {apply.map((item) => (
                  <li key={item} className="py-3.5 text-[15px] leading-[1.6] text-shop-body">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* The second column is set a step lighter than the first, which is
                the whole visual argument: these are the ones to walk away from,
                and they should read as the quieter list rather than as a
                mirror-image feature grid. */}
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-shop-muted">
                Do not apply if
              </h3>
              <ul className="mt-4 divide-y divide-shop-line border-t border-shop-line">
                {doNot.map((item) => (
                  <li key={item} className="py-3.5 text-[15px] leading-[1.6] text-shop-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-20 border-b border-shop-line">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[220px_1fr] lg:gap-16">
          <SectionHead title="Before you apply" />

          <div>
            {/* Native `<details>` on hairlines rather than inside a card. No
                JavaScript, and it prints. */}
            <div className="divide-y divide-shop-line border-y border-shop-line">
              {faqs.map((faq) => (
                <details key={faq.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[16px] font-semibold leading-snug text-shop-ink">
                    {faq.q}
                    <span
                      aria-hidden
                      className="mt-1 shrink-0 text-[18px] font-normal leading-none text-shop-muted transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.7] text-shop-body">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>

            <p className="mt-6 text-[15px] text-shop-muted">
              The full rules are in the{" "}
              <Link
                href="/seller-policies"
                className="font-semibold text-shop-ink underline underline-offset-4 hover:text-shop-primary"
              >
                seller policies
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ================= Closing ================= */}
      {/* Ink, not a gradient. The site already owns this colour — it is
          `--color-shop-band`, the storefront's dark bar — so the page closes on
          something the reader has seen elsewhere on the brand rather than on a
          green-to-blue wash that appears here and nowhere else.

          The phone number matters as much as the button does. A reader's last
          unanswered question is whether there is a person at the other end, and
          a number they can dial answers it in a way a Contact link does not. */}
      <section className="bg-shop-band">
        <div className="mx-auto max-w-[1200px] px-4 py-14 md:px-8 md:py-16">
          <div className="grid items-end gap-8 md:grid-cols-[1fr_auto] md:gap-12">
            <div>
              <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[34px]">
                Set your store up today
              </h2>
              <p className="mt-3 max-w-[46ch] text-[16px] leading-relaxed text-white/70">
                Three minutes to apply, {formatPrice(seller.registration_fee)} for the first month,
                and most applications are reviewed the same day.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <Link href="/seller/register" className="btn-shop px-8 py-3.5 text-[16px]">
                Start selling
              </Link>
              {support.phone && (
                <p className="text-[14px] text-white/60">
                  Or talk to someone first:{" "}
                  <a
                    href={`tel:${support.phone.replace(/\s+/g, "")}`}
                    className="font-semibold text-white underline underline-offset-4"
                  >
                    {support.phone}
                  </a>
                  {support.hours ? `, ${support.hours.toLowerCase()}` : null}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
