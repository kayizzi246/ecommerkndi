"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ownerApi } from "@/lib/owner";

/**
 * Owner sign-in — one field.
 *
 * The passcode is never checked in the browser: it is posted to the route
 * handler, which asks WordPress, and only a WordPress "yes" sets the cookie.
 */
export default function OwnerLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setError("Enter your owner passcode.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await ownerApi.login(passcode.trim());
      router.replace("/admin/products");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign you in.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[420px] py-10">
      <h1 className="text-[22px] leading-tight text-shop-ink">Shop admin</h1>
      <p className="mt-2 text-[15px] text-shop-muted">
        Enter the owner passcode to add, edit and remove products. This is not a
        seller account — it reaches every product in the shop.
      </p>

      <form onSubmit={submit} className="card-shop mt-6 space-y-4 p-6">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">
            Owner passcode
          </span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="field-shop text-[15px]"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-shop w-full py-3 text-[15px]">
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-[13px] text-shop-muted">
        The passcode is the <code>KANDI_OWNER_PASSCODE</code> value set in your
        WordPress <code>wp-config.php</code>.
      </p>
    </div>
  );
}
