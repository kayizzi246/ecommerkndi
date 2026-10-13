/**
 * Colour names as AliExpress imports write them: "AK-blue", "Black 39",
 * "Light Grey-XL", "Wine red set", "C02 rose gold". None of those is a CSS
 * colour, so a swatch that painted `option.name` drew an empty circle. This
 * finds the colour word inside the name instead.
 */

/** An attribute that holds colours: "Color", "Colour", "Color Name", "pa_color", "Main Colour". */
export function isColourAttribute(name: string): boolean {
  return /colou?r/i.test(name);
}

const MULTI =
  "conic-gradient(#e53935, #fdd835, #43a047, #1e88e5, #8e24aa, #e53935)";

/* Longest phrases first, so "light blue" wins over "blue" and "rose gold"
   over "gold". */
const COLOURS: [string, string][] = [
  ["multicolour", MULTI],
  ["multicolor", MULTI],
  ["multi color", MULTI],
  ["multi colour", MULTI],
  ["rainbow", MULTI],
  ["colorful", MULTI],
  ["colourful", MULTI],
  ["mixed", MULTI],
  ["light blue", "#90caf9"],
  ["sky blue", "#87ceeb"],
  ["royal blue", "#2952cc"],
  ["navy blue", "#1f2a56"],
  ["dark blue", "#1e3a8a"],
  ["lake blue", "#1aa3c8"],
  ["light green", "#a5d6a7"],
  ["dark green", "#1b5e20"],
  ["army green", "#4b5320"],
  ["mint green", "#98e2c6"],
  ["light grey", "#d1d5db"],
  ["light gray", "#d1d5db"],
  ["dark grey", "#4b5563"],
  ["dark gray", "#4b5563"],
  ["light pink", "#f8bbd0"],
  ["hot pink", "#ff4f9a"],
  ["rose red", "#c2185b"],
  ["wine red", "#7b1e3a"],
  ["rose gold", "#d4a59a"],
  ["light brown", "#b08968"],
  ["dark brown", "#4e342e"],
  ["off white", "#f5f2ea"],
  ["navy", "#1f2a56"],
  ["blue", "#1e66f5"],
  ["red", "#e02424"],
  ["green", "#22a447"],
  ["yellow", "#facc15"],
  ["orange", "#f97316"],
  ["purple", "#8b5cf6"],
  ["violet", "#7c3aed"],
  ["lavender", "#c4b5fd"],
  ["pink", "#f472b6"],
  ["black", "#111111"],
  ["white", "#ffffff"],
  ["grey", "#9ca3af"],
  ["gray", "#9ca3af"],
  ["silver", "#c0c0c0"],
  ["gold", "#d4af37"],
  ["golden", "#d4af37"],
  ["brown", "#8b5a2b"],
  ["coffee", "#6f4e37"],
  ["khaki", "#c3b091"],
  ["beige", "#e8dcc4"],
  ["cream", "#f5ecd7"],
  ["apricot", "#fbceb1"],
  ["camel", "#c19a6b"],
  ["tan", "#d2b48c"],
  ["wine", "#7b1e3a"],
  ["burgundy", "#800020"],
  ["maroon", "#800000"],
  ["teal", "#0d9488"],
  ["turquoise", "#40e0d0"],
  ["cyan", "#06b6d4"],
  ["mint", "#98e2c6"],
  ["olive", "#708238"],
  ["transparent", "linear-gradient(135deg, #ffffff 45%, #d1d5db 50%, #ffffff 55%)"],
  ["clear", "linear-gradient(135deg, #ffffff 45%, #d1d5db 50%, #ffffff 55%)"],
];

/**
 * The CSS background for a colour option, or null when the name holds no
 * colour ("2pcs", "Style A") — the caller then shows the name alone rather
 * than an empty circle.
 */
export function colourFill(name: string, value?: string | null): string | null {
  if (value) return value;
  // "AK-blue", "Black_39", "lightBlue" → "ak blue", "black 39", "light blue".
  const text = ` ${name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")} `;
  for (const [word, fill] of COLOURS) {
    if (text.includes(` ${word} `)) return fill;
  }
  // Glued-on words with no separator, e.g. "AKblue", "darkgreen".
  for (const [word, fill] of COLOURS) {
    if (word.length >= 4 && text.replace(/ /g, "").includes(word.replace(/ /g, ""))) return fill;
  }
  return null;
}

/** Words that qualify a colour without being one: the "light" in "Light Blue". */
const SHADES = new Set([
  "light", "dark", "deep", "pale", "bright", "sky", "royal", "rose", "hot",
  "army", "lake", "off", "multi",
]);

/**
 * Splits an imported option name into the colour and the code around it, for
 * a two-line label: "AVA-Pink" → { colour: "Pink", code: "AVA" }. A name that
 * is all colour ("Light Blue") or has no colour word ("ML565EG1") comes back
 * whole as `colour`, with no code.
 */
export function splitColourName(name: string): { colour: string; code: string | null } {
  const parts = name.split(/[-_/|]+|\s+/).filter(Boolean);
  if (parts.length < 2) return { colour: name, code: null };
  const isColourWord = (part: string) =>
    colourFill(part) !== null || SHADES.has(part.toLowerCase());
  const colourParts = parts.filter(isColourWord);
  const codeParts = parts.filter((part) => !isColourWord(part));
  if (colourParts.length === 0 || codeParts.length === 0) return { colour: name, code: null };
  const colour = colourParts.join(" ");
  return {
    colour: colour.charAt(0).toUpperCase() + colour.slice(1),
    code: codeParts.join(" "),
  };
}
