"use client";

import { useMemo } from "react";
import StarRating from "@/components/StarRating";

type Review = {
  id: number;
  author: string;
  rating: number;
  date: string;
  text: string;
  avatar?: string;
  verified?: boolean;
};

const MOCK_REVIEWS: Review[] = [
  { id: 1, author: "Sarah K.", rating: 5, date: "2024-12-15", text: "Absolutely love them! True to size and very comfortable. Fast delivery too!", verified: true },
  { id: 2, author: "John M.", rating: 4, date: "2024-11-28", text: "Good quality for the price. Would recommend.", verified: true },
  { id: 3, author: "Grace A.", rating: 5, date: "2024-11-10", text: "My second pair from this brand. They last really well.", verified: true },
  { id: 4, author: "Peter O.", rating: 3, date: "2024-10-22", text: "Nice design but sizing runs a bit small. Order one size up.", verified: false },
  { id: 5, author: "Faith N.", rating: 5, date: "2024-10-05", text: "Fast shipping and exactly as described. Will order again!", verified: true },
  { id: 6, author: "Daniel W.", rating: 4, date: "2024-09-18", text: "Great value for money. The materials feel premium.", verified: true },
];

const RATING_BREAKDOWN = [82, 12, 3, 2, 1];

type Props = {
  totalReviews?: number;
  averageRating?: number;
};

export default function ReviewSection({
  totalReviews = MOCK_REVIEWS.length,
  averageRating = 4.5,
}: Props) {
  const total = RATING_BREAKDOWN.reduce((a, b) => a + b, 0);

  const reviews = useMemo(() => {
    return MOCK_REVIEWS.sort(() => Math.random() - 0.5).slice(0, 4);
  }, []);

  return (
    <section id="reviews" className="mt-12 max-w-4xl">
      <h2 className="text-lg font-bold mb-6">Customer Reviews</h2>

      {/* Rating Summary */}
      <div className="flex flex-wrap gap-8 items-start p-5 bg-gray-50 rounded-xl mb-8">
        <div className="text-center">
          <p className="text-4xl font-bold text-market">{averageRating.toFixed(1)}</p>
          <StarRating rating={averageRating} size="md" showCount={false} />
          <p className="text-sm text-gray-500 mt-1">{totalReviews} reviews</p>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1.5">
          {RATING_BREAKDOWN.map((count, i) => {
            const star = 5 - i;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-right text-gray-600 shrink-0">
                  {star} stars
                </span>
                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-star rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-gray-400 shrink-0">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                {review.author.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{review.author}</p>
                  {review.verified && (
                    <span className="text-[10px] bg-fresh/10 text-fresh px-1.5 py-0.5 rounded font-medium">
                      Verified purchase
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} size="sm" showCount={false} />
                  <span className="text-[11px] text-gray-400">
                    {new Date(review.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed ml-11">
              {review.text}
            </p>
          </div>
        ))}
      </div>

      {/* Write a review button */}
      <div className="mt-8 text-center">
        <button
          type="button"
          className="border border-gray-300 hover:border-market text-sm font-medium px-8 py-2.5 rounded-lg transition-colors"
        >
          Write a review
        </button>
      </div>
    </section>
  );
}

