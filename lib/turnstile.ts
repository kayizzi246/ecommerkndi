/**
 * Cloudflare Turnstile — the "are you a person" check on the endpoints that
 * cost the shop something when they are not.
 *
 * ---- Why Turnstile and not reCAPTCHA ----
 *
 * The shop is already behind Cloudflare, the widget is free at any volume, and
 * in its managed mode most real shoppers never see a challenge at all: it
 * settles invisibly against browser signals and only escalates to a puzzle when
 * something looks automated. On a checkout that matters more than the accuracy
 * argument — a CAPTCHA that interrupts a genuine purchase costs a sale, and a
 * shop in Kampala on a mid-range Android cannot afford to be asked to identify
 * traffic lights before paying.
 *
 * ---- Switched on by configuration, not by code ----
 *
 * With `TURNSTILE_SECRET_KEY` unset, {@link verifyTurnstile} passes everything
 * through and the widget never renders, because
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is what draws it. That is the honest way to
 * ship a defence that needs an account somewhere: the code is in place and
 * correct, and turning it on is two environment variables rather than another
 * round of development.
 *
 * The corollary, said out loud so it is not discovered later: until those
 * variables are set, checkout has rate limiting and idempotency in front of it
 * but no bot check. Set them before a launch.
 *
 * ---- Setup ----
 *
 *   1. Cloudflare dashboard ▸ Turnstile ▸ Add site, for the shop's domain.
 *   2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key (public, ships in the
 *      browser bundle — that is what it is for).
 *   3. `TURNSTILE_SECRET_KEY` = the secret key (server only, never `NEXT_PUBLIC_`).
 *   4. The CSP in `next.config.ts` already names `challenges.cloudflare.com` in
 *      `script-src`, `frame-src` and `connect-src`.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when this deployment is configured to demand a token. */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export type TurnstileResult = {
  ok: boolean;
  /** Present only on failure, and only ever logged — never shown to a shopper. */
  reason?: string;
};

/**
 * Checks one widget token with Cloudflare.
 *
 * @param token      What the widget put in the form. Missing is a failure when
 *                   the check is enabled.
 * @param remoteIp   The caller's address, which Cloudflare uses as a secondary
 *                   signal. Optional, and harmless to omit.
 *
 * A token is single-use: Cloudflare rejects the second attempt to verify the
 * same one. That is a feature here — it means a captured token cannot be
 * replayed into a second order — and it is why the checkout widget is reset
 * after every submit, successful or not.
 *
 * ---- Failing open on an outage ----
 *
 * If Cloudflare itself cannot be reached, this returns ok. That is a deliberate
 * choice about which failure hurts more: an unreachable verifier means nobody
 * in the world can buy anything, while a few minutes of unchallenged traffic
 * still meets the rate limiter and the idempotency key. A shop that cannot take
 * money because a third party is down has turned a bot defence into an outage.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };

  if (!token) return { ok: false, reason: "missing-token" };

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    /* ---- A 5xx from Cloudflare is an outage, not a verdict ----
     *
     * `response.ok` was not checked, so anything that came back with a JSON
     * body was read as an answer. Cloudflare returning a 500 with
     * `{"error":"..."}` in it therefore produced `data.success === undefined`,
     * which fell through to the reject line below and turned every checkout
     * into "we could not confirm you are a person".
     *
     * That is the exact outcome the fail-open note above exists to prevent, and
     * it arrived by the one route the `catch` cannot see: the request
     * SUCCEEDED, it just did not carry a verdict. An outage is an outage
     * whether it times out or answers 503, so both now take the same branch.
     *
     * Only a 200 carries a decision this shop will refuse a sale on. */
    if (!response.ok) {
      console.error(
        `[kandi-store] Turnstile answered ${response.status}, allowing through.`
      );
      return { ok: true };
    }

    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? []).join(",") || "rejected" };
  } catch (error) {
    console.error("[kandi-store] Turnstile unreachable, allowing through:", error);
    return { ok: true };
  }
}
