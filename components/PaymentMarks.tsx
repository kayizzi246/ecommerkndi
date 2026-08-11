/**
 * The payment marks shown beside each method at checkout.
 *
 * Drawn as inline SVG rather than shipped as images: they sit above the fold on
 * the highest-stakes screen in the shop, and three extra network requests there
 * are three chances to render a payment option with a broken image next to it.
 *
 * These are simplified wordmarks in each brand's colours — enough for a shopper
 * to recognise at a glance which button takes their MoMo line and which takes
 * their card, which is the only job they have. They are not the official brand
 * assets; if MTN, Airtel, Visa or Mastercard supply artwork for the shop, swap
 * these for it.
 */

export function MtnMark() {
  return (
    <Mark label="MTN MoMo">
      <span className="rounded-[3px] bg-[#ffcb05] px-1.5 py-[3px] text-[10px] font-extrabold leading-none text-[#00447c]">
        MTN
      </span>
    </Mark>
  );
}

export function AirtelMark() {
  return (
    <Mark label="Airtel Money">
      <span className="rounded-[3px] bg-[#e40000] px-1.5 py-[3px] text-[10px] font-extrabold leading-none text-white">
        airtel
      </span>
    </Mark>
  );
}

export function VisaMark() {
  return (
    <Mark label="Visa">
      <span className="rounded-[3px] border border-shop-line bg-white px-1.5 py-[3px] text-[11px] font-extrabold italic leading-none tracking-tight text-[#1a1f71]">
        VISA
      </span>
    </Mark>
  );
}

export function MastercardMark() {
  return (
    <Mark label="Mastercard">
      <span className="flex items-center rounded-[3px] border border-shop-line bg-white px-1.5 py-[3px]">
        {/* The interlocking circles, which is what people actually recognise. */}
        <svg viewBox="0 0 34 21" className="h-[11px] w-[18px]" aria-hidden>
          <circle cx="13" cy="10.5" r="9" fill="#eb001b" />
          <circle cx="21" cy="10.5" r="9" fill="#f79e1b" />
          <path
            d="M17 3.6a9 9 0 0 0 0 13.8 9 9 0 0 0 0-13.8Z"
            fill="#ff5f00"
          />
        </svg>
      </span>
    </Mark>
  );
}

/** One mark, labelled for anyone who cannot see it. */
function Mark({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center" role="img" aria-label={label}>
      {children}
    </span>
  );
}
