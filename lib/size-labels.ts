/**
 * Standard size labels for imported option names.
 *
 * AliExpress imports name sizes like "4XL(120-150kg)" or "L (60-75kg)": the
 * standard size with the supplier's fitting note glued on. Shown whole, the
 * picker was a row of long, inconsistent chips; split, it reads as the M, L,
 * XL, XXL a shopper expects, with the weight range as a small hint beneath.
 *
 * Display only. The stored option name is still what is selected, put in the
 * basket and matched to the WooCommerce variation.
 */

const LETTER_SIZE = /^(\d*X*[SML]|\d*XL)\s*[([（]?\s*([^)\]）]*?)\s*[)\]）]?\s*$/i;

/** "4XL(120-150kg)" → { size: "4XL", note: "120–150 kg" }; anything else is returned whole. */
export function splitSize(name: string): { size: string; note: string | null } {
  const match = name.trim().match(LETTER_SIZE);
  if (!match) return { size: name.trim(), note: null };
  const note = match[2]
    .replace(/-/g, "–")
    .replace(/(\d)\s*kg/i, "$1 kg")
    .trim();
  return { size: match[1].toUpperCase(), note: note || null };
}

/** Position of a letter size on the XS → 6XL scale, or null when it is not one. */
function letterRank(size: string): number | null {
  const match = size.match(/^(\d*)(X*)([SML])$/i);
  if (!match) return null;
  const [, digits, xs, letter] = match;
  const extra = digits ? Number(digits) : xs.length;
  switch (letter.toUpperCase()) {
    case "S":
      return 1 - extra; // S, XS, XXS
    case "M":
      return 2;
    default:
      return 3 + extra; // L, XL, XXL / 2XL, 3XL, 4XL …
  }
}

/**
 * The options in the order a size chart reads: XS before XXL, 38 before 45.
 * Only reorders when EVERY option is a recognisable size, so a list like
 * "One Size" or "2pcs / 4pcs" keeps the order the seller gave it.
 */
export function sortSizes<T extends { name: string }>(options: T[]): T[] {
  const letters = options.map((option) => letterRank(splitSize(option.name).size));
  if (letters.every((rank) => rank !== null)) {
    return options
      .map((option, index) => ({ option, rank: letters[index] as number }))
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.option);
  }
  const numbers = options.map((option) => Number(option.name.trim().replace(",", ".")));
  if (numbers.every((value) => Number.isFinite(value))) {
    return options
      .map((option, index) => ({ option, value: numbers[index] }))
      .sort((a, b) => a.value - b.value)
      .map((entry) => entry.option);
  }
  return options;
}
