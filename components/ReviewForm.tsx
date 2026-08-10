"use client";

import { useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import type { ProductReview } from "@/lib/woocommerce";

type Props = {
  productId: number;
  /** The shopper's existing review, when they have already written one. */
  existing?: ProductReview | null;
  onSaved: (review: ProductReview, average: number, count: number) => void;
};

/**
 * Write-a-review form. Only a signed-in shopper sees it — everyone else gets
 * the Google button in its place, because the review is attributed to a real
 * WordPress account and posted with that account's session.
 */
export default function ReviewForm({ productId, existing, onSaved }: Props) {
  const { customer, loading, refresh } = useCustomerSession();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState(existing?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (loading) {
    return <div className="h-32 animate-skeleton rounded-xl bg-shop-hairline" />;
  }

  if (!customer) {
    return (
      <div className="rounded-xl border border-shop-line bg-white p-6 text-center">
        <p className="text-[17px] font-semibold text-shop-ink">Bought this? Tell other shoppers</p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-shop-muted">
          Sign in to rate this product. Your review is saved to your Kandi account and shown
          with your name.
        </p>
        <div className="mt-4 flex justify-center">
          <GoogleSignInButton
            endpoint="/api/auth/google"
            onSuccess={refresh}
            onError={setError}
            text="signin_with"
            width={280}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-shop-sale">
            {error}
          </p>
        )}
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (rating < 1) {
      setError("Choose a star rating first.");
      return;
    }
    if (text.trim().length < 5) {
      setError("Please write a few words about the product.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        review?: ProductReview;
        average_rating?: number;
        rating_count?: number;
      };

      if (!response.ok || !payload.review) {
        setError(payload.message ?? "Could not save your review. Please try again.");
        return;
      }

      onSaved(payload.review, payload.average_rating ?? 0, payload.rating_count ?? 0);
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-shop-line bg-white p-6">
      <p className="text-[17px] font-semibold text-shop-ink">
        {existing ? "Update your review" : "Write a review"}
      </p>
      <p className="mt-1 text-[14px] text-shop-muted">
        Posting as {customer.name}. Reviews are saved to your account and can be edited later.
      </p>

      {/* Rating */}
      <div className="mt-4 flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            aria-pressed={rating === star}
            className="p-0.5"
          >
            <svg
              className={`h-8 w-8 transition-colors ${
                star <= (hovered || rating) ? "text-star" : "text-shop-line"
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
        <span className="ml-2 text-[14px] text-shop-muted">
          {rating > 0 ? `${rating} of 5` : "Tap to rate"}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={1500}
        placeholder="How is the fit, the quality, the delivery?"
        className="field-shop mt-4 resize-y text-[15px]"
      />

      {error && (
        <p role="alert" className="mt-3 text-[14px] font-medium text-shop-sale">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="mt-3 text-[14px] font-medium text-shop-success">
          Thanks — your review is live.
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-shop mt-4 px-8 py-3 text-[15px]">
        {busy ? "Saving…" : existing ? "Update review" : "Post review"}
      </button>
    </form>
  );
}
