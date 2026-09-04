"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VerifyContactModal from "@/components/VerifyContactModal";

/**
 * The check a first-time shopper meets on the way into checkout.
 *
 * ---- Why it lives on the checkout page and not on the buttons ----
 *
 * There are five ways into this shop's checkout: the cart page has two, the
 * cart drawer has one, "Buy now" on a product page pushes straight there, and
 * so does the sticky buy bar on a phone. Gating the BUTTONS means five copies
 * of the same guard, five chances for the next one added to forget it, and
 * nothing at all in front of a shopper who has `/checkout` in their history or
 * typed it in.
 *
 * The gate belongs at the destination. One mount, every route in, including the
 * ones nobody has written yet.
 *
 * ---- What it is actually worth ----
 *
 * Most of this shop's orders are cash on delivery: the shop packs the goods,
 * pays a rider and sends them across Kampala on the strength of a phone number
 * typed into a form by somebody who has paid nothing. `lib/phone.ts` checks the
 * number is shaped like a Ugandan mobile. This checks somebody is holding it.
 *
 * ---- And what it is not ----
 *
 * It is not authentication and it must not be mistaken for it. A page-level
 * gate stops a person, not a script: anything posting straight to
 * `/api/checkout` never renders this component. The server-side half of the
 * same rule lives in that route, and the two have to stay in step — this is the
 * half that makes the requirement legible to a shopper, not the half that
 * enforces it.
 */
export default function CheckoutVerifyGate({
  /** Called once with the proved contact, so the form can pre-fill from it. */
  onVerified,
  /**
   * Force the dialog open again.
   *
   * For the one case the mount-time status call cannot cover: the cookie was
   * valid when the page opened and had expired by the time the order was
   * submitted, so the checkout API answers 403 with a `verification_required`
   * code. The page raises this instead of printing an error, and the shopper is
   * one code away from finishing rather than looking at a filled-in form with
   * no way forward.
   */
  reopen = false,
}: {
  onVerified?: (contact: { channel: "sms" | "email"; value: string }) => void;
  reopen?: boolean;
}) {
  const router = useRouter();

  /* Three states, not two. "Not yet known" has to be distinct from "not
     verified" or the modal flashes up for a fraction of a second on every
     checkout a returning shopper opens — which reads as the shop having
     forgotten them. */
  const [needed, setNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;

    fetch("/api/otp/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { verified?: boolean; channel?: "sms" | "email"; contact?: string } | null) => {
        if (!live) return;

        if (data?.verified) {
          setNeeded(false);
          if (data.contact && data.channel) {
            onVerified?.({ channel: data.channel, value: data.contact });
          }
          return;
        }

        setNeeded(true);
      })
      .catch(() => {
        /* ---- A failed check does not open the gate ----

           The endpoint is unreachable, so whether this browser is verified is
           unknown — and "unknown" has to resolve the same way as "no". A gate
           that lets everybody through when its own status call fails is a gate
           that anybody can walk past by blocking one request in dev tools.

           The cost of getting this wrong in the other direction is a verified
           shopper asked to verify again during an outage, which is thirty
           seconds and one SMS. The cost of getting it wrong this way is the
           feature not existing. */
        if (live) setNeeded(true);
      });

    return () => {
      live = false;
    };
    // Deliberately once per mount. `onVerified` is a fresh closure on every
    // render of the checkout page, and depending on it would re-run this fetch
    // on every keystroke in the address form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <VerifyContactModal
      open={needed === true || reopen}
      title="Verify your number to continue"
      intro="Before your first order we send a 6-digit code, so we know the rider can reach you on the day. It takes a moment and we will not ask again."
      onVerified={(contact) => {
        setNeeded(false);
        onVerified?.(contact);
      }}
      /* Back to the basket rather than merely closing. A dismissed gate that
         leaves the shopper sitting on a checkout form they cannot submit is
         worse than no gate: they fill the whole thing in and find out at the
         end. `replace` rather than `push` so Back does not walk straight into
         the gate again. */
      onCancel={() => router.replace("/cart")}
    />
  );
}
