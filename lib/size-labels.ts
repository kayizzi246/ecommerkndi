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
  const numbers = options.map((option) =>
    Number(option.name.trim().replace(/^(?:US|EUR?|UK)\s*|\s*(?:US|EUR?|UK)$/gi, "").replace(",", "."))
  );
  if (numbers.every((value) => Number.isFinite(value))) {
    return options
      .map((option, index) => ({ option, value: numbers[index] }))
      .sort((a, b) => a.value - b.value)
      .map((entry) => entry.option);
  }
  return options;
}

/* ---- Shoe sizes, always in UK sizing ----
   AliExpress imports label shoes in US ("US 10") or EU ("42") sizes, which
   shoppers in Uganda do not buy by. The chip shows the UK size, with the
   supplier's label beneath it so nobody wonders what was converted. Display
   only, like `splitSize`: the stored option is what is bought. */

export type ShoeFit = { shoe: boolean; women: boolean };

const SHOE_WORDS = /shoe|sneaker|boot|loafer|sandal|slipper|heel|footwear|trainer|moccasin|flip.?flop|slides?\b|oxford|brogue/i;
const WOMEN_WORDS = /women|woman|ladies|lady|female|girl/i;

/** Whether a product is footwear, and cut for women, from its name and categories. */
export function shoeFit(product: { name: string; categories?: { name: string; slug?: string }[] }): ShoeFit {
  const text = [product.name, ...(product.categories ?? []).flatMap((c) => [c.name, c.slug ?? ""])].join(" ");
  return { shoe: SHOE_WORDS.test(text), women: WOMEN_WORDS.test(text) };
}

/** EU → UK, from the usual adult charts. */
const EU_TO_UK_MEN: Record<number, number> = {
  36: 3.5, 37: 4, 38: 5, 39: 6, 40: 6.5, 41: 7, 42: 8, 43: 9, 44: 9.5, 45: 10.5, 46: 11, 47: 12, 48: 13, 49: 14, 50: 15,
};
const EU_TO_UK_WOMEN: Record<number, number> = {
  34: 2, 35: 2.5, 36: 3.5, 37: 4, 38: 5, 39: 6, 40: 6.5, 41: 7.5, 42: 8, 43: 9, 44: 9.5,
};

const SHOE_SIZE = /^(?:(US|EUR?|UK)\s*)?(\d{1,2}(?:[.,]5)?)\s*(US|EUR?|UK)?\s*(?:[([（].*)?$/i;

/** The UK size for a shoe label, or null when the label is not a size this can convert. */
export function ukShoeSize(name: string, fit: ShoeFit): { size: string; note: string } | null {
  const match = name.trim().match(SHOE_SIZE);
  if (!match) return null;
  const system = (match[1] || match[3] || "").toUpperCase();
  const value = Number(match[2].replace(",", "."));
  let uk: number | undefined;
  if (system === "UK") return { size: `UK ${value}`, note: "" };
  if (system === "US") uk = value - (fit.women ? 2 : 1);
  else if (system.startsWith("EU") || (!system && value >= 34 && value <= 50)) {
    uk = (fit.women ? EU_TO_UK_WOMEN : EU_TO_UK_MEN)[Math.round(value)];
  }
  if (uk === undefined || uk <= 0) return null;
  return { size: `UK ${uk}`, note: system ? `${system === "EUR" ? "EU" : system} ${value}` : `EU ${value}` };
}

/** The label for a size chip: UK sizing for shoes, otherwise `splitSize`. */
export function sizeLabel(name: string, fit?: ShoeFit): { size: string; note: string | null } {
  if (fit?.shoe) {
    const uk = ukShoeSize(name, fit);
    if (uk) return { size: uk.size, note: uk.note || null };
  }
  return splitSize(name);
}

/** Basket labels with any converted shoe size added, so the cart and checkout say "UK 9" too. */
export function withSizeLabels(
  labels: Record<string, string> | undefined,
  selected: Record<string, string | null | undefined>,
  fit: ShoeFit
): Record<string, string> | undefined {
  if (!fit.shoe) return labels;
  const merged = { ...labels };
  for (const [name, value] of Object.entries(selected)) {
    if (!value || merged[name]) continue;
    const uk = ukShoeSize(value, fit);
    if (uk) merged[name] = uk.size;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}
