import { NextResponse } from "next/server";
import { privateJson } from "@/lib/private-json";

/**
 * GET /api/track?number=1563&contact=0772123456
 *
 * Looks up one order for somebody who is not signed in.
 *
 * The shared secret never reaches the browser, so this exists to attach it. The
 * shopper's browser sends an order number and a contact detail; this adds the
 * credential WordPress requires and passes the answer back unchanged.
 *
 * Everything that decides whether the caller is allowed to see the order — the
 * contact match, the rate limit, and what is safe to return — happens in
 * WordPress. Doing any of it here would put an access-control rule in front of
 * an endpoint that is still reachable without it.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const baseUrl = process.env.WP_API_URL;
  const secret = process.env.KANDI_API_SECRET;

  if (!baseUrl || !secret) {
    return privateJson(
      { message: "Order tracking is not configured on this shop." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const number = (searchParams.get("number") ?? "").trim();
  const contact = (searchParams.get("contact") ?? "").trim();

  if (!number || !contact) {
    return privateJson(
      { message: "Enter your order number and the phone or email you ordered with." },
      { status: 400 }
    );
  }

  const target = new URL(`${baseUrl}/orders/track`);
  target.searchParams.set("number", number);
  target.searchParams.set("contact", contact);

  try {
    const res = await fetch(target, {
      headers: { "X-Kandi-Secret": secret },
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as
      | { message?: string }
      | Record<string, unknown>
      | null;

    if (!res.ok) {
      return privateJson(
        {
          message:
            (data as { message?: string })?.message ??
            "We could not find an order with those details.",
        },
        // A 5xx from WordPress is not the shopper's fault and must not be
        // dressed up as "no such order" — that would send somebody hunting for
        // a typo in details that were correct.
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    return privateJson(data ?? {}, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Could not reach the store. Please try again." },
      { status: 502 }
    );
  }
}
