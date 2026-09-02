/**
 * Picking readable type for a colour somebody else chose.
 *
 * A seller can paint their store header any hex they like, which means the
 * storefront cannot know at build time whether white or black goes on top of
 * it. Hard-coding white — which is what the header did while the colour was
 * fixed at near-black — hands a seller who picks a pale mustard a page whose
 * own name is invisible, from a feature that exists to help them market.
 *
 * So the ink is computed rather than chosen, from the WCAG relative-luminance
 * formula. It is the same calculation a contrast checker runs, and using the
 * real one rather than a rule of thumb like "average the channels" matters at
 * the edges: pure green (#00ff00) averages to a mid grey and is in fact one of
 * the brightest colours a screen can make, so an averaging shortcut puts white
 * type on it and a luminance calculation correctly puts black.
 */

/** Linearised channel value, per WCAG 2.x. */
function channel(eightBit: number): number {
  const v = eightBit / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;

  const r = channel(parseInt(clean.slice(0, 2), 16));
  const g = channel(parseInt(clean.slice(2, 4), 16));
  const b = channel(parseInt(clean.slice(4, 6), 16));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when type on this colour should be light. */
export function isDark(hex: string): boolean {
  /**
   * 0.4 rather than the more usual 0.5.
   *
   * The threshold decides where white type stops being readable, and the two
   * directions are not symmetrical: black on a mid tone stays legible well past
   * the point where white on the same tone has gone soft. Biasing toward black
   * therefore fails more gently — the worst case is type that is darker than it
   * strictly had to be, rather than type that has dissolved into its
   * background.
   */
  return luminance(hex) < 0.4;
}

/**
 * The header's ink, and the translucent version of it used for everything
 * layered on top — supporting copy, stat labels, hairlines.
 *
 * Returning a function rather than a set of fixed values keeps the header to
 * ONE decision: every secondary element is the same ink at an opacity, so a
 * colour change cannot leave one line behind at the wrong contrast. It also
 * means a divider on a light header is a dark hairline rather than a white one
 * that is invisible against it.
 */
export function inkFor(hex: string): {
  dark: boolean;
  ink: string;
  veil: (opacity: number) => string;
} {
  const dark = isDark(hex);
  const base = dark ? "255,255,255" : "23,23,23";

  return {
    dark,
    ink: dark ? "#ffffff" : "#171717",
    veil: (opacity: number) => `rgba(${base},${opacity})`,
  };
}
