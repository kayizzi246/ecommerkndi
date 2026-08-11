import { pesapalEnabled } from "@/lib/pesapal";

/**
 * Whether this shop can take card and mobile money payments.
 *
 * Lets the checkout disable those options up front instead of letting a shopper
 * fill in the whole form, press pay, and only then discover the shop has no
 * Pesapal credentials. Deliberately returns nothing but a boolean — the keys
 * themselves must never leave the server.
 *
 * WordPress is asked first, because that is where the keys live now. The old
 * environment variables are still honoured as a fallback so a half-migrated
 * deployment does not lose its payment options, and an unreachable backend is
 * treated as "available": a shop whose WordPress is down has larger problems
 * than a greyed-out radio button, and hiding the option would send every
 * shopper to cash on delivery until somebody noticed.
 */
export async function GET() {
  const base = process.env.WP_API_URL;

  if (base) {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/payments/enabled`, {
        headers: { "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "" },
        // Checked once a minute rather than on every checkout render.
        next: { revalidate: 60 },
      });

      const data = (await response.json().catch(() => null)) as
        | { enabled?: boolean; code?: string }
        | null;

      if (response.ok && data && typeof data.enabled === "boolean") {
        return Response.json({ enabled: data.enabled });
      }
    } catch {
      // Fall through to the environment check below.
    }
  }

  return Response.json({ enabled: pesapalEnabled() });
}
