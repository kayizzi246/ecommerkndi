import { callKandiApi } from "@/lib/customer-server";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Passes a contact-form message to WordPress, which emails it to the support
 * address. Posted server-side so the shared secret never reaches the browser —
 * an unauthenticated mail endpoint is a spam relay.
 */
/**
 * Caps on each field.
 *
 * The route forwarded whatever it was given straight to the mailer, so a script
 * could post a megabyte of text and we would faithfully email it to ourselves —
 * and repeat. Truncating rather than rejecting keeps a genuine long message
 * from being thrown away over a few characters; nothing legitimate comes near
 * these limits.
 */
const MAX = { name: 120, email: 200, order: 60, subject: 200, message: 5000 } as const;

/** Trims, caps, and guarantees a string — the field may arrive as anything. */
function field(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  // Nothing stopped a script posting here in a loop, and every message becomes
  // an email sent from the shop's own domain. Beyond the nuisance, a mailbox
  // full of generated messages is how genuine customer enquiries get missed,
  // and volume from our domain is how the domain's sending reputation goes.
  const limit = rateLimit("contact", clientIp(request), LIMITS.contact);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const message = field(body.message, MAX.message);
  const email = field(body.email, MAX.email);

  // An empty submission is always a bot: the form on /contact requires both.
  if (!message || !email) {
    return Response.json(
      { message: "Enter your email address and a message." },
      { status: 400 }
    );
  }

  const { status, data } = await callKandiApi("/contact", {
    method: "POST",
    authenticated: false,
    body: {
      name: field(body.name, MAX.name),
      email,
      order: field(body.order, MAX.order),
      subject: field(body.subject, MAX.subject),
      message,
    },
  });

  return Response.json(data, { status });
}
