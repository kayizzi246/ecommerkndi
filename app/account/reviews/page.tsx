"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import StarRating from "@/components/StarRating";
import { formatOrderDate, type CustomerReview } from "@/lib/account";

/** Every review this shopper has written — all of them stored in WordPress. */
export default function AccountReviews() {
  const [reviews, setReviews] = useState<CustomerReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/account/reviews");
        const payload = (await response.json().catch(() => ({}))) as {
          reviews?: CustomerReview[];
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.message ?? "Could not load your reviews.");
          setReviews([]);
          return;
        }
        setReviews(payload.reviews ?? []);
      } catch {
        if (!cancelled) {
          setError("Could not reach the store. Please try again.");
          setReviews([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-[21px] font-extrabold leading-tight text-shop-ink">My reviews</h1>
      <p className="mt-1 text-[15px] text-shop-muted">
        Your ratings are saved to your account and shown on the product pages.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-pop-red-soft p-4 text-[15px] text-pop-red">
          {error}
        </p>
      )}

      {reviews === null ? (
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-skeleton rounded-2xl bg-shop-hairline" />
          ))}
        </div>
      ) : reviews.length === 0 && !error ? (
        <div className="mt-6 rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
          <p className="text-[16px] text-shop-muted">
            You have not reviewed anything yet.
          </p>
          <Link href="/account/orders" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Review a past order
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex gap-4 rounded-2xl border border-shop-line bg-white p-5"
            >
              <Link
                href={`/products/${review.product_id}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-shop-hairline"
              >
                {review.product_image && (
                  <Image
                    src={review.product_image}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${review.product_id}`}
                  className="line-clamp-1 text-[16px] font-semibold text-shop-ink hover:underline"
                >
                  {review.product_name || `Product #${review.product_id}`}
                </Link>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StarRating rating={review.rating} size="sm" showCount={false} />
                  <span className="text-[13px] text-shop-muted">
                    {formatOrderDate(review.date)}
                  </span>
                  {!review.approved && (
                    <span className="rounded bg-shop-hairline px-1.5 py-0.5 text-[12px] font-semibold text-shop-body">
                      Awaiting moderation
                    </span>
                  )}
                </div>

                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-shop-body">
                  {review.text}
                </p>

                <Link
                  href={`/products/${review.product_id}#reviews`}
                  className="mt-2 inline-block text-[14px] font-semibold text-shop-primary hover:underline"
                >
                  Edit review
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
