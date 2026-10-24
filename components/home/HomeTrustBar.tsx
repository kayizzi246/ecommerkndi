import Link from "next/link";
import { formatPrice } from "@/lib/currency";

/**
 * The green promise bar under the banner, the way Temu runs "Free shipping"
 * and "Price adjustment" across the top of its home page. Every line is a
 * policy the shop actually has; the figures come from wp-admin.
 */
export default function HomeTrustBar({
  freeDeliveryFrom,
  returnsDays,
}: {
  freeDeliveryFrom: number;
  returnsDays: number;
}) {
  const items = [
    {
      title: freeDeliveryFrom > 0 ? "Free delivery" : "Fast delivery",
      note: freeDeliveryFrom > 0 ? `On orders over ${formatPrice(freeDeliveryFrom)}` : "1–3 business days",
      href: "/shipping",
      icon: "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 18a1.6 1.6 0 1 0 0-.01M17 18a1.6 1.6 0 1 0 0-.01",
    },
    {
      title: "Pay on delivery",
      note: "Cash within 40 km of Kampala",
      href: "/help",
      icon: "M3 7h18v10H3V7Zm9 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
    },
    {
      title: `${returnsDays}-day returns`,
      note: "Not happy? Send it back",
      href: "/returns",
      icon: "M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3",
    },
    {
      title: "Secure payment",
      note: "MTN, Airtel Money & cards",
      href: "/help",
      icon: "M12 3 4.5 6v5.25c0 4.6 3.2 8.6 7.5 9.75 4.3-1.15 7.5-5.15 7.5-9.75V6L12 3Zm-3 9 2.25 2.25L15.75 9.75",
    },
  ];

  return (
    <ul className="hx-trust" aria-label="Why shop with us">
      {items.map((item) => (
        <li key={item.title}>
          <Link href={item.href} className="hx-trust-item">
            <svg aria-hidden className="hx-trust-icon" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <span className="min-w-0">
              <strong>{item.title}</strong>
              <span>{item.note}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
