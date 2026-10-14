"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * WordPress did not answer in time (see `findProduct`).
 *
 * Deliberately not the "Product not found" screen: the product exists, the
 * shared host was just busy, and telling a shopper it was removed sends them
 * away from something they can buy. A retry usually succeeds a moment later.
 */
export default function ProductError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="mb-3 text-[27px] font-extrabold text-shop-ink">This product is taking a moment</h1>
      <p className="mb-8 text-[14px] text-shop-muted">
        We could not load it just now. It is still in the shop — please try again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn-shop px-10 py-3.5 text-[14px]">
          Try again
        </button>
        <Link href="/" className="px-6 py-3.5 text-[14px] font-semibold text-shop-body hover:text-shop-ink">
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
