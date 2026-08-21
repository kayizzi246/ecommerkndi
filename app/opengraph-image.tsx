import { ImageResponse } from "next/og";
import { getSiteSettings, brandName } from "@/lib/site-settings";

/**
 * The picture that appears when the shop is pasted into WhatsApp.
 *
 * ---- Why this file exists ----
 *
 * There was no Open Graph image at all. `metadataBase` was set so that a
 * PRODUCT link resolves its photograph absolutely — that part worked — but a
 * link to the shop itself, which is what somebody sends when they recommend
 * it, arrived as a bare grey box with a line of text. On WhatsApp, which is
 * how most sharing here happens, an unfurled link with a picture is a
 * different object from one without: it is bigger, it looks deliberate, and it
 * is the difference between a recommendation that reads as a shop and one that
 * reads as a forwarded URL.
 *
 * ---- Why it is drawn rather than uploaded ----
 *
 * A file in `public/` would be a second brand asset for a shopkeeper to
 * maintain and to get wrong: the wrong ratio, the wrong name after a rename,
 * or simply never replaced. This is generated from the same wp-admin branding
 * the masthead reads, so a shop that renames itself has a correct share card
 * without a redeploy and without touching an image editor.
 *
 * No web font is loaded. `ImageResponse` falls back to the system stack it
 * bundles, and the alternative — fetching Inter at build time for every
 * regenerate — buys a slightly tighter grotesque at the cost of a network
 * dependency inside image generation. The card is read at thumbnail size in a
 * chat list; the typeface is not what it is judged on.
 *
 * ---- The size is not negotiable ----
 *
 * 1200x630 is what Facebook, WhatsApp and X all crop from. A square would be
 * letterboxed by all three, which is how a share card ends up as a logo
 * floating in grey bars.
 */
export const alt = "KandiUg — online shopping in Uganda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const settings = await getSiteSettings();
  const brand = brandName(settings);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          // The brand gradient, the same two stops the masthead's logo uses.
          backgroundImage: "linear-gradient(135deg, #ff6a00 0%, #e85d00 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          {brand}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          Online shopping in Uganda
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 40,
            fontWeight: 600,
            opacity: 0.95,
          }}
        >
          {`Pay on delivery · ${settings.commerce.returns_days}-day returns · Countrywide`}
        </div>
      </div>
    ),
    size,
  );
}
