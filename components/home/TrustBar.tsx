/**
 * Four promises, at the foot of the page.
 *
 * Placed last on purpose. Reassurance answers an objection, and an objection is
 * something a shopper only has once they are considering buying — putting this
 * above the products spends the first screen on a promise nobody has asked for
 * yet.
 *
 * Four items, not five or six: each one added dilutes the rest, and these are
 * the four that come up in Ugandan ecommerce specifically — is it real, is my
 * money safe, do I have to pay before I see it, and what if it is wrong.
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
      aria-label="Why shop with KandiUg"
      className="rounded-2xl border border-shop-line bg-white px-4 py-6 md:px-8"
    >
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        {promises.map((promise) => (
          <li key={promise.title} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shop-primary-soft">
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
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-shop-ink">{promise.title}</p>
              <p className="truncate text-[12.5px] text-shop-muted">{promise.copy}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
