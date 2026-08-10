import Link from "next/link";
import type { SiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import AppStoreBadges from "@/components/AppStoreBadges";

const COLUMNS = [
  {
    title: "Customer Service",
    items: [
      { name: "Help centre", href: "/help" },
      { name: "Delivery information", href: "/shipping" },
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
      { name: "Shop by store", href: "/sellers" },
      { name: "Terms & conditions", href: "/terms" },
      { name: "Privacy policy", href: "/privacy" },
    ],
  },
  {
    title: "Sell With Us",
    items: [
      { name: "Become a seller", href: "/sell" },
      { name: "Seller centre", href: "/seller" },
      { name: "Seller policies", href: "/seller-policies" },
    ],
  },
];

/** Only the networks the shop has actually filled in are rendered. */
const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

export default function Footer({ settings }: { settings: SiteSettings }) {
  const { support, social, commerce, brand, app } = settings;

  const serviceStrip = [
    { title: "Free delivery", copy: `On orders over ${formatPrice(commerce.free_delivery_from)}`, tone: "text-pop-green-on-dark" },
    { title: "Easy returns", copy: `${commerce.returns_days} days to change your mind`, tone: "text-pop-blue-on-dark" },
    { title: "Secure payments", copy: "Cash, MTN MoMo, Airtel Money, Visa", tone: "text-pop-violet-on-dark" },
    { title: "Need help?", copy: `Call ${support.phone}`, tone: "text-pop-orange-on-dark" },
  ];

  const socialLinks = Object.entries(social).filter(([, url]) => Boolean(url));

  return (
    <footer className="mt-14 bg-shop-nav text-white/70">
      {/* Service promises */}
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-[1450px] gap-6 px-4 py-7 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
          {serviceStrip.map((item) => (
            <div key={item.title}>
              <p className={`text-[15px] font-semibold ${item.tone}`}>{item.title}</p>
              <p className="mt-1 text-[12px] text-white/55">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto grid max-w-[1450px] gap-8 px-4 py-11 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-white">
              {column.title}
            </h2>
            <ul className="space-y-2.5 text-[13px] text-white/70">
              {column.items.map((item) => (
                <li key={item.name}>
                  <Link className="hover:text-white hover:underline" href={item.href}>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div id="kandi-app">
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wide text-white">
            Talk to us
          </h2>
          <ul className="space-y-2.5 text-[13px] text-white/70">
            <li>
              <a className="hover:text-white hover:underline" href={`tel:${support.phone.replace(/\s/g, "")}`}>
                {support.phone}
              </a>
            </li>
            <li>
              <a className="hover:text-white hover:underline" href={`mailto:${support.email}`}>
                {support.email}
              </a>
            </li>
            {support.whatsapp && (
              <li>
                <a
                  className="font-semibold text-pop-green-on-dark hover:underline"
                  href={`https://wa.me/${support.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chat on WhatsApp
                </a>
              </li>
            )}
            <li className="text-white/55">{support.hours}</li>
            <li className="text-white/55">{support.address}</li>
          </ul>

          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-wide text-white">
            {app.available ? "Get the app" : "App coming soon"}
          </h2>
          <p className="mb-3 text-[14px] leading-6 text-white/55">
            {app.available
              ? "Shop faster and track every order from your phone."
              : "We are building it. Everything works in your phone's browser in the meantime."}
          </p>
          <AppStoreBadges app={app} />

          {socialLinks.length > 0 && (
            <>
              <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-wide text-white">
                Follow us
              </h2>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map(([network, url]) => (
                  <a
                    key={network}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-white hover:text-white"
                  >
                    {SOCIAL_LABELS[network] ?? network}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legal bar */}
      <div className="border-t border-white/10 bg-shop-ink">
        <div className="mx-auto flex max-w-[1450px] flex-col gap-3 px-4 py-5 text-[13px] text-white/70 md:flex-row md:items-center md:justify-between md:px-8">
          <span>
            © {new Date().getFullYear()} {brand.name} Uganda. All rights reserved.
          </span>
          <span className="text-white/55">
            Cash on delivery · MTN MoMo · Airtel Money · Visa · Mastercard
          </span>
        </div>
      </div>
    </footer>
  );
}
