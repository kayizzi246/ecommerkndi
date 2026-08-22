/**
 * Ugandan mobile numbers, normalised to one shape.
 *
 * The phone number is the single most important field in this checkout. Every
 * order on this shop is completed by a rider calling it: to confirm the order,
 * to find the gate, and — on cash on delivery — to be let in with the goods. An
 * order with a mistyped number is not a slow order, it is a lost one, and the
 * shop has already packed it.
 *
 * So it is validated rather than merely collected, on the way in and again on
 * the server. Both ends call this, which is the point of it living here: a
 * check the browser does and the API does not is a check that anyone posting
 * straight to `/api/checkout` skips.
 *
 * ---- What counts ----
 *
 * A Ugandan mobile is nine digits after the country code and always starts with
 * 7: 07XX XXX XXX locally, +2567XX XXX XXX internationally. Landlines (03x,
 * 04x) are refused — a rider cannot ring a desk phone from a boda.
 *
 * Everything a shopper might reasonably type is accepted and cleaned up:
 * spaces, dashes, brackets, a leading +, 256 with or without it, and the local
 * 0. What comes back is always `+2567XXXXXXXX`, which is the form the SMS
 * gateway and WooCommerce should both hold, so two orders from the same person
 * are recognisably from the same person.
 */

/** `+2567XXXXXXXX`, or null when it is not a Ugandan mobile number. */
export function normaliseUgPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;

  // 0772123456 → 772123456; 256772123456 → 772123456; 772123456 stays.
  const national = digits.startsWith("256")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  // Nine digits, opening 7. This is the whole rule; anything else is either a
  // landline, a truncated number or a typo, and all three fail the same way.
  if (!/^7\d{8}$/.test(national)) return null;

  return `+256${national}`;
}

/** Whether this is a number a rider can actually call. */
export function isUgPhone(raw: string): boolean {
  return normaliseUgPhone(raw) !== null;
}

/** `+256772123456` → `0772 123 456`, for showing back what was understood. */
export function formatUgPhone(raw: string): string {
  const normalised = normaliseUgPhone(raw);
  if (!normalised) return raw;
  const national = normalised.slice(4); // drop "+256"
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
