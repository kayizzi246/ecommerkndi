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

/* ---- Shoe sizes, always in EU sizing ----
   AliExpress imports label shoes in US ("US 10"), UK or EU ("42") sizes.
   Shoppers here buy by EU size, so the chip always shows one, with the
   supplier's label beneath it when it was converted. Display only, like
   `splitSize`: the stored option is what is bought. */

export type ShoeFit = { shoe: boolean; women: boolean };

const SHOE_WORDS = /shoe|sneaker|boot|loafer|sandal|slipper|heel|footwear|trainer|moccasin|flip.?flop|slides?\b|oxford|brogue/i;
const WOMEN_WORDS = /women|woman|ladies|lady|female|girl/i;

/** Whether a product is footwear, and cut for women, from its name and categories. */
export function shoeFit(product: { name: string; categories?: { name: string; slug?: string }[] }): ShoeFit {
  const text = [product.name, ...(product.categories ?? []).flatMap((c) => [c.name, c.slug ?? ""])].join(" ");
  return { shoe: SHOE_WORDS.test(text), women: WOMEN_WORDS.test(text) };
}

/** US → EU, from the usual adult charts. */
const US_TO_EU_MEN: Record<number, number> = {
  5: 38, 5.5: 38.5, 6: 39, 6.5: 39.5, 7: 40, 7.5: 40.5, 8: 41, 8.5: 42, 9: 42.5, 9.5: 43, 10: 44, 10.5: 44.5,
  11: 45, 11.5: 45.5, 12: 46, 13: 47, 14: 48, 15: 49,
};
const US_TO_EU_WOMEN: Record<number, number> = {
  4: 34.5, 4.5: 35, 5: 35.5, 5.5: 36, 6: 36.5, 6.5: 37, 7: 37.5, 7.5: 38, 8: 38.5, 8.5: 39, 9: 39.5, 9.5: 40,
  10: 40.5, 10.5: 41, 11: 41.5, 12: 42.5,
};
/** UK → EU. */
const UK_TO_EU: Record<number, number> = {
  2: 35, 2.5: 35, 3: 35.5, 3.5: 36, 4: 37, 4.5: 37.5, 5: 38, 5.5: 38.5, 6: 39, 6.5: 40, 7: 40.5, 7.5: 41,
  8: 42, 8.5: 42.5, 9: 43, 9.5: 44, 10: 44.5, 10.5: 45, 11: 46, 12: 47, 13: 48, 14: 49,
};

const SHOE_SIZE = /^(?:(US|EUR?|UK)\s*)?(\d{1,2}(?:[.,]5)?)\s*(US|EUR?|UK)?\s*(?:[([（].*)?$/i;

/** The EU size for a shoe label, or null when the label is not a size this can read. */
export function euShoeSize(name: string, fit: ShoeFit): { size: string; note: string } | null {
  const match = name.trim().match(SHOE_SIZE);
  if (!match) return null;
  const system = (match[1] || match[3] || "").toUpperCase();
  const value = Number(match[2].replace(",", "."));
  if (system.startsWith("EU") || (!system && value >= 30 && value <= 50)) {
    return { size: `EU ${value}`, note: "" };
  }
  const eu =
    system === "US" ? (fit.women ? US_TO_EU_WOMEN : US_TO_EU_MEN)[value] : system === "UK" ? UK_TO_EU[value] : undefined;
  if (eu === undefined) return null;
  return { size: `EU ${eu}`, note: `${system} ${value}` };
}

/** The label for a size chip: EU sizing for shoes, otherwise `splitSize`. */
export function sizeLabel(name: string, fit?: ShoeFit): { size: string; note: string | null } {
  if (fit?.shoe) {
    const eu = euShoeSize(name, fit);
    if (eu) return { size: eu.size, note: eu.note || null };
  }
  return splitSize(name);
}

/** Basket labels with any converted shoe size added, so the cart and checkout say "EU 44" too. */
export function withSizeLabels(
  labels: Record<string, string> | undefined,
  selected: Record<string, string | null | undefined>,
  fit: ShoeFit
): Record<string, string> | undefined {
  if (!fit.shoe) return labels;
  const merged = { ...labels };
  for (const [name, value] of Object.entries(selected)) {
    if (!value || merged[name]) continue;
    const eu = euShoeSize(value, fit);
    if (eu && eu.size !== value) merged[name] = eu.size;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}
