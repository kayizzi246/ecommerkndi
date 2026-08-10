import { callKandiApi } from "@/lib/customer-server";

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

  const body = (await request.json().catch(() => ({}))) as {
    rating?: number;
    text?: string;
  };

  const { status, data } = await callKandiApi(`/products/${id}/reviews`, {
    method: "POST",
    body: { rating: body.rating, text: body.text },
  });

  return Response.json(data, { status });
}
