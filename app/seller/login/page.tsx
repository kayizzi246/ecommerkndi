"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sellerApi, SellerApiError, type Seller } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import VerifyEmailCard from "@/app/seller/VerifyEmailCard";
import SellerAuthLayout from "@/components/seller/SellerAuthLayout";
import { stashGoogleCredential } from "@/lib/seller-google-handoff";

export default function SellerLoginPage() {
  const router = useRouter();
  const { refresh, setSession } = useSellerSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /**
   * The forgot-password step, shown in place of the form rather than on its own
   * route.
   *
   * A seller who cannot get in is already having a bad minute; sending them to
   * a second page to type the address they have just typed here is one more
   * thing to go wrong. `sentTo` is the address the link went to, and its
   * presence is what switches this screen into the "check your email" state.
   */
  const [forgotOpen, setForgotOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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

  /**
   * Finish signing in.
   *
   * Takes the seller from the response that just authenticated them, rather
   * than fetching it again. Both routes into here — the password form and the
   * Google button — are handed the full record by the call that establishes the
   * session, and this used to discard it and `await refresh()`, which asks
   * WordPress for the same seller a second time.
   *
   * That round trip was pure waiting, and it landed at the worst moment: the
   * "Signing you in…" overlay covers the screen for the whole of it, on a
   * shared host where a single call runs 0.8–1.8s, stacked behind Google's
   * token check and the sign-in call itself. Seeding the session directly
   * removes a full request from the slowest interaction in the Seller Centre.
   *
   * `refresh` stays the fallback for the case that should not happen: a
   * successful sign-in whose payload carried no seller. Better one wasted
   * request than a signed-in seller the shell thinks is a stranger.
   */
  const done = async (seller?: Seller | null) => {
    if (seller) {
      setSession(seller);
    } else {
      await refresh();
    }
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
        seller?: Seller;
      };

      if (response.ok) {
        // `/api/seller/google` returns the seller alongside the cookie it sets,
        // so the session can be seeded from here without a second call.
        await done(payload.seller);
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
      // `login` resolves with the seller it just authenticated, so the session
      // is seeded from it rather than re-read.
      const { seller } = await sellerApi.login(email, password);
      await done(seller);
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

  /**
   * Emails a reset link.
   *
   * The reply is the same whether or not that address has a seller account —
   * WordPress decides, and deliberately does not say — so this screen always
   * moves to "check your email". Anything else would let somebody find out
   * which addresses sell here by watching which ones produce a different
   * answer.
   */
  const sendResetLink = async () => {
    if (!email.trim()) {
      setError("Enter the email address on your seller account first.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      await fetch("/api/seller/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSentTo(email.trim());
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  if (forgotOpen) {
    return (
      <SellerAuthLayout eyebrow="Seller Centre">
        {sentTo ? (
          <>
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-shop-ink">
              Check your email
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-shop-muted">
              If <span className="font-semibold text-shop-ink">{sentTo}</span> has a seller account,
              a link to set a new password is on its way. It works once and stops working after a
              day.
            </p>
            <p className="mt-4 text-[14px] text-shop-muted">
              Nothing after a few minutes? Look in your spam folder, then try again — and check the
              address above is the one you registered with.
            </p>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setForgotOpen(false);
              }}
              className="btn-shop mt-7 w-full py-3.5 text-[15px]"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-shop-ink">
              Reset your password
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-shop-muted">
              Tell us the address on your seller account and we will email you a link to set a new
              password.
            </p>

            <div className="mt-6">
              <Field label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-shop"
                />
              </Field>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={sendResetLink}
              disabled={sending}
              className="btn-shop mt-5 w-full py-3.5 text-[15px]"
            >
              {sending ? "Sending…" : "Email me a link"}
            </button>

            <button
              type="button"
              onClick={() => {
                setForgotOpen(false);
                setError(null);
              }}
              className="mt-4 w-full text-[14px] font-semibold text-shop-muted hover:text-shop-ink"
            >
              Back to sign in
            </button>
          </>
        )}
      </SellerAuthLayout>
    );
  }

  if (unverified) {
    return (
      <SellerAuthLayout eyebrow="Seller Centre">
        <div className="mt-2">
          <VerifyEmailCard
            email={unverified}
            onVerified={done}
            onCancel={() => setUnverified(null)}
          />
        </div>
      </SellerAuthLayout>
    );
  }

  /* ---- This page has been moved onto the shop's own brand ----

     It was built from a `bfl-*` token set left over from an older skin: a
     yellow bag lockup reading "Kandi For Less", a yellow submit button, square
     borders, `#333` labels. Nothing else in the Seller Centre uses those
     tokens, and the sign-up page one click away used the shop's orange —
     so the two doors into the same product wore two different brands, and the
     link at the foot of each led straight to the other one.

     Everything below is `shop-*` now, and the frame is shared with sign-up
     through {@link SellerAuthLayout}, so they cannot come apart again. */
  return (
    <SellerAuthLayout eyebrow="Seller Centre">
      <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-tight text-shop-ink">
        Welcome back
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-shop-body">
        Manage your listings, orders and payouts.
      </p>

      {/* Google first: most sellers registered with a Gmail address, and one
          tap beats remembering a password chosen months ago. It only signs
          in existing sellers — stores are reviewed before they can trade,
          so there is no sign-up path here. */}
      <div className="mt-8 flex justify-center [&>div]:w-full">
        <GoogleSignInButton
          onCredential={signInWithGoogle}
          onError={(message) => setError(message)}
          text="continue_with"
        />
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-shop-muted">
        <span className="h-px flex-1 bg-shop-line" />
        or with your password
        <span className="h-px flex-1 bg-shop-line" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-shop"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-shop"
          />
          {/* `type="button"`, or it submits the sign-in form it sits inside —
              which would try to sign in with a blank password and answer the
              seller with "those credentials do not match" at the exact moment
              they are telling us they do not have them. */}
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="mt-2 text-[13px] font-semibold text-shop-primary hover:underline"
          >
            Forgot your password?
          </button>
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-shop w-full py-3 text-[15px]">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 border-t border-shop-line pt-6 text-[14px] text-shop-muted">
        New to Kandi?{" "}
        <Link href="/seller/register" className="font-semibold text-shop-primary hover:underline">
          Open a seller account
        </Link>
      </p>
    </SellerAuthLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-shop-ink">{label}</span>
      {children}
    </label>
  );
}
