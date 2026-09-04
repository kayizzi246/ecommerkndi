import { cookies } from "next/headers";
import { privateJson } from "@/lib/private-json";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { sendCode } from "@/lib/otp-send";
import {
  CHALLENGE_TTL_SECONDS,
  generateCode,
  maskDestination,
  parseDestination,
  readVerified,
  sealChallenge,
  VERIFIED_COOKIE,
} from "@/lib/otp";

/**
 * Sends a one-time code to a phone number or an email address.
 *
 * ---- Every request here spends the shop's money ----
 *
 * That is the thing to hold in mind about this route and it is why it carries
 * three separate ceilings rather than the usual one. An unthrottled send
 * endpoint is not merely a spam vector: it is a form on a public website that
 * turns a POST into UGX 25 off the shop's SMS credit, and a script can drain a
 * month of it in a minute. It is also an SMS-bombing service pointed at whoever
 * the caller names, sent from the shop's own sender ID.
 *
 *   • Per source address — one machine cannot walk a list of numbers.
 *   • Per destination — a botnet spreading the same target across a thousand
 *     addresses still cannot make one phone ring more than a few times an hour.
 *     This is the limit that actually protects the victim, and it is the one an
 *     IP-only limiter misses entirely.
 *   • A daily ceiling per destination, because the hourly one still permits
 *     ninety-six messages a day to a number somebody is being harassed on.
 *
 * `enforceRateLimit` is the async form, so all three windows are shared through
 * Upstash where it is configured — which matters more here than on sign-in,
 * because per-instance counters on a serverless deployment multiply by however
 * many instances are warm, and each one of those multiples is a real message.
 */
export const dynamic = "force-dynamic";

/** Deliberately tighter than `LIMITS.passwordReset`: this costs cash, not mail. */
const SEND_LIMITS = {
  bySource: { limit: 8, windowMs: 60 * 60_000 },
  byDestination: { limit: 4, windowMs: 60 * 60_000 },
  byDestinationDaily: { limit: 12, windowMs: 24 * 60 * 60_000 },
} as const;

export async function POST(request: Request) {
  const bySource = await enforceRateLimit("otp:send:ip", clientIp(request), SEND_LIMITS.bySource);
  if (bySource) return bySource;

  const body = (await request.json().catch(() => ({}))) as {
    channel?: unknown;
    to?: unknown;
  };

  const parsed = parseDestination(body.channel, body.to);
  if (!parsed.ok) return privateJson({ message: parsed.message }, { status: 400 });

  const { destination } = parsed;

  /* ---- Already proved, on this browser ----

     A shopper who verified this exact number three weeks ago should not be sent
     another code for it, and the shop should not pay for one. This is a real
     saving rather than a micro-optimisation: it is the difference between
     charging the shop once per shopper and once per checkout.

     It is checked here rather than only in the modal because the modal is a
     client and clients can be skipped. */
  const already = await readVerified((await cookies()).get(VERIFIED_COOKIE)?.value);
  if (already && already.channel === destination.channel && already.value === destination.value) {
    return privateJson({ ok: true, alreadyVerified: true });
  }

  const byDestination = await enforceRateLimit(
    "otp:send:to",
    destination.value,
    SEND_LIMITS.byDestination
  );
  if (byDestination) return byDestination;

  const daily = await enforceRateLimit(
    "otp:send:to:day",
    destination.value,
    SEND_LIMITS.byDestinationDaily
  );
  if (daily) return daily;

  const code = generateCode();
  const challenge = await sealChallenge(destination, code);

  /* No secret configured means no sealing, and an unsealed challenge is not a
     challenge — it would be a code the browser could read. Fail rather than
     degrade: the one thing this route must never do is report success on a
     verification it is not actually running. */
  if (!challenge) {
    return privateJson(
      { message: "Verification is not available right now. Please try again shortly." },
      { status: 503 }
    );
  }

  const sent = await sendCode(destination, code);
  if (!sent.ok) {
    /* The reason is logged and not returned. "sms-rejected" tells a caller
       whether a number is on a network the gateway can reach, which is more
       than a stranger should be able to learn from a public endpoint — and it
       tells a shopper nothing they can act on. */
    console.warn(`[otp] send failed: ${sent.reason}`);
    return privateJson(
      {
        message:
          destination.channel === "sms"
            ? "We could not send the code to that number. Check it, or use your email instead."
            : "We could not send the code to that address. Check it, or use your phone instead.",
      },
      { status: 502 }
    );
  }

  return privateJson({
    ok: true,
    challenge,
    /* Masked, so the modal can say where the code went without printing a full
       number on a screen in a shared space. */
    sentTo: maskDestination(destination),
    expiresInSeconds: CHALLENGE_TTL_SECONDS,
  });
}
