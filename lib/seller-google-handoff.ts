/**
 * Carries a Google credential from the sign-in screen to the sign-up flow.
 *
 * Someone who presses "Continue with Google" on the sign-in page and turns out
 * to have no store should land in onboarding, not on an error telling them to
 * go and do the thing they were already trying to do. The token they just
 * obtained is handed across the navigation so they are not asked for it twice.
 *
 * sessionStorage rather than a URL parameter: an ID token is long, and putting
 * one in a query string writes it into browser history, the referrer header and
 * every server log along the way. This copy lives in one tab, dies with it, and
 * is deleted the moment it is read.
 *
 * It is not a credential in any meaningful sense while it sits here — the token
 * is only worth anything to our own server, which verifies it against Google's
 * signing keys before it creates a thing.
 */

const KEY = "kandi-seller-google-handoff";

/** Roughly how long a Google ID token stays valid, minus a safety margin. */
const MAX_AGE_MS = 45 * 60 * 1000;

type Handoff = { credential: string; at: number };

export function stashGoogleCredential(credential: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ credential, at: Date.now() } satisfies Handoff));
  } catch {
    // Storage disabled. The seller signs up the ordinary way instead.
  }
}

/** Reads and clears the handed-over credential, or null when there is none. */
export function takeGoogleCredential(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;

    const handoff = JSON.parse(raw) as Partial<Handoff>;
    if (!handoff.credential || typeof handoff.at !== "number") return null;

    // An expired token would fail verification anyway; catching it here means
    // the seller gets the Google button back rather than a rejection.
    return Date.now() - handoff.at > MAX_AGE_MS ? null : handoff.credential;
  } catch {
    return null;
  }
}
