"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SellerAuthLayout from "@/components/seller/SellerAuthLayout";

/**
 * Where an emailed seller reset link lands.
 *
 * The key and the login arrive in the query string, exactly as WordPress's own
 * reset flow passes them, and neither is shown or edited — they are proof, not
 * input. All this screen collects is the new password.
 */
function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();

  const key = params.get("key") ?? "";
  const login = params.get("login") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* A link that arrived without its two halves cannot be repaired here, and a
     form that collects a password it can never submit is worse than a message
     saying so. */
  if (!key || !login) {
    return (
      <SellerAuthLayout eyebrow="Seller Centre">
        <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-shop-ink">
          That link is incomplete
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-shop-muted">
          Reset links expire after a day and can only be used once. Ask for a new one and it will
          arrive within a minute.
        </p>
        <Link href="/seller/login" className="btn-shop mt-6 inline-flex px-8 py-3.5 text-[15px]">
          Back to sign in
        </Link>
      </SellerAuthLayout>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here as well as on the server. This one is purely a courtesy —
    // catching a mistyped confirmation before a round trip — and the server
    // still decides whether the password itself is acceptable.
    if (password !== confirm) {
      setError("Those two passwords are not the same.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/seller/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, login, password }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "That reset link has expired. Please request a new one.");
        return;
      }

      // Signed in already — the reset route set the session cookie — so this
      // goes to the dashboard rather than back to a sign-in form.
      router.replace("/seller");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SellerAuthLayout eyebrow="Seller Centre">
      <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-tight text-shop-ink">
        Choose a new password
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-shop-muted">
        Setting this signs you out everywhere else, so anybody still holding your old password
        loses access.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-shop-ink">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field-shop"
          />
          <p className="mt-1 text-[12px] text-shop-muted">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-[13px] font-semibold text-shop-ink">
            Type it again
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="field-shop"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-shop-sale/30 bg-[#fdeeeb] px-3 py-2.5 text-[14px] text-shop-sale"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn-shop w-full py-3.5 text-[15px]">
          {saving ? "Saving…" : "Save and sign in"}
        </button>
      </form>

      <p className="mt-6 text-[14px] text-shop-muted">
        Remembered it?{" "}
        <Link href="/seller/login" className="font-semibold text-shop-primary hover:underline">
          Sign in instead
        </Link>
      </p>
    </SellerAuthLayout>
  );
}

export default function SellerResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <ResetForm />
    </Suspense>
  );
}
