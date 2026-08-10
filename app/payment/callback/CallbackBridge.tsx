"use client";

import { useEffect } from "react";

export type PaymentResult = {
  paid: boolean;
  cancelled: boolean;
  message: string;
  orderId?: number | null;
};

/**
 * Tells the page hosting the payment iframe how the payment went.
 *
 * `postMessage` targets `window.location.origin` rather than `"*"`, so the
 * result can only be read by our own pages — this frame sits in a payment flow,
 * and a wildcard target would broadcast the outcome to whatever else happens to
 * be listening.
 *
 * When there is no parent — a shopper who somehow lands here directly, or a
 * browser that blocked the iframe and redirected instead — the page navigates
 * itself, so the flow still completes rather than dead-ending on a message
 * nobody receives.
 */
export default function CallbackBridge({ result }: { result: PaymentResult }) {
  useEffect(() => {
    const inIframe = window.parent !== window;

    if (inIframe) {
      window.parent.postMessage({ source: "kandi-pesapal", ...result }, window.location.origin);
      return;
    }

    const timer = setTimeout(() => {
      if (result.paid && result.orderId) {
        window.location.replace(`/order-received?id=${result.orderId}`);
      } else if (result.paid) {
        window.location.replace("/seller");
      } else {
        window.location.replace("/checkout");
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [result]);

  return null;
}
