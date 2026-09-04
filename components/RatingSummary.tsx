import StarRating from "@/components/StarRating";

/**
 * The ratings breakdown, in the buy box rather than at the foot of the page.
 *
 * The full summary already exists inside {@link ReviewSection} — but that sits
 * below the description, the spec tables and the related products, which means
 * a shopper deciding whether to buy has to leave the decision, scroll past
 * everything, read, and come back. Star ratings are among the strongest signals
 * on a product page and they were the furthest from the button.
 *
 * This is the compact form of the same thing, and it is deliberately not a
 * duplicate: no review text, no form, no filters. Just how many people rated it,
 * what they averaged, and how that splits — enough to answer "is this any good"
 * without leaving the price. The heading below stays the place to actually read
 * them, and the whole block links there.
 *
 * Renders nothing when nobody has reviewed yet. An empty ratings panel beside
 * the price is worse than no panel: it draws the eye to an absence and answers
 * the shopper's question with "nobody has bought this".
 */
export default function RatingSummary({
  average,
  count,
  /** Tally of ratings, index 0 = five stars, index 4 = one star. */
  breakdown,
  className = "",
}: {
  average: number;
  count: number;
  breakdown: number[];
  className?: string;
}) {
  if (count <= 0) return null;

  const total = breakdown.reduce((sum, tally) => sum + tally, 0);

  return (
    <a
      href="#reviews"
      className={`flex items-center gap-5 rounded-xl border border-shop-line bg-white p-3.5 transition-colors hover:border-shop-primary ${className}`}
    >
      <div className="shrink-0 text-center">
        <p className="price text-[30px] leading-none text-shop-ink">{average.toFixed(1)}</p>
        <div className="mt-1.5 flex justify-center">
          <StarRating rating={average} size="sm" showCount={false} />
        </div>
        <p className="mt-1 whitespace-nowrap text-[12px] text-shop-muted">
          {count} {count === 1 ? "review" : "reviews"}
        </p>
      </div>

      {/* The distribution. Thin bars rather than the full-size ones below —
          this is a glance, not a study, and it has to fit beside a price
          without pushing the button off the screen. */}
      <div className="min-w-0 flex-1 space-y-1">
        {breakdown.map((tally, index) => {
          const star = 5 - index;
          const percent = total > 0 ? (tally / total) * 100 : 0;

          return (
            <div key={star} className="flex items-center gap-2 text-[12px]">
              <span className="w-4 shrink-0 text-right text-shop-muted">{star}</span>
              <span
                aria-hidden
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-shop-hairline"
              >
                <span
                  className="block h-full rounded-full bg-shop-warning"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-5 shrink-0 tabular-nums text-shop-muted">{tally}</span>
            </div>
          );
        })}
      </div>
    </a>
  );
}
