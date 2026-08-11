import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  /* Nothing here should ever appear in a search result: the page is only
     meaningful with a single-use key attached, and an indexed copy would be a
     dead link for everyone who found it that way. */
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-4 py-14 md:px-8 md:py-20">
      <div className="rounded-2xl border border-shop-line bg-white p-6 md:p-8">
        <Suspense
          fallback={<p className="text-center text-[15px] text-shop-muted">Loading…</p>}
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
