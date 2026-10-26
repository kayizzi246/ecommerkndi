/**
 * Search results ordered by the product NAME.
 *
 * WordPress matches a search word anywhere in a product, description
 * included, so "hoodies" also brought back a sweater whose description
 * happened to mention hoodies, sometimes ahead of the real ones. Shoppers
 * search for what a thing is called, so the name decides here:
 *
 *   • every word of the search in the name   → first
 *   • some of the words in the name           → next
 *   • none (matched on the description only)  → dropped, unless nothing
 *                                                matched by name at all
 *
 * Words are compared singular to plural ("hoodies" finds "Hoodie", "dresses"
 * finds "Dress") and as the start of a word ("sneak" finds "Sneakers").
 */

/** "Hoodies" → "hoodie", "dresses" → "dress", "batteries" → "battery". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

/** 2 when every search word is in the name, 1 when some are, 0 when none. */
export function nameScore(name: string, query: string): number {
  const raw = query.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length >= 2);
  if (raw.length === 0) return 2;
  // Each word with its singular forms: "hoodies" is "hoody" by the rule but
  // "hoodie" in the catalogue, so both are tried.
  const wanted = raw.map((word) => [stem(word), word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word]);
  const have = [...words(name), ...name.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/)];
  const found = wanted.filter((forms) => have.some((part) => forms.some((form) => part.startsWith(form)))).length;
  return found === wanted.length ? 2 : found > 0 ? 1 : 0;
}

/** The products best match first, description-only matches dropped when name matches exist. */
export function rankByName<T extends { name: string }>(products: T[], query: string): T[] {
  if (!query.trim()) return products;
  const scored = products.map((product, index) => ({ product, index, score: nameScore(product.name, query) }));
  const anyByName = scored.some((entry) => entry.score > 0);
  return scored
    .filter((entry) => !anyByName || entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.product);
}

/**
 * The term sent to WordPress: each word in the singular.
 *
 * WordPress looks for the exact text, so "dresses" found nothing in a shop
 * full of "Dress". The singular is inside the plural ("dress" in "dresses",
 * "hoodie" in "hoodies"), so searching for it finds both; `rankByName` then
 * keeps the results that are named for what was asked.
 */
export function searchTerm(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length > 4 && /(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}
