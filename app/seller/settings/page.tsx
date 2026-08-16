"use client";

import { useState } from "react";
import { sellerApi, type Seller } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";
import { formatPrice } from "@/lib/currency";

const INPUT =
  "w-full border border-bfl-line px-3 py-2.5 text-[15px] focus:border-black focus:outline-none";

const PAYOUT_METHODS = ["MTN Mobile Money", "Airtel Money", "Bank transfer"];

export default function SellerSettingsPage() {
  const { seller, refresh } = useSellerSession();

  // The form seeds its fields from the seller record, so it only mounts once
  // the session has resolved — no effect is needed to copy values in.
  if (!seller) return null;

  return <SettingsForm seller={seller} onSaved={refresh} />;
}

function SettingsForm({ seller, onSaved }: { seller: Seller; onSaved: () => Promise<void> }) {
  const [storeName, setStoreName] = useState(seller.store_name);
  const [ownerName, setOwnerName] = useState(seller.owner_name);
  const [phone, setPhone] = useState(seller.phone);
  const [logo, setLogo] = useState(seller.logo ?? "");
  const [payoutMethod, setPayoutMethod] = useState(seller.payout_method || PAYOUT_METHODS[0]);
  const [payoutAccount, setPayoutAccount] = useState(seller.payout_account ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Where the seller's identity documents stand, in words rather than a slug. */
  const documentLabel =
    seller.status === "approved" || seller.kyc_status === "approved"
      ? "Approved"
      : seller.kyc_status === "submitted"
        ? "Sent — with our team"
        : seller.kyc_status === "rejected"
          ? "Please send them again"
          : "Not sent yet";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await sellerApi.updateSettings({
        store_name: storeName,
        owner_name: ownerName,
        phone,
        logo,
        payout_method: payoutMethod,
        payout_account: payoutAccount,
      });
      await onSaved();
      setNotice("Your store details have been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[820px]">
      <h1 className="text-[28px] font-extrabold leading-tight text-shop-ink">Store settings</h1>
      <p className="mt-1 text-[15px] text-shop-muted">
        How your store appears to shoppers, and where we send your money.
      </p>

      {/* The monthly fee, and the reference to quote when paying it. Shown
          until the team marks it received in wp-admin. */}
      {seller.fee_status === "unpaid" && seller.fee_amount > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-shop-primary bg-shop-primary-soft p-6">
          <h2 className="text-[18px] font-extrabold text-shop-primary">Joining fee outstanding</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-shop-body">
            Your store cannot be approved until this clears. It is charged once and never again —
            it covers verifying your business, setting up your store and payout details, and the
            first review of your listings by a person.
          </p>

          <dl className="mt-4 space-y-2.5 text-[15px]">
            <div className="flex items-baseline justify-between gap-4 border-b border-shop-primary/15 pb-2">
              <dt className="text-shop-body">Amount</dt>
              <dd className="text-[19px] font-semibold text-shop-primary">
                {formatPrice(seller.fee_amount)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-shop-body">Your reference</dt>
              <dd className="font-mono text-[16px] font-semibold tracking-wide text-shop-ink">
                {seller.fee_reference}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[14px] leading-relaxed text-shop-body">
            Quote that reference when you pay so we can match it to your store. We confirm by
            email, usually the same day. If your application is turned down, the fee is refunded
            in full.
          </p>
        </section>
      )}

      <form onSubmit={save} className="mt-6 space-y-5">
        <section className="border border-bfl-line bg-white p-5">
          <h2 className="mb-4 text-[16px] font-extrabold text-black">Store profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name">
              <input required value={storeName} onChange={(e) => setStoreName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Contact name">
              <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Phone number">
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Email address" hint="Contact support to change your sign-in email.">
              <input value={seller.email} disabled className={`${INPUT} bg-bfl-surface text-bfl-grey`} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Logo URL" hint="Square image, at least 200×200.">
                <input value={logo} onChange={(e) => setLogo(e.target.value)} className={INPUT} />
              </Field>
            </div>
          </div>
        </section>

        <section className="border border-bfl-line bg-white p-5">
          <h2 className="mb-4 text-[16px] font-extrabold text-black">Payout details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payout method">
              <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className={INPUT}>
                {PAYOUT_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </Field>
            <Field label="Account / phone number">
              <input
                value={payoutAccount}
                onChange={(e) => setPayoutAccount(e.target.value)}
                placeholder="07XX XXX XXX"
                className={INPUT}
              />
            </Field>
          </div>
        </section>

        <section className="border border-bfl-line bg-white p-5">
          <h2 className="mb-4 text-[16px] font-extrabold text-black">Marketplace terms</h2>
          <dl className="space-y-2.5 text-[14px]">
            <Row label="Commission rate" value={`${seller.commission_rate}% per completed order`} />
            <Row label="Account status" value={seller.status} />
            {/* What the shop has and has not confirmed about this seller. An
                approved store implies both — nobody is approved without them —
                so an approved account reads as verified even if it predates the
                fields being recorded. */}
            <Row
              label="Email address"
              value={
                seller.status === "approved" || seller.email_verified
                  ? "Confirmed"
                  : "Waiting for the code"
              }
            />
            <Row label="Verification documents" value={documentLabel} />
            <Row
              label="Selling since"
              value={new Date(seller.registered_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
            <Row label="Store URL" value={`/sellers/${seller.store_slug}`} />
          </dl>
          <p className="mt-3 text-[13px] text-bfl-grey">
            Your commission rate is set by the Kandi marketplace team. Contact support if you think
            it should change.
          </p>
        </section>

        {error && (
          <p role="alert" className="border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[14px] text-[#a51f1f]">
            {error}
          </p>
        )}
        {notice && (
          <p className="border-l-2 border-bfl-green bg-[#e7f7ea] px-3 py-2 text-[14px] text-[#0a7a2f]">
            {notice}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn-bfl px-8 py-3 text-[15px]">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-[#333]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-bfl-grey">{hint}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-bfl-line pb-2.5 last:border-0">
      <dt className="text-bfl-grey">{label}</dt>
      <dd className="font-semibold capitalize text-black">{value}</dd>
    </div>
  );
}
