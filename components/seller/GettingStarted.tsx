"use client";

import Link from "next/link";
import type { Seller } from "@/lib/seller";

type Step = {
  title: string;
  copy: string;
  done: boolean;
  /** Where to go to finish it, when it is the seller's move. */
  href?: string;
  action?: string;
  /** True when nobody but Kandi can move it forward. */
  waiting?: boolean;
};

/**
 * The new seller's checklist.
 *
 * A dashboard full of empty charts tells somebody who has just signed up
 * nothing about what to do next, and "pending approval" on its own reads as
 * "wait indefinitely". This lists the whole path in order, marks off what is
 * done, and says plainly which steps are theirs and which are ours.
 *
 * It disappears once the store is approved and has something listed — at that
 * point the figures below are the useful thing on the page, and a permanent
 * checklist of completed work is clutter.
 */
export default function GettingStarted({
  seller,
  productsLive,
  registrationFee,
}: {
  seller: Seller;
  productsLive: number;
  /** Falls back to the seller's own recorded fee when the shop's is unknown. */
  registrationFee?: number;
}) {
  const approved = seller.status === "approved";

  /**
   * An approved store has, by definition, already cleared everything before it:
   * the team only approves after reading the documents, and the documents only
   * arrive from a signed-in seller.
   *
   * Deriving the earlier steps from the final one rather than reading each flag
   * separately is what stops the nonsense this replaced — a store showing
   * "approved ✓" above "confirm your email ✗", which happened whenever an older
   * backend left those fields out of the payload and the checklist read the
   * absence as failure.
   */
  const feeAmount = seller.fee_amount || registrationFee || 0;
  const feeSettled = approved || seller.fee_status !== "unpaid" || feeAmount === 0;
  const emailConfirmed = approved || seller.email_verified;
  const documentsSent =
    approved || seller.kyc_status === "submitted" || seller.kyc_status === "approved";

  const steps: Step[] = [
    {
      title: "Confirm your email address",
      copy: "The six-digit code we sent when you signed up.",
      done: emailConfirmed,
      href: "/seller/onboarding",
      action: "Enter the code",
    },
    {
      title: "Send your verification documents",
      copy: "A photo of your national ID, and whether the business is registered.",
      done: documentsSent,
      href: "/seller/onboarding",
      action: "Upload documents",
    },
    ...(feeAmount > 0
      ? [
          {
            title: "Pay the one-off joining fee",
            copy: "Covers your store setup and the checks we run on every seller.",
            done: feeSettled,
            href: "/seller/onboarding",
            action: "Pay now",
          },
        ]
      : []),
    {
      title: "We approve your store",
      copy: "Our team checks your documents. Usually the same working day.",
      done: approved,
      waiting: true,
    },
    {
      title: "Add your first product",
      copy: "Your own photographs, a clear price and honest stock numbers.",
      done: productsLive > 0,
      href: "/seller/products/new",
      action: "Add a product",
    },
  ];

  // Gone the moment the store is approved and has something listed. An approved
  // seller does not need to be shown the road they already walked.
  if (approved && productsLive > 0) return null;
  if (steps.every((step) => step.done)) return null;

  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);

  return (
    <section className="mb-6 rounded-2xl border border-shop-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold text-shop-ink">Getting your store trading</h2>
          <p className="mt-0.5 text-[14px] text-shop-muted">
            {doneCount} of {steps.length} done
            {next && !next.waiting ? ` · next: ${next.title.toLowerCase()}` : ""}
            {next?.waiting ? " · nothing needed from you right now" : ""}
          </p>
        </div>
        <Link href="/seller/guide" className="text-[14px] font-semibold text-shop-primary hover:underline">
          How selling works ›
        </Link>
      </div>

      {/* Progress. Steps rather than a percentage — a seller counts jobs. */}
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {steps.map((step, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${step.done ? "bg-pop-green" : "bg-shop-hairline"}`}
          />
        ))}
      </div>

      <ol className="mt-5 space-y-3.5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3.5">
            <span
              aria-hidden
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                step.done
                  ? "bg-pop-green text-white"
                  : step.waiting
                    ? "bg-pop-orange-soft text-pop-orange"
                    : "bg-shop-primary text-white"
              }`}
            >
              {step.done ? "✓" : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={`text-[15px] font-semibold ${
                  step.done ? "text-shop-muted line-through" : "text-shop-ink"
                }`}
              >
                {step.title}
              </p>
              {!step.done && (
                <p className="mt-0.5 text-[13.5px] leading-[1.5] text-shop-muted">{step.copy}</p>
              )}
            </div>

            {!step.done && step.href && step.action && (
              <Link
                href={step.href}
                className="shrink-0 rounded-lg bg-shop-ink px-3.5 py-2 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                {step.action}
              </Link>
            )}
            {!step.done && step.waiting && (
              <span className="shrink-0 rounded-lg bg-pop-orange-soft px-3 py-2 text-[13px] font-semibold text-pop-orange">
                With us
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
