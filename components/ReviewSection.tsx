"use client";

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

  // Most recent first — a random shuffle would both mutate the shared array and
  // read the clock during render.
  const reviews = [...MOCK_REVIEWS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  return (
    <section id="reviews" className="mt-14 max-w-4xl border-t border-bfl-line pt-8">
      <h2 className="mb-6 text-[20px] font-normal text-black">Customer reviews</h2>

      {/* Rating summary */}
      <div className="mb-8 flex flex-wrap items-start gap-8 border border-bfl-line bg-bfl-surface p-5">
        <div className="text-center">
          <p className="text-[40px] font-bold leading-none text-black">
            {averageRating.toFixed(1)}
          </p>
          <div className="mt-2">
            <StarRating rating={averageRating} size="md" showCount={false} />
          </div>
          <p className="mt-1 text-[13px] text-bfl-grey">{totalReviews} reviews</p>
        </div>
        <div className="min-w-[200px] flex-1 space-y-1.5">
          {RATING_BREAKDOWN.map((count, i) => {
            const star = 5 - i;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-[13px]">
                <span className="w-12 shrink-0 text-right text-bfl-grey">{star} star</span>
                <div className="h-2.5 flex-1 overflow-hidden bg-[#e4e4e4]">
                  <div className="h-full bg-bfl-yellow" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 shrink-0 text-[12px] text-bfl-grey">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-bfl-line pb-6 last:border-0">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bfl-surface text-[12px] font-bold text-bfl-ink">
                {review.author.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-black">{review.author}</p>
                  {review.verified && (
                    <span className="rounded bg-[#e7f7ea] px-1.5 py-0.5 text-[10px] font-bold text-[#0a7a2f]">
                      Verified purchase
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} size="sm" showCount={false} />
                  <span className="text-[11px] text-bfl-grey">
                    {new Date(review.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <p className="ml-11 text-[13px] leading-relaxed text-[#444]">{review.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          className="border border-bfl-line px-8 py-2.5 text-[13px] font-bold text-[#333] transition-colors hover:border-black"
        >
          Write a review
        </button>
      </div>
    </section>
  );
}

