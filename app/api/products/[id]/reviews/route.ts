import { callKandiApi } from "@/lib/customer-server";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/** Longest review we will forward. Comfortably past any real one. */
const MAX_REVIEW_LENGTH = 5000;

type Params = { params: Promise<{ id: string }> };

function productId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Public: the approved reviews for one product. */
export async function GET(_request: Request, { params }: Params) {
  const id = productId((await params).id);
  if (id === null) {
    return Response.json({ message: "Invalid product." }, { status: 400 });
  }

  const { status, data } = await callKandiApi(`/products/${id}/reviews`, {
    authenticated: false,
  });
  return Response.json(data, { status });
}

/**
 * Writes a review to WordPress. The shopper's session cookie is turned into a
 * bearer token server-side, so the browser never holds a WordPress credential
 * and an unauthenticated post is rejected by WordPress itself.
 */
export async function POST(request: Request, { params }: Params) {
  const id = productId((await params).id);
  if (id === null) {
    return Response.json({ message: "Invalid product." }, { status: 400 });
  }

  // WordPress rejects an unauthenticated post, so this is not the access
  // control — it is a ceiling on how fast a *signed-in* account can write.
  // Review spam is the standard way a marketplace gets poisoned: a script with
  // one valid session pushing fake five-star text onto its own listings, or
  // one-star text onto a competitor's.
  const limit = rateLimit("review", clientIp(request), LIMITS.review);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    rating?: number;
    text?: string;
  };

  // Validated rather than forwarded as-is. A rating outside 1–5 is not
  // something the form can produce, and an unbounded `text` is a way to push
  // arbitrarily large rows into the database one request at a time.
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ message: "Choose a rating from 1 to 5." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_REVIEW_LENGTH) : "";

  const { status, data } = await callKandiApi(`/products/${id}/reviews`, {
    method: "POST",
    body: { rating, text },
  });

  return Response.json(data, { status });
}
