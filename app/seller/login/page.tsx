"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sellerApi, SellerApiError } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import VerifyEmailCard from "@/app/seller/VerifyEmailCard";
import { stashGoogleCredential } from "@/lib/seller-google-handoff";

export default function SellerLoginPage() {
  const router = useRouter();
  const { refresh } = useSellerSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /**
   * Set when WordPress answers "right password, unconfirmed address". It has
   * already emailed a fresh code by then, so the sensible next screen is the
   * code box — not an error telling somebody to go and find an old email.
   */
  const [unverified, setUnverified] = useState<string | null>(null);

  /**
   * Arriving at the sign-in screen ends whatever session the browser was
   * carrying — the same rule as the sign-up flow, and for the same reason.
   *
   * Anyone on this page is here to become somebody. Until they do, they are
   * nobody: the previous occupant's fortnight-long cookie must not still be
   * answering for them if they wander back into /seller without signing in.
   */
  useEffect(() => {
    sellerApi
      .endSession()
      .then(() => refresh())
      .catch(() => undefined);
  }, [refresh]);

  const done = async () => {
    await refresh();
    // Always /seller. The shell decides from there whether this seller sees
    // their dashboard or the setup gate — one place makes that call, so the two
    // sign-in routes cannot disagree about it.
    router.push("/seller");
  };

  /**
   * Google sign-in, posted from here rather than by the button, so the answer
   * can be read.
   *
   * A seller who signed up but never entered their code gets `kandi_unverified`
   * back with a fresh code already sent — the useful response to which is the
   * code box, not an error message about it.
   */
  const signInWithGoogle = useCallback(async (credential: string) => {
    setError(null);
    try {
      const response = await fetch("/api/seller/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
        email?: string;
        data?: { email?: string };
      };

      if (response.ok) {
        await done();
        return;
      }

      if (payload.code === "kandi_unverified") {
        const address = payload.data?.email ?? payload.email;
        if (address) {
          setUnverified(address);
          return;
        }
      }

      // Signed in with Google, but no store on that address. That is not an
      // error — it is somebody who wants to open one. Carry the token across so
      // onboarding starts on the store details rather than asking them to press
      // the same Google button again.
      if (payload.code === "kandi_not_seller") {
        stashGoogleCredential(credential);
        router.push("/seller/register");
        return;
      }

      setError(payload.message ?? "Could not sign you in with Google.");
    } catch {
      setError("Network error during sign-in. Please try again.");
    }
    // `done` only closes over router and refresh, both stable for the life of
    // the screen; listing it here would recreate this on every render and make
    // Google's button re-initialise with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sellerApi.login(email, password);
      await done();
    } catch (caught) {
      // 403 with this message means the account exists and the password was
      // right; anything else is a genuine failure.
      if (caught instanceof SellerApiError && caught.status === 403 && caught.code === "kandi_unverified") {
        setUnverified(email);
        setSubmitting(false);
        return;
      }
      setError(caught instanceof Error ? caught.message : "Could not sign you in.");
      setSubmitting(false);
    }
  };

  if (unverified) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <VerifyEmailCard
            email={unverified}
            onVerified={done}
            onCancel={() => setUnverified(null)}
          />
        </div>
      </div>
    );
  }

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

          {/* Google first: most sellers registered with a Gmail address, and one
              tap beats remembering a password chosen months ago. It only signs
              in existing sellers — stores are reviewed before they can trade,
              so there is no sign-up path here. */}
          <div className="mt-6 flex justify-center">
            <GoogleSignInButton
              onCredential={signInWithGoogle}
              onError={(message) => setError(message)}
              text="continue_with"
            />
          </div>

          <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-[0.08em] text-bfl-grey">
            <span className="h-px flex-1 bg-bfl-line" />
            or with your password
            <span className="h-px flex-1 bg-bfl-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
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
