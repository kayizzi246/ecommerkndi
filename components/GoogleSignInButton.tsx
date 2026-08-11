"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  /**
   * Where to post the Google credential — differs for shoppers and sellers.
   * Ignored when `onCredential` is given, since nothing is posted then.
   */
  endpoint?: string;
  onSuccess?: () => void | Promise<void>;
  onError?: (message: string) => void;
  /**
   * Takes the raw credential instead of exchanging it for a session.
   *
   * Seller sign-up needs this: the account cannot be created until the seller
   * has said what their store is called, so the token is held through the
   * onboarding form and sent with it. The server verifies it again before
   * creating anything — the credential never becomes a session on its own.
   */
  onCredential?: (credential: string) => void | Promise<void>;
  text?: "signin_with" | "signup_with" | "continue_with";
  width?: number;
};

type GoogleCredentialResponse = { credential?: string };

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, string | number>
      ) => void;
      /** Stops Google reusing the last account without asking. */
      disableAutoSelect: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Renders Google's official Identity Services button. The credential it returns
 * is posted straight to our own API, which verifies it with Google before any
 * session is created — the browser is never trusted.
 */
export default function GoogleSignInButton({
  endpoint,
  onSuccess,
  onError,
  onCredential,
  text = "continue_with",
  width = 340,
}: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const fallbackId = useId();

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !containerRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        // Never sign somebody in as whoever used this browser last. Kandi
        // sellers and shoppers share machines — in an arcade or a household —
        // and silently reusing the previous account is how the wrong person
        // ends up looking at somebody else's store.
        auto_select: false,
        callback: async (response) => {
          if (!response.credential) {
            onError?.("Google did not return a sign-in token.");
            return;
          }
          setBusy(true);
          try {
            if (onCredential) {
              await onCredential(response.credential);
              return;
            }
            if (!endpoint) {
              onError?.("Sign-in is not configured.");
              return;
            }
            const result = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: response.credential }),
            });
            const payload = await result.json().catch(() => ({}));
            if (!result.ok) {
              // Whatever went wrong, the next attempt should offer the account
              // picker rather than silently retrying the same address — often
              // the failure *is* that it picked the wrong one.
              window.google?.accounts.id.disableAutoSelect();
              onError?.((payload as { message?: string }).message ?? "Sign-in failed.");
              return;
            }
            await onSuccess?.();
          } catch {
            onError?.("Network error during sign-in. Please try again.");
          } finally {
            setBusy(false);
          }
        },
        cancel_on_tap_outside: true,
      });

      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        shape: "rectangular",
        logo_alignment: "center",
        width,
      });
    };

    // Load the GIS script once per page, then render.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing && window.google) {
      render();
    } else if (existing) {
      existing.addEventListener("load", render);
    } else {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
    // Every callback is in here, so a caller passing an inline arrow re-runs
    // this and re-renders Google's button. Callers that render often should
    // pass a `useCallback`-stable handler — see the seller onboarding flow.
  }, [clientId, endpoint, onSuccess, onError, onCredential, text, width]);

  if (!clientId) {
    return (
      <p
        id={fallbackId}
        className="border border-dashed border-bfl-line px-3 py-2.5 text-center text-[13px] text-bfl-grey"
      >
        Google sign-in is not configured yet. Add{" "}
        <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to <code>.env.local</code>.
      </p>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="flex justify-center [color-scheme:light]" />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[14px] text-bfl-grey">
          Signing you in…
        </div>
      )}
    </div>
  );
}
