// =============================================================================
//  send-sms: Supabase Auth "Send SMS" hook -> EgoSMS
//
//  Supabase phone sign-in has no built-in Ugandan SMS gateway, so Auth hands
//  each one-time code to this function, which sends it through the same EgoSMS
//  account the website uses (lib/otp-send.ts).
//
//  Supabase > Authentication > Hooks > Send SMS hook > HTTPS, URL:
//    https://<project>.supabase.co/functions/v1/send-sms
//  Copy the hook secret it generates ("v1,whsec_…") into SEND_SMS_HOOK_SECRET.
//
//  Secrets: SEND_SMS_HOOK_SECRET, KANDI_SMS_USERNAME, KANDI_SMS_PASSWORD,
//           KANDI_SMS_SENDER_ID (optional, default "KandiUg")
//
//  Deploy with JWT verification OFF (Auth signs the request itself):
//    supabase functions deploy send-sms --no-verify-jwt
// =============================================================================

import { Webhook } from "npm:standardwebhooks@1.0.0";

function fail(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  const payload = await request.text();
  const secret = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace(/^v1,whsec_/, "");

  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    event = new Webhook(secret).verify(payload, Object.fromEntries(request.headers));
  } catch {
    return fail("Invalid signature.", 401);
  }

  const phone = String(event?.user?.phone ?? "").replace(/\D/g, "");
  const code = String(event?.sms?.otp ?? "");
  if (!phone || !code) return fail("Missing phone or code.", 400);

  const username = Deno.env.get("KANDI_SMS_USERNAME");
  const password = Deno.env.get("KANDI_SMS_PASSWORD");
  const sender = Deno.env.get("KANDI_SMS_SENDER_ID") || "KandiUg";
  if (!username || !password) return fail("SMS is not configured.");

  try {
    const response = await fetch("https://www.egosms.co/api/v1/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "SendSms",
        userdata: { username, password },
        msgdata: [{
          number: phone,
          message: `${code} is your ${sender} verification code. It expires in 10 minutes. We will never ask you for it.`,
          senderid: sender,
          priority: "0",
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.Status !== "OK") return fail("The SMS could not be sent.");
  } catch {
    return fail("The SMS service did not answer.");
  }

  return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });
});
