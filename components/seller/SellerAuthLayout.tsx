import Link from "next/link";

/**
 * The frame both seller auth screens sit in: sign in, and open a store.
 *
 * Left, on desktop: the pitch, as a heavy headline over a bento of three tiles,
 * each showing what the seller gets as a small picture of it (mobile money
 * chips, a bar chart, a delivery route) rather than a ticked sentence. Every
 * tile is illustration, not data: no invented sales figures or seller counts.
 *
 * Right: the form, as a raised white card on a soft ground, so the one thing
 * the page is asking for sits on its own surface.
 */
export default function SellerAuthLayout({
  children,
  /** Shown above the heading on the form side. */
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f4f4f1] lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ---- The pitch ---- */}
      <aside className="relative hidden overflow-hidden bg-[#0b0b0b] px-12 py-12 text-white lg:flex lg:flex-col xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-24 h-[560px] w-[560px] rounded-full bg-shop-primary/25 blur-[140px]"
        />

        <div className="relative flex h-full flex-col">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[16px] font-extrabold tracking-tight">
              Kandi <span className="font-medium text-white/60">Seller Centre</span>
            </span>
          </Link>

          <div className="my-auto max-w-[560px] py-10">
            <h2 className="text-[44px] font-black leading-[1.02] tracking-[-0.035em] xl:text-[56px]">
              Your shop, in front of{" "}
              <span className="text-shop-primary">all of Uganda.</span>
            </h2>
            <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/65">
              List what you already sell, take orders from anywhere in the country, and get paid to
              the number you already use.
            </p>

            {/* ---- The bento ---- */}
            <div className="mt-10 grid grid-cols-2 gap-3">
              <Tile className="col-span-2" title="Paid to mobile money" body="Settlements itemised per order, to MTN or Airtel.">
                <div className="flex gap-2">
                  <span className="rounded-full bg-[#ffcb05] px-3 py-1 text-[12px] font-black text-black">MTN MoMo</span>
                  <span className="rounded-full bg-[#e40000] px-3 py-1 text-[12px] font-black text-white">Airtel Money</span>
                </div>
              </Tile>
              <Tile title="One dashboard" body="Orders, stock and earnings together.">
                <div aria-hidden className="flex h-12 items-end gap-1.5">
                  {[30, 55, 40, 70, 60, 90, 75].map((height, index) => (
                    <span
                      key={index}
                      className={`w-full rounded-t-sm ${index === 5 ? "bg-shop-primary" : "bg-white/20"}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </Tile>
              <Tile title="We deliver" body="Our riders collect and deliver nationwide.">
                <div aria-hidden className="flex h-12 items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-shop-primary" />
                  <span className="h-px flex-1 border-t-2 border-dashed border-white/25" />
                  <svg className="h-5 w-5 text-shop-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                  </svg>
                </div>
              </Tile>
            </div>
          </div>

          <p className="text-[12px] text-white/45">
            Questions before you start?{" "}
            <Link href="/contact" className="text-white/80 underline underline-offset-4 hover:text-white">
              Talk to the team
            </Link>
          </p>
        </div>
      </aside>

      {/* ---- The form ---- */}
      <main className="flex flex-col justify-center px-4 py-8 sm:px-8 md:py-14">
        <div className="mx-auto w-full max-w-[440px]">
          {/* The brand only shows on this side below `lg`, where the panel is hidden. */}
          <Link href="/" className="mb-6 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="text-[16px] font-extrabold tracking-tight text-shop-ink">
              Kandi <span className="font-medium text-shop-muted">Seller Centre</span>
            </span>
          </Link>

          <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-24px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] sm:p-8">
            {eyebrow && (
              <p className="inline-flex items-center gap-2 rounded-full bg-shop-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-shop-ink">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-shop-primary" />
                {eyebrow}
              </p>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-shop-primary text-black">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
        <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
      </svg>
    </span>
  );
}

/** A bento tile: a small illustration of the feature, then its name and one line. */
function Tile({
  title,
  body,
  className = "",
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur ${className}`}>
      {children}
      <p className="mt-3 text-[15px] font-bold">{title}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-white/55">{body}</p>
    </div>
  );
}
