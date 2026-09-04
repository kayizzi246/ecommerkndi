import type { Destination } from "@/lib/otp";

/**
 * Getting a one-time code to a Ugandan phone, as cheaply as it can be done.
 *
 * ---- What was compared, and what it costs ----
 *
 * The obvious answer is Twilio Verify, and it is the wrong one here. Verify
 * bills roughly $0.05 per successful verification ON TOP of the SMS, which on
 * a shop where every new shopper is gated at checkout is a per-signup cost of
 * about UGX 190 before a single message has been sent. Twilio's Uganda SMS rate
 * is itself several times the local one, because the message arrives through an
 * international aggregator rather than off a local shortcode.
 *
 * The Ugandan gateways are an order of magnitude cheaper and they are the ones
 * every bank and fintech in Kampala already uses:
 *
 *   • EgoSMS (Pahappa)  — pay-as-you-go, JSON API, local sender IDs.
 *   • SMSUG / UgSMS     — advertise a flat UGX 25 per SMS, no setup fee.
 *   • Africa's Talking  — well documented, but wants a deposit up front.
 *
 * EgoSMS is the default adapter below because it is Ugandan, has no
 * per-verification fee on top of the message, and documents a plain JSON POST
 * that needs no SDK — which matters on a serverless deployment where every
 * dependency is cold-start weight.
 *
 * ---- Why there is a generic adapter as well ----
 *
 * Because the cheapest gateway in Kampala changes, and the shop should be able
 * to follow it without a deploy that touches this file. `KANDI_SMS_PROVIDER`
 * selects the adapter; `generic` posts a body the operator writes themselves as
 * a template. Anything with an HTTP endpoint — SMSUG, UgSMS, Africa's Talking,
 * a bank's own gateway — is then a change of environment variables.
 *
 * ---- And why email is offered beside it ----
 *
 * Because it costs nothing. Every SMS is a real UGX 25–40 off the shop's
 * margin, and a shopper who would rather use email is a shopper verifying for
 * free. It is the second option rather than the first because the phone number
 * is the thing the RIDER needs, and a shopper who proves an email has proved
 * something the delivery does not depend on — see the note in `lib/otp.ts`.
 *
 * ---- The failure mode that matters ----
 *
 * Nothing here throws. A gateway that is down, misconfigured, or out of credit
 * returns `false`, and the route above turns that into "we could not send a
 * code, try the other option" — because the alternative is a shopper stuck at a
 * checkout they cannot complete, on a shop that has already been paid for the
 * traffic that brought them there.
 */

export type SendResult = { ok: true } | { ok: false; reason: string };

/** What the shopper reads. Short: some handsets show one line in the banner. */
function smsBody(code: string): string {
  const brand = process.env.KANDI_SMS_SENDER_ID || "KandiUg";
  // The code first, because that is the only part anybody reads, and a warning
  // after it because a code with no context is what phishing looks like.
  return `${code} is your ${brand} verification code. It expires in 10 minutes. We will never ask you for it.`;
}

/* =========================================================================
 * SMS
 * ====================================================================== */

/**
 * EgoSMS — `POST https://comms.egosms.co/api/v1/json/`.
 *
 * The API answers `{"Status":"OK"}` on success and `{"Status":"Failed",
 * "Message":"…"}` otherwise, both with HTTP 200 — so the status code is not the
 * test and checking `response.ok` alone would report every rejected message as
 * sent.
 */
async function sendViaEgoSms(to: string, code: string): Promise<SendResult> {
  const username = process.env.KANDI_SMS_USERNAME;
  const password = process.env.KANDI_SMS_PASSWORD;
  const senderId = process.env.KANDI_SMS_SENDER_ID || "KandiUg";

  if (!username || !password) return { ok: false, reason: "sms-not-configured" };

  try {
    const response = await fetch(
      process.env.KANDI_SMS_URL || "https://comms.egosms.co/api/v1/json/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "SendSms",
          userdata: { username, password },
          msgdata: [
            {
              // The gateway wants the international form without the plus.
              number: to.replace(/^\+/, ""),
              message: smsBody(code),
              senderid: senderId,
              priority: "0",
            },
          ],
        }),
        cache: "no-store",
        // A shopper is watching a spinner. Ten seconds is already a long time
        // to make them wait for a gateway that is probably not coming back.
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) return { ok: false, reason: `sms-http-${response.status}` };

    const data = (await response.json().catch(() => null)) as { Status?: string } | null;
    if (data?.Status !== "OK") return { ok: false, reason: "sms-rejected" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "sms-unreachable" };
  }
}

