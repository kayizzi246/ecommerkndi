import { callKandiApi } from "@/lib/customer-server";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * "Tell me when this is back", from a sold-out product page.
 *
 * ---- Why this route exists ----
 *
 * A sold-out page was a dead end that offered a category link and nothing else.
 * Every shopper who reached it had done the expensive part of the funnel — they
 * found the shop, found the product, and decided they wanted it — and the shop
 * threw all of it away because a box was empty that week. This is the cheapest
 * demand a marketplace will ever see, and it was being discarded at the exact
 * point it was proven.
 *
 * ---- Why it posts to the contact mailer ----
 *
 * There is no subscriber table in WordPress yet, and inventing one here would
 * mean a plugin change, a migration, and a cron job before a single address
 * could be captured. The mailer already exists, already reaches the person who
 * decides what to restock, and — this is the part that matters — that person is
 * who actually sends the "it's back" message today. So the request goes where
 * the decision is made, in a shape a human can act on, and the shop starts
 * collecting the signal now rather than after a schema.
 *
 * The obvious follow-up is a `kandi_stock_alert` table keyed on product id, so
 * a restock can notify everybody at once instead of by hand. When that lands,
 * only the `callKandiApi` target below changes: the browser contract stays.
 */

/** Caps on each field — the same reasoning as `/api/contact`. */
const MAX = { email: 200, name: 200 } as const;

function field(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Good enough to reject a typo and a bot; the mailbox is the real check. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function POST(request: Request) {
  // Every request here sends mail from the shop's own domain. Unthrottled, that
  // is a spam relay and, in time, a burned sending reputation — see the note on
  // the same limit in `/api/contact`.
  const limit = rateLimit("back-in-stock", clientIp(request), LIMITS.contact);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const email = field(body.email, MAX.email);
  const productName = field(body.productName, MAX.name);
  const productId = Number(body.productId);

  if (!looksLikeEmail(email)) {
    return Response.json(
      { message: "Enter an email address we can reach you on." },
      { status: 400 }
    );
  }

  // A request naming no product cannot be acted on, and is what an empty POST
  // from a script looks like.
  if (!Number.isFinite(productId) || productId <= 0) {
    return Response.json({ message: "We could not identify that product." }, { status: 400 });
  }

  // Only the status is used. The mailer's body is about the mailer, and
  // forwarding it would hand the browser wording written for us, not for the
  // shopper — see the reply built below.
  const { status } = await callKandiApi("/contact", {
    method: "POST",
    authenticated: false,
    body: {
      name: "Back-in-stock request",
      email,
      order: "",
      // The product id is in the subject rather than only the body so the
      // mailbox can be searched and sorted by it when a line is restocked.
      subject: `Back in stock alert — #${productId}`,
      message:
        `${email} wants to be told when this comes back in stock.\n\n` +
        `Product: ${productName || "(name not sent)"}\n` +
        `Product ID: ${productId}\n` +
        `Link: /products/${productId}`,
    },
  });

  // The mailer's own failures are not the shopper's problem to read. Anything
  // that is not a clean success is reported as one message they can act on.
  if (status < 200 || status >= 300) {
    return Response.json(
      { message: "We could not save that just now. Please try again." },
      { status: 502 }
    );
  }

  return Response.json({ ok: true }, { status: 200 });
}
