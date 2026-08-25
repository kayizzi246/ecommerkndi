/**
 * The allowlist that stands between an imported product description and
 * `dangerouslySetInnerHTML`.
 *
 * ---- What this is guarding ----
 *
 * The product page renders `product.description` as real HTML, because it has
 * to: WooCommerce descriptions arrive from suppliers as markup with tables,
 * lists and images in them, and printing that as text would show shoppers a
 * screenful of angle brackets. WordPress sent it through `wpautop()` and
 * nothing else, so whatever markup was in the post body reached the browser
 * intact — including a `<script>` or an `onerror=` if one ever got into a
 * description.
 *
 * The usual answer is "only trusted admins can edit products, so it is fine".
 * That is not true here for two reasons. This is a marketplace: the Seller
 * Centre lets sellers create their own listings, so "who can write a product
 * description" is a larger and less vetted group than "who can log into
 * wp-admin". And descriptions are routinely pasted in from supplier sites and
 * spreadsheets, which is exactly how markup nobody read ends up in a database.
 *
 * The real fix lives on both sides. `kandi-store-api.php` now runs
 * `wp_kses_post()` before the description leaves WordPress, which is the same
 * filter WordPress applies to post content everywhere else. This is the second
 * copy, on the rendering side, because the storefront should not be one plugin
 * update away from trusting whatever a backend hands it.
 *
 * ---- Deliberately not a full HTML parser ----
 *
 * It is a tokeniser with an allowlist, run on the server at render time. It
 * does not attempt to be a general-purpose sanitiser for arbitrary hostile
 * input; it removes every element and attribute that can execute, load, or
 * navigate, and rebuilds the rest. Anything it does not recognise is dropped
 * rather than passed through — the direction a filter must fail in.
 */

/** Elements a product description is allowed to contain. */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "small", "sub", "sup", "mark",
  "ul", "ol", "li", "dl", "dt", "dd",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "a", "img", "figure", "figcaption",
  "span", "div",
]);

/** Elements whose CONTENT goes too, not just the tag. */
const VOID_THE_CONTENTS = [
  "script", "style", "iframe", "frame", "frameset", "object", "embed",
  "applet", "noscript", "template", "svg", "math", "form", "input",
  "button", "select", "textarea", "option", "link", "meta", "base", "title",
];

/** Elements that never have a closing tag. */
const VOID_ELEMENTS = new Set(["br", "hr", "img", "col"]);

/** Attributes kept, per element. `*` applies to every allowed element. */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  "*": new Set(["title", "dir", "lang"]),
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan", "headers"]),
  th: new Set(["colspan", "rowspan", "scope", "headers"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  ol: new Set(["start", "type", "reversed"]),
};

/**
 * URL schemes a link or an image may use.
 *
 * `javascript:` is the obvious one. `data:` is excluded too, and that is worth
 * a sentence: `data:text/html` in an `href` executes script on our origin in
 * several browsers, and there is no legitimate reason for a supplier's
 * description to inline a base64 image when WordPress hosts the media.
 *
 * Read it as: either it opens with a scheme we allow, or it has no scheme at
 * all — a relative or protocol-relative URL, which cannot execute.
 */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:|\/|#|\?|[^:]*$)/i;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A URL is safe when, once entities and whitespace that browsers ignore are
 * stripped, it does not name a scheme we refuse.
 *
 * The normalisation is the point. `java&#115;cript:alert(1)` and
 * `java\tscript:alert(1)` are both `javascript:` by the time a browser reads
 * them, and a check against the raw string would pass both.
 */
function safeUrl(raw: string): string | null {
  const normalised = raw
    .replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Control characters and whitespace inside a scheme are ignored by
    // browsers, so they must be ignored here before the scheme is read.
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();

  return SAFE_SCHEME.test(normalised) ? raw.trim() : null;
}

/** Splits a tag's attribute text into name/value pairs. */
function parseAttributes(source: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    pairs.push([match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""]);
  }

  return pairs;
}

/**
 * Returns `html` with everything outside the allowlist removed.
 *
 * Safe to hand to `dangerouslySetInnerHTML`. Empty input, or input that is
 * entirely disallowed, comes back as an empty string.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";

  // Comments first, because `<!--` can hide a tag from a naive tokeniser while
  // browsers still parse it in some legacy modes.
  let source = html.replace(/<!--[\s\S]*?-->/g, "");

  // Elements whose contents are as dangerous as the element. Both the balanced
  // form and an unclosed one at the end of the string, which is what a
  // truncated paste looks like.
  for (const tag of VOID_THE_CONTENTS) {
    source = source.replace(
      new RegExp("<" + tag + "\\b[\\s\\S]*?(?:</" + tag + "\\s*>|$)", "gi"),
      ""
    );
  }

  const output: string[] = [];
  const openTags: string[] = [];
  const pattern = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) {
      output.push(escapeText(source.slice(cursor, match.index)));
    }
    cursor = pattern.lastIndex;

    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();

    // Not on the list: the tag disappears, its text content stays. Dropping the
    // content too would silently delete paragraphs over an unrecognised
    // wrapper, which reads to the shop owner as the description being eaten.
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (closing) {
      if (VOID_ELEMENTS.has(tag)) continue;
      // Only close something actually open, so a stray `</div>` from a bad
      // paste cannot close a container this page opened around it.
      const position = openTags.lastIndexOf(tag);
      if (position === -1) continue;
      // Close anything left open inside it, innermost first.
      for (let index = openTags.length - 1; index >= position; index--) {
        output.push("</" + openTags[index] + ">");
      }
      openTags.length = position;
      continue;
    }

    const permitted = ALLOWED_ATTRIBUTES[tag];
    const shared = ALLOWED_ATTRIBUTES["*"];
    const rendered: string[] = [];

    for (const [name, value] of parseAttributes(match[3] ?? "")) {
      if (!permitted?.has(name) && !shared.has(name)) continue;

      if (name === "href" || name === "src") {
        const url = safeUrl(value);
        if (!url) continue;
        rendered.push(name + '="' + escapeAttribute(url) + '"');
        continue;
      }

      // A supplier's `target="_blank"` without `rel` hands the new tab a
      // handle on this page through `window.opener`. Forced rather than
      // dropped, because opening a spec sheet in a new tab is reasonable.
      if (name === "target") {
        rendered.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
        continue;
      }
      if (name === "rel") continue;

      rendered.push(name + '="' + escapeAttribute(value) + '"');
    }

    const attributes = rendered.length > 0 ? " " + rendered.join(" ") : "";

    if (VOID_ELEMENTS.has(tag)) {
      output.push("<" + tag + attributes + " />");
    } else {
      output.push("<" + tag + attributes + ">");
      openTags.push(tag);
    }
  }

  if (cursor < source.length) output.push(escapeText(source.slice(cursor)));

  // Anything the source left hanging. Without this, an unclosed `<div>` in a
  // description would swallow the related products and the reviews below it.
  for (let index = openTags.length - 1; index >= 0; index--) {
    output.push("</" + openTags[index] + ">");
  }

  return output.join("");
}
