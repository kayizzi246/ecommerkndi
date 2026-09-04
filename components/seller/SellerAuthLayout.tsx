import Link from "next/link";

/**
 * The frame both seller auth screens sit in — sign in, and open a store.
 *
 * ---- What this replaced ----
 *
 * Two pages that agreed on nothing. Sign-in was built from a `bfl-*` token set
 * left over from an older skin — yellow lockup, yellow submit, square borders,
 * "Kandi For Less" — while Open-your-store used the shop's own orange `shop-*`
 * tokens and rounded cards. Two doors into the same product, in two different
 * brands, one click apart: the sign-in link at the foot of one leads straight
 * to the other, so the mismatch is not theoretical, it is the next screen.
 *
 * Both now render through here, which is the point of a shared frame — they
 * cannot drift apart again without someone editing this file on purpose.
 *
 * ---- Why a split rather than a card in the middle of nothing ----
 *
 * The old pages were a form floating in a full white viewport: on a 1080p
 * monitor, roughly 85% of the screen was empty, and the eye had nothing to read
 * but a 420px column. That is the shape of a password prompt, and this is not a
 * password prompt — it is the top of a funnel where somebody is deciding
 * whether to put their livelihood on this marketplace.
 *
 * So the left half does the selling and the right half does the work. It is the
 * layout every SaaS sign-up has converged on, and the reason it converged is
 * that the dead space was always doing nothing:
 *
 *   • LEFT — ink, one orange glow, the pitch. Three things the seller gets,
 *     stated plainly. Desktop only: on a phone it would push the form below
 *     the fold, and somebody who tapped "Sign in" wants the form.
 *   • RIGHT — white, quiet, one column, nothing competing with the fields.
 *
 * ---- Nothing here claims a number ----
 *
 * No "10,000+ sellers", no five-star quote from a made-up shop owner. This is a
 * real marketplace and those would be fabricated claims about it, sitting on
 * the page where a business decides to trust it. The three points below are
 * things the product actually does, and they are checkable.
 */
export default function SellerAuthLayout({
  children,
  /** Shown under the brand mark on the form side, above the heading. */
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---- The pitch ----
          `bg-shop-nav` is the same near-black the masthead's working row uses,
          so this is the shop's existing dark surface rather than a new one. The
          orange is a single soft radial rather than a gradient wash: at 16.1:1
          white-on-ink the panel can carry full-strength brand colour as an
          accent without any of it landing under type. */}
      <aside className="relative hidden overflow-hidden bg-shop-nav px-12 py-14 text-white lg:flex lg:flex-col xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full opacity-[0.22] blur-3xl"
          style={{ background: "radial-gradient(circle, #ff6a00 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[440px] w-[440px] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: "radial-gradient(circle, #ff6a00 0%, transparent 70%)" }}
        />

        <div className="relative flex h-full flex-col">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[17px] font-extrabold tracking-tight">
              Kandi <span className="font-medium text-white/70">Seller Centre</span>
            </span>
          </Link>

          {/* `mt-auto`/`mb-auto` rather than `justify-center`: the lockup stays
              pinned at the top where a masthead belongs, and the pitch centres
              in whatever is left, so this reads the same on a laptop and on a
              tall monitor. */}
          <div className="mb-auto mt-auto max-w-[440px] py-12">
            <h2 className="heading-black text-[34px] font-extrabold leading-[1.15] tracking-tight xl:text-[40px]">
              Your shop, in front of the whole country.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              List what you already sell, take orders from anywhere in Uganda,
              and get paid to the number you already use.
            </p>

            <ul className="mt-10 space-y-6">
              <Point
                title="Listings that go live the same day"
                body="Add a product, set a price, choose a category. No approval queue between you and your first order."
              />
              <Point
                title="Mobile money payouts"
                body="Settlements to MTN or Airtel, itemised per order, so the figure you are paid is one you can check."
              />
              <Point
                title="One dashboard for the whole shop"
                body="Orders, stock, revenue and commission in a single place — not a spreadsheet you keep by hand."
              />
            </ul>
          </div>

          <p className="relative text-[13px] text-white/45">
            Questions before you start?{" "}
            <Link href="/contact" className="text-white/80 underline underline-offset-4 hover:text-white">
              Talk to the team
            </Link>
          </p>
        </div>
      </aside>

      {/* ---- The work ----
          One column, capped at 400px. Wider fields do not make a form easier —
          they make the eye travel further between a label and the box under it. */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-8 md:py-14">
        <div className="mx-auto w-full max-w-[400px]">
          {/* The brand only appears on this side below `lg`, where the panel
              carrying it is not rendered. Two lockups on one screen is the
              mistake this replaces. */}
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark dark />
            <span className="text-[17px] font-extrabold tracking-tight text-shop-ink">
              Kandi <span className="font-medium text-shop-muted">Seller Centre</span>
            </span>
          </Link>

          {eyebrow && (
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-shop-primary">
              {eyebrow}
            </p>
          )}

          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * The bag mark, carried over from the old sign-in lockup — the one thing in it
 * worth keeping. In orange rather than the `bfl` yellow, because this is the
 * shop's brand and the yellow belonged to a skin nothing else on the site uses.
 */
function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        dark ? "bg-shop-primary text-white" : "bg-shop-primary text-white"
      }`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
        <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
      </svg>
    </span>
  );
}

/** One selling point: a checked disc, a bold line, and a sentence under it. */
function Point({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shop-primary/15 text-shop-primary">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4.5 4.5L19 7" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold leading-snug">{title}</span>
        <span className="mt-1 block text-[14px] leading-relaxed text-white/60">{body}</span>
      </span>
    </li>
  );
}
