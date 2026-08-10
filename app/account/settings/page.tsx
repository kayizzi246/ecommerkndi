"use client";

import Image from "next/image";
import { useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";

/**
 * Profile and delivery preferences.
 *
 * Name, email and photo come from Google and are read-only here — changing
 * them means changing the Google account. The preferences below are saved to
 * the shopper's WordPress profile.
 */
export default function AccountSettings() {
  const { customer, refresh } = useCustomerSession();
  const [size, setSize] = useState(customer?.preferences.size ?? "");
  const [city, setCity] = useState(customer?.preferences.city ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  if (!customer) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, city }),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      await refresh();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-[21px] font-extrabold leading-tight text-shop-ink">Settings</h1>
      <p className="mt-1 text-[15px] text-shop-muted">
        Your details and where we deliver.
      </p>

      {/* Profile */}
      <section className="mt-6 rounded-2xl border border-shop-line bg-white p-5">
        <h2 className="text-[19px] font-extrabold text-shop-ink">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          {customer.avatar ? (
            <Image
              src={customer.avatar}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-shop-primary-soft text-[19px] font-semibold text-shop-primary">
              {customer.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-shop-ink">{customer.name}</p>
            <p className="truncate text-[15px] text-shop-muted">{customer.email}</p>
            <p className="mt-1 text-[13px] text-shop-muted">
              Signed in with Google — manage your name and photo there.
            </p>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <form onSubmit={save} className="mt-5 rounded-2xl border border-shop-line bg-white p-5">
        <h2 className="text-[19px] font-extrabold text-shop-ink">Delivery preferences</h2>
        <p className="mt-1 text-[14px] text-shop-muted">
          These pre-fill your checkout and help us show sizes that fit.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">
              Usual size
            </span>
            <input
              value={size}
              onChange={(event) => setSize(event.target.value)}
              placeholder="e.g. M, 42"
              className="field-shop text-[15px]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">
              Delivery city
            </span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Kampala"
              className="field-shop text-[15px]"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className="btn-shop px-8 py-3 text-[15px]">
            {busy ? "Saving…" : "Save changes"}
          </button>
          {status === "saved" && (
            <span role="status" className="text-[14px] font-medium text-shop-success">
              Saved to your account.
            </span>
          )}
          {status === "error" && (
            <span role="alert" className="text-[14px] font-medium text-shop-sale">
              Could not save. Please try again.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
