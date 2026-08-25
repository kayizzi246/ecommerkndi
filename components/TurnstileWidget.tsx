"use client";

import { useEffect, useRef } from "react";

/**
 * The Cloudflare Turnstile widget, or nothing at all.
 *
 * ---- What it is for ----
 *
 * Checkout creates real WooCommerce orders from an unauthenticated POST. Rate
 * limiting caps how fast one source can do that and an idempotency key stops
 * the same attempt counting twice, but neither answers the question a bot check
 * answers: is there a person here. This is that check.
 *
 * In Cloudflare's managed mode most shoppers never see anything — it settles
 * invisibly against browser signals and only shows a puzzle when something
 * looks automated. That matters on this screen more than accuracy would: a
 * challenge in front of a genuine purchase costs a sale.
 *
 * ---- It renders nothing until the shop is configured ----
 *
 * With no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` this component returns null, the
 * script is never fetched, and the server-side check in `lib/turnstile.ts`
 * passes everything through for the matching reason. Said plainly so it is not
 * discovered later: until both that variable and `TURNSTILE_SECRET_KEY` are
 * set, there is no bot check on checkout — only the rate limiter.
 *
 * ---- Tokens are single use ----
 *
 * Cloudflare rejects the second attempt to verify the same token, which is what
 * stops a captured one being replayed into a second order. So the widget has to
 * be reset after every submit, successful or not, or the shopper's second
 * attempt fails with a token their browser has already spent. That is what
 * `resetKey` is for: changing it remounts the widget and issues a fresh token.
 */

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      appearance?: "always" | "execute" | "interaction-only";
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Loads the script once per page, however many widgets ask for it. */
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
        return;
      }

      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Cleared so a later mount can try again rather than being stuck with a
        // rejected promise for the life of the page.
        scriptPromise = null;
        reject(new Error("turnstile script failed"));
      };
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export default function TurnstileWidget({
  onToken,
  resetKey = 0,
}: {
  /**
   * Called with the token to send to the server, and with null whenever the
   * current one stops being usable — an error, or an expiry while the shopper
   * was still filling in the form.
   */
  onToken: (token: string | null) => void;
  /** Change this to issue a fresh token; see the note on single use above. */
  resetKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Held in a ref rather than a dependency so a parent that re-creates its
  // handler on every render does not tear the widget down and build it again —
  // which would issue a new token each time and reset any challenge in progress.
  //
  // Updated in an effect rather than during render: a ref write in the body runs
  // on every render pass, including ones React throws away, and React's linter
  // flags it for that reason. By the time any callback below fires — all of them
  // asynchronous, after the widget has mounted — this effect has run.
  const handler = useRef(onToken);
  useEffect(() => {
    handler.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !container.current) return;

    let widgetId: string | null = null;
    let cancelled = false;
    const element = container.current;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId = window.turnstile.render(element, {
          sitekey: siteKey,
          callback: (token) => handler.current(token),
          "error-callback": () => handler.current(null),
          "expired-callback": () => handler.current(null),
          theme: "light",
        });
      })
      .catch(() => {
        // The server side fails open when Cloudflare is unreachable, so a
        // shopper whose browser cannot load the script can still buy something.
        // Anything else would turn a third party's outage into our outage.
        if (!cancelled) handler.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey]);

  if (!siteKey) return null;

  return <div ref={container} className="mt-4" />;
}
