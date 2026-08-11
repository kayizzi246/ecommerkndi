"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import StarRating from "@/components/StarRating";
import ReviewForm from "@/components/ReviewForm";
import { useCustomerSession } from "@/lib/customer-session";
import type { ProductReview, ProductReviews } from "@/lib/woocommerce";

const PAGE_SIZE = 6;

type Props = {
  productId: number;
  /** Fetched on the server so the reviews are in the HTML, not loaded after. */
  initial: ProductReviews;
};

/**
 * Customer reviews for one product, read from and written back to WordPress —
 * they are stored as WooCommerce review comments, so they also appear in
 * wp-admin under Products > Reviews and feed the product's average rating.
 *
 * The summary, the star breakdown and the list all come from that same data;
 * nothing here is illustrative.
 */
export default function ReviewSection({ productId, initial }: Props) {
  const { customer } = useCustomerSession();
  const [reviews, setReviews] = useState<ProductReview[]>(initial.reviews);
  const [average, setAverage] = useState(initial.average_rating);
  const [count, setCount] = useState(initial.rating_count);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Counted from the reviews on hand rather than the server's snapshot, so the
  // bars move the moment a shopper posts.
  const breakdown = useMemo(() => {
    const tally = [0, 0, 0, 0, 0]; // index 0 = 5 stars
    for (const review of reviews) {
      const index = 5 - review.rating;
      if (index >= 0 && index < 5) tally[index] += 1;
    }
    return tally;
  }, [reviews]);

  const total = breakdown.reduce((a, b) => a + b, 0);
  const mine = customer
    ? (reviews.find((review) => review.author === customer.name) ?? null)
    : null;

  const onSaved = (review: ProductReview, nextAverage: number, nextCount: number) => {
    setReviews((current) => [review, ...current.filter((entry) => entry.id !== review.id)]);
    setAverage(nextAverage);
    setCount(nextCount);
  };

  return (
    <section id="reviews" className="mt-14 border-t border-shop-line pt-8">
      <h2 className="mb-6 text-[20px] font-extrabold uppercase tracking-tight text-shop-ink">
        Customer reviews
      </h2>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {/* Rating summary */}
          {count > 0 ? (
            <div className="mb-8 flex flex-wrap items-start gap-8 rounded-xl border border-shop-line bg-white p-5">
              <div className="text-center">
                <p className="text-[44px] font-semibold leading-none text-shop-ink">
                  {average.toFixed(1)}
                </p>
                <div className="mt-2">
                  <StarRating rating={average} size="md" showCount={false} />
                </div>
                <p className="mt-1 text-[14px] text-shop-muted">
                  {count} {count === 1 ? "review" : "reviews"}
                </p>
              </div>
              <div className="min-w-[220px] flex-1 space-y-1.5">
                {breakdown.map((tally, i) => {
                  const star = 5 - i;
                  const pct = total > 0 ? (tally / total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-[14px]">
                      <span className="w-14 shrink-0 text-right text-shop-muted">
                        {star} star
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-shop-hairline">
                        <div
                          className="h-full rounded-full bg-shop-flame"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-[13px] text-shop-muted">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mb-8 rounded-xl border border-dashed border-shop-line bg-white p-6 text-center text-[15px] text-shop-muted">
              No reviews yet — be the first to rate this product.
            </p>
          )}

          {/* Review list */}
          <div className="space-y-6">
            {reviews.slice(0, visible).map((review) => (
              <article
                key={review.id}
                className="border-b border-shop-hairline pb-6 last:border-0"
              >
                <div className="mb-2 flex items-center gap-3">
                  {review.avatar ? (
                    // `unoptimized`: a reviewer's photo is hosted by whichever
                    // identity provider they signed in with, and an avatar the
                    // optimiser refuses to fetch throws — which took down the
                    // whole product page rather than dropping one picture. At
                    // 36px there is nothing for the optimiser to save anyway.
                    <Image
                      src={review.avatar}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shop-hairline text-[14px] font-semibold text-shop-ink">
                      {review.author.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-shop-ink">{review.author}</p>
                      {review.verified && (
                        <span className="rounded bg-shop-successbg px-1.5 py-0.5 text-[11px] font-semibold text-shop-success">
                          Verified purchase
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} size="sm" showCount={false} />
                      <span className="text-[12px] text-shop-muted">
                        {formatDate(review.date)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="ml-12 whitespace-pre-line text-[15px] leading-relaxed text-shop-body">
                  {review.text}
                </p>
              </article>
            ))}
          </div>

          {reviews.length > visible && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
                className="btn-shop-outline px-8 py-2.5 text-[14px]"
              >
                Show more reviews
              </button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <ReviewForm productId={productId} existing={mine} onSaved={onSaved} />
        </div>
      </div>
    </section>
  );
}

/** Empty or unparseable dates render as nothing rather than "Invalid Date". */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
