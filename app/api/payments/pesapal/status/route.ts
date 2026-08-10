import { pesapalEnabled } from "@/lib/pesapal";

/**
 * Whether this shop can take card and mobile money payments.
 *
 * Lets the checkout disable those options up front instead of letting a shopper
 * fill in the whole form, press pay, and only then discover the shop has no
 * Pesapal credentials. Deliberately returns nothing but a boolean — the keys
 * themselves must never leave the server.
 */
export function GET() {
  return Response.json({ enabled: pesapalEnabled() });
}
