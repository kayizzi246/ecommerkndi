"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sellerApi } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";

export default function SellerLoginPage() {
  const router = useRouter();
  const { refresh } = useSellerSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sellerApi.login(email, password);
      await refresh();
      router.push("/seller");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign you in.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-bfl-yellow">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
              <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
            </svg>
          </span>
          <span className="font-heading text-xl font-semibold text-bfl-ink">
            Kandi<span className="text-black"> For Less</span>
          </span>
        </Link>

        <div className="border border-bfl-line bg-white p-7">
          <h1 className="text-[24px] font-extrabold text-black">Seller sign in</h1>
          <p className="mt-1 text-[14px] text-bfl-grey">
            Manage your listings, orders and payouts.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email address">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-bfl-line px-3 py-2.5 text-[15px] focus:border-black focus:outline-none"
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-bfl-line px-3 py-2.5 text-[15px] focus:border-black focus:outline-none"
              />
            </Field>

            {error && (
              <p role="alert" className="border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[14px] text-[#a51f1f]">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-bfl w-full py-3 text-[15px]">
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 border-t border-bfl-line pt-5 text-center text-[14px] text-bfl-grey">
            New to Kandi?{" "}
            <Link href="/seller/register" className="link-bfl font-semibold">
              Open a seller account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-[#333]">{label}</span>
      {children}
    </label>
  );
}
