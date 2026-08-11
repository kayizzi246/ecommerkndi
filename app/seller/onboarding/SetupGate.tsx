"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sellerApi } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";
import { formatPrice } from "@/lib/currency";
import FeePayment from "@/components/seller/FeePayment";

const MAX_MB = 8;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/**
 * What a new seller must finish before the Seller Centre opens.
 *
 * Two gates, in order:
 *
 *   1. Verification — a photo of their national ID, and whether the business is
 *      formally registered. A marketplace that takes payment on a stranger's
 *      behalf has to know who the stranger is; it is also what makes a fraud
 *      complaint answerable rather than a shrug.
 *   2. The joining fee — paid here, not "some time later". A store that can
 *      reach the dashboard without paying will list products, take orders and
 *      then be chased for the fee, which is a worse conversation than this one.
 *
 * The gate is enforced in SellerShell, not here: this screen is what the seller
 * is *sent to*, and it cannot be skipped by typing a different URL.
 */
export default function SetupGate({
  registrationFee,
  payNumber,
  payName,
}: {
  registrationFee: number;
  payNumber: string;
  payName: string;
}) {
  const router = useRouter();
  const { seller, refresh, signOut } = useSellerSession();

  const [registered, setRegistered] = useState<"yes" | "no" | "">("");
  const [businessName, setBusinessName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [businessDocument, setBusinessDocument] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!seller) return null;

  const needsKyc = seller.kyc_status === "missing" || seller.kyc_status === "rejected";

  /**
   * The seller's *own* recorded fee, not the shop's current one.
   *
   * SellerShell decides whether to send someone here using the same figure, and
   * the two disagreeing is how a seller ends up bounced between a gate that
   * wants payment and a shell that thinks they are done. A store recorded at
   * zero — signed up while the shop charged nothing — owes nothing now.
   */
  const feeAmount = seller.fee_amount || 0;
  const feeDue = feeAmount > 0 && seller.fee_status === "unpaid";

  // Nothing outstanding. Nobody is sent here in that state, but a seller who
  // follows an old link or presses the checklist button at the wrong moment
  // lands on a page that tells them where they stand rather than flickering
  // back to the dashboard.
  if (!needsKyc && !feeDue) {
    return (
      <Shell title="Your setup is complete" step={null}>
        <p className="text-[15px] leading-relaxed text-shop-body">
          {seller.kyc_status === "approved"
            ? "Your documents have been checked and your store is verified."
            : "Your documents are with our team. We will email you the moment they are checked — usually the same working day."}
          {feeAmount > 0 ? " The joining fee is paid." : ""}
        </p>
        <button
          type="button"
          onClick={() => router.replace("/seller")}
          className="btn-shop mt-6 w-full py-3 text-[15px]"
        >
          Go to my dashboard
        </button>
      </Shell>
    );
  }

  const submitKyc = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (registered !== "yes" && registered !== "no") {
      setError("Tell us whether the business is registered.");
      return;
    }
    if (!idDocument) {
      setError("Upload a photo of your national ID.");
      return;
    }
    if (registered === "yes" && businessNumber.trim().length < 3) {
      setError("Enter the certificate or TIN number the business is registered under.");
      return;
    }

    setSubmitting(true);
    try {
      await sellerApi.submitKyc({
        business_registered: registered,
        business_name: businessName.trim(),
        business_number: businessNumber.trim(),
        id_document: idDocument,
        business_document: businessDocument,
      });
      // Pulls the updated seller, which flips this screen to the fee step.
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your documents.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- step 1 */
  if (needsKyc) {
    return (
      <Shell title="Verify your business" step={feeDue ? "Step 1 of 2" : "Step 1 of 1"}>
        <p className="text-[15px] leading-relaxed text-shop-body">
          Every store on Kandi is checked before it can trade. This is between you and our team
          — none of it appears on your store page.
        </p>

        {seller.kyc_status === "rejected" && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
          >
            We could not read the documents you sent last time. Please upload them again — a
            clear, well-lit photo of the whole card works best.
          </p>
        )}

        <form onSubmit={submitKyc} className="mt-6 space-y-6">
          <FileField
            label="Your national ID"
            hint="A photo or scan of the front. JPEG, PNG or PDF, up to 8 MB."
            file={idDocument}
            onPick={setIdDocument}
          />

          <fieldset>
            <legend className="text-[14px] font-semibold text-shop-ink">
              Is the business formally registered?
            </legend>
            <p className="mt-1 text-[13.5px] text-shop-muted">
              Registered with URSB, or holding a trading licence or TIN.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {(["yes", "no"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRegistered(value);
                    setError(null);
                  }}
                  aria-pressed={registered === value}
                  className={`rounded-xl border px-4 py-3 text-left text-[15px] font-semibold transition-colors ${
                    registered === value
                      ? "border-shop-primary bg-shop-primary-soft text-shop-primary"
                      : "border-shop-line bg-white text-shop-ink hover:border-shop-primary"
                  }`}
                >
                  {value === "yes" ? "Yes, it is registered" : "No, not yet"}
                  <span className="mt-0.5 block text-[13px] font-normal text-shop-muted">
                    {value === "yes"
                      ? "We will ask for the number"
                      : "You can still sell — many of our stores start here"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {registered === "yes" && (
            <div className="space-y-5 rounded-xl border border-shop-line bg-white p-4">
              <Field label="Registered business name" hint="As it appears on the certificate.">
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="field-shop text-[16px]"
                />
              </Field>
              <Field label="Certificate or TIN number">
                <input
                  value={businessNumber}
                  onChange={(event) => setBusinessNumber(event.target.value)}
                  className="field-shop text-[16px]"
                />
              </Field>
              <FileField
                label="Certificate or licence"
                hint="Optional, but it gets you approved faster."
                file={businessDocument}
                onPick={setBusinessDocument}
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-shop w-full py-3.5 text-[16px]">
            {submitting ? "Sending…" : "Send for verification"}
          </button>
        </form>
      </Shell>
    );
  }

  /* ---------------------------------------------------------------- step 2 */
  return (
    <Shell title="Pay the joining fee" step="Step 2 of 2">
      <p className="text-[15px] leading-relaxed text-shop-body">
        One payment of{" "}
        <strong className="text-shop-ink">
          {formatPrice(seller.fee_amount || registrationFee)}
        </strong>
        , and never again. It covers your store setup and the checks we run on every seller — it
        is what keeps counterfeit traders off the shop.
      </p>
      <p className="mt-2 text-[14px] text-shop-muted">
        Your dashboard opens as soon as the payment clears.
      </p>

      <FeePayment
        seller={seller}
        registrationFee={registrationFee}
        payNumber={payNumber}
        payName={payName}
      />

      <button
        type="button"
        onClick={refresh}
        className="btn-shop-outline mt-4 w-full py-3 text-[15px]"
      >
        I have paid — check again
      </button>

      <button
        type="button"
        onClick={signOut}
        className="mt-4 w-full text-center text-[14px] font-semibold text-shop-muted hover:text-shop-primary"
      >
        Sign out
      </button>
    </Shell>
  );
}

function Shell({
  title,
  step,
  children,
}: {
  title: string;
  step: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[620px] flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-shop-line bg-white p-6 md:p-8">
        {step && (
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-shop-primary">
            {step}
          </p>
        )}
        <h1 className="mt-1.5 text-[24px] font-extrabold leading-tight text-shop-ink md:text-[27px]">
          {title}
        </h1>
        <div className="mt-3">{children}</div>
      </div>
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
      <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-shop-muted">{hint}</span>}
    </label>
  );
}

/**
 * A file picker that shows what was chosen.
 *
 * A bare `<input type="file">` on a phone gives no feedback beyond a filename in
 * a font too small to read, and a seller who is not sure the photo attached will
 * attach it three times.
 */
function FileField({
  label,
  hint,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  const tooBig = file ? file.size > MAX_MB * 1024 * 1024 : false;

  return (
    <div>
      <span className="mb-1.5 block text-[14px] font-semibold text-shop-ink">{label}</span>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition-colors ${
          file && !tooBig
            ? "border-pop-green bg-pop-green-soft"
            : "border-shop-line bg-white hover:border-shop-primary"
        }`}
      >
        <input
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        />
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[18px] shadow-sm"
        >
          {file && !tooBig ? "✓" : "＋"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-shop-ink">
            {file ? file.name : "Choose a file"}
          </span>
          <span className="block text-[13px] text-shop-muted">
            {tooBig ? `That file is over ${MAX_MB} MB — choose a smaller one.` : hint}
          </span>
        </span>
      </label>
    </div>
  );
}
