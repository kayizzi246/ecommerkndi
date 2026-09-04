"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomerSession } from "@/lib/customer-session";

/**
 * Chooses a new password from the key in a reset email.
 *
 * The key and login arrive in the query string and are handed back untouched —
 * only WordPress can judge whether a key is genuine, unexpired and unused, and
 * a second opinion invented here could only disagree with it.
 *
 * A successful reset signs the shopper straight in. They have just proved they
 * control the address; asking them to type the password they chose four
 * seconds ago is friction with nothing behind it.
 */
export default function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useCustomerSession();

  const key = params.get("key") ?? "";
  const login = params.get("login") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A link that arrived without its key is not worth a form. Say so plainly
  // and offer the way back, rather than letting somebody type a password twice
  // and only then be told it could never have worked.
  if (!key || !login) {
    return (
      <div className="text-center">
        <h1 className="text-[21px] font-extrabold text-shop-ink">This link is incomplete</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-shop-muted">
          Reset links only work in full, and some email apps cut them short. Open the link
          again from the email, or ask for a new one.
        </p>
        <Link href="/account" className="btn-shop mt-6 inline-flex px-7 py-2.5 text-[15px]">
          Back to sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (password !== confirm) {
      setError("Those two passwords are not the same.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, login, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "Could not reset your password. Please try again.");
        return;
      }

      await refresh();
      router.push("/account");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-shop-line bg-white px-3.5 py-2.5 text-[15px] text-shop-ink outline-none transition-colors placeholder:text-shop-faint focus:border-shop-primary";

  return (
    <>
      <h1 className="text-center text-[21px] font-extrabold text-shop-ink">
        Choose a new password
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-relaxed text-shop-muted">
        Pick something you have not used on another site. You will be signed in straight
        afterwards.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-[13px] font-semibold text-shop-body">
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={show ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className={`${field} pr-16`}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="absolute inset-y-0 right-0 px-3 text-[13px] font-semibold text-shop-muted hover:text-shop-ink"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-[13px] font-semibold text-shop-body">
            Type it again
          </label>
          <input
            id="confirm-password"
            type={show ? "text" : "password"}
            required
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            className={field}
            placeholder="The same password"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-shop-sale/10 px-3.5 py-2.5 text-[14px] text-shop-sale">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-shop mt-1 w-full py-2.5 text-[15px]">
          {busy ? "Saving…" : "Save and sign in"}
        </button>
      </form>
    </>
  );
}
