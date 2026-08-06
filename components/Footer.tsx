import Link from "next/link";

const COLUMNS = [
  {
    title: "Customer Service",
    items: [
      { name: "Help centre", href: "/help" },
      { name: "Delivery & returns info", href: "/shipping" },
      { name: "Returns & refunds", href: "/returns" },
      { name: "Track your order", href: "/track-order" },
      { name: "Contact us", href: "/contact" },
    ],
  },
  {
    title: "About Kandi",
    items: [
      { name: "Our story", href: "/about" },
      { name: "Careers", href: "/careers" },
      { name: "Store locator", href: "/stores" },
      { name: "Terms & conditions", href: "/terms" },
      { name: "Privacy policy", href: "/privacy" },
    ],
  },
  {
    title: "Sell With Us",
    items: [
      { name: "Become a seller", href: "/seller/register" },
      { name: "Seller centre", href: "/seller" },
      { name: "Commission & fees", href: "/seller/commissions" },
      { name: "Seller policies", href: "/seller-policies" },
    ],
  },
];

const SERVICE_STRIP = [
  { title: "Free delivery", copy: "On orders over UGX 50,000" },
  { title: "Easy returns", copy: "14 days to change your mind" },
  { title: "Secure payments", copy: "Cash, MTN MoMo, Airtel Money, Visa" },
  { title: "Need help?", copy: "Call 0200 804 020" },
];

export default function Footer() {
  return (
    <footer className="mt-14 border-t border-bfl-line bg-white">
      {/* Service promises */}
      <div className="border-b border-bfl-line bg-bfl-surface">
        <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-7 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
          {SERVICE_STRIP.map((item) => (
            <div key={item.title}>
              <p className="text-[13px] font-bold text-bfl-ink">{item.title}</p>
              <p className="mt-1 text-xs text-bfl-grey">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-11 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-black">
              {column.title}
            </h2>
            <ul className="space-y-2.5 text-[13px] text-bfl-grey">
              {column.items.map((item) => (
                <li key={item.name}>
                  <Link className="hover:text-black hover:underline" href={item.href}>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div id="kandi-app">
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-black">
            Download our app
          </h2>
          <p className="text-[13px] leading-6 text-bfl-grey">
            Shop faster, unlock app-only prices and track every order.
          </p>
          <div className="mt-4 flex gap-2">
            <span className="rounded bg-black px-3 py-2 text-[11px] font-bold text-white">App Store</span>
            <span className="rounded bg-black px-3 py-2 text-[11px] font-bold text-white">Google Play</span>
          </div>

          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-wide text-black">Follow us</h2>
          <div className="flex gap-2">
            {["f", "in", "X", "ig"].map((label) => (
              <span
                key={label}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Legal bar */}
      <div className="border-t border-bfl-line bg-black">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-5 text-xs text-white/60 md:flex-row md:items-center md:justify-between md:px-8">
          <span>© {new Date().getFullYear()} Kandi Uganda. All rights reserved.</span>
          <span className="text-white/45">
            Cash on delivery · MTN MoMo · Airtel Money · Visa · Mastercard
          </span>
        </div>
      </div>
    </footer>
  );
}