/**
 * Any gateway with an HTTP endpoint, described entirely in environment.
 *
 * `KANDI_SMS_BODY_TEMPLATE` is a string with `{to}`, `{message}` and
 * `{sender}` in it — JSON or form-encoded, whichever the gateway wants — and
 * `KANDI_SMS_CONTENT_TYPE` says which. The substituted values are JSON-escaped
 * when the content type is JSON, so a message containing a quote cannot break
 * the body it is being pasted into.
 */
async function sendViaGeneric(to: string, code: string): Promise<SendResult> {
  const url = process.env.KANDI_SMS_URL;
  const template = process.env.KANDI_SMS_BODY_TEMPLATE;
  if (!url || !template) return { ok: false, reason: "sms-not-configured" };

  const contentType = process.env.KANDI_SMS_CONTENT_TYPE || "application/json";
  const isJson = contentType.includes("json");

  const escape = (value: string) =>
    isJson
      ? JSON.stringify(value).slice(1, -1)
      : encodeURIComponent(value);

  const body = template
    .replace(/\{to\}/g, escape(to.replace(/^\+/, "")))
    .replace(/\{message\}/g, escape(smsBody(code)))
    .replace(/\{sender\}/g, escape(process.env.KANDI_SMS_SENDER_ID || "KandiUg"));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(process.env.KANDI_SMS_AUTH_HEADER
          ? { Authorization: process.env.KANDI_SMS_AUTH_HEADER }
          : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok ? { ok: true } : { ok: false, reason: `sms-http-${response.status}` };
  } catch {
    return { ok: false, reason: "sms-unreachable" };
  }
}

/* =========================================================================
 * Email
 * ====================================================================== */

/**
 * Resend — `POST https://api.resend.com/emails`.
 *
 * One HTTP call, no SDK, and a free tier that comfortably covers a shop of this
 * size. `KANDI_MAIL_FROM` must be an address on a domain verified with the
 * provider; an unverified sender is accepted by the API and then silently not
 * delivered, which is the failure that looks like the code never arriving.
 */
async function sendEmail(to: string, code: string): Promise<SendResult> {
  const apiKey = process.env.KANDI_MAIL_API_KEY;
  const from = process.env.KANDI_MAIL_FROM;
  if (!apiKey || !from) return { ok: false, reason: "email-not-configured" };

  try {
    const response = await fetch(process.env.KANDI_MAIL_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `${code} is your KandiUg verification code`,
        // The code in the subject line as well as the body, so a shopper on a
        // phone can read it from the notification without opening anything.
        text: `${code} is your KandiUg verification code.\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this message — we will never ask you for this code.`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok ? { ok: true } : { ok: false, reason: `email-http-${response.status}` };
  } catch {
    return { ok: false, reason: "email-unreachable" };
  }
}

/* =========================================================================
 * The one entry point
 * ====================================================================== */

/**
 * Sends `code` to `destination`, whichever channel it is.
 *
 * ---- Development ----
 *
 * With no gateway configured, the code is logged to the server console and the
 * send reports success. That is what lets the whole flow — the modal, the
 * challenge, the verified cookie, the checkout gate — be built and tested
 * before anybody has an SMS account, and it is guarded on `NODE_ENV` so it can
 * never behave that way in production. In production an unconfigured gateway is
 * a failure, loudly, because the alternative is a live shop letting every
 * shopper past a check that is not running.
 */
export async function sendCode(destination: Destination, code: string): Promise<SendResult> {
  const provider = (process.env.KANDI_SMS_PROVIDER || "egosms").toLowerCase();

  const result =
    destination.channel === "email"
      ? await sendEmail(destination.value, code)
      : provider === "generic"
        ? await sendViaGeneric(destination.value, code)
        : await sendViaEgoSms(destination.value, code);

  if (!result.ok && result.reason.endsWith("not-configured")) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[otp] no ${destination.channel} gateway configured — code for ${destination.value} is ${code}`
      );
      return { ok: true };
    }
  }

  return result;
}
