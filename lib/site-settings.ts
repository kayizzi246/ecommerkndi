import { DEFAULT_RATES, type DeliveryRates } from "@/lib/delivery";
/**
 * Branding and promotional copy, editable in wp-admin under "Kandi Storefront"
 * (the `kandi-storefront-settings.php` plugin).
 *
 * Every field has a fallback here, so the storefront renders correctly before
 * the plugin is installed and keeps rendering if WordPress is unreachable —
 * branding must never be the reason a page fails.
 */

export type SiteSettings = {
  brand: { name: string; suffix: string; tagline: string; logo_url: string; favicon_url: string };
  promo: { lines: string[]; cta_label: string; cta_url: string };
  ticker: string[];
  /**
   * Campaign cards for the homepage rail — Christmas, a shoes week, whatever
   * the shop is running. Edited in wp-admin; empty when nothing is on, in which
   * case the storefront derives its own from the catalogue instead.
   */
  promotions: { badge: string; headline: string; note: string; url: string }[];
  banner: {
    eyebrow: string;
    headline: string;
    cta_label: string;
    cta_url: string;
    /**
     * The homepage hero, uploaded in wp-admin under "Kandi Storefront".
     *
     * Empty is the meaningful default, not a missing value: with no image the
     * storefront renders its own hero out of live text (see
     * `components/home/HeroBanner.tsx`). An upload replaces that slot outright.
     *
     * `image_mobile_url` is a second, taller crop shown below 768px. It is
     * optional and falls back to the wide one — but a 2.4:1 banner on a 390px
     * phone is ~160px tall, which puts any wording designed into it at about
     * 13px, so a shop that uploads only the wide one is shipping an
     * unreadable headline to most of its traffic.
     *
     * `image_alt` is what the banner SAYS. The words in an uploaded banner are
     * pixels — invisible to Google, to a screen reader, and to anyone whose
     * image request fails — and this is the only textual form of them.
     */
    image_url: string;
    image_mobile_url: string;
    image_href: string;
    image_alt: string;
  };
  support: {
    phone: string;
    email: string;
    hours: string;
    address: string;
    whatsapp: string;
  };
  /** Mobile apps. `available` gates the store badges between link and "coming soon". */
  app: { available: boolean; ios_url: string; android_url: string };
  social: Partial<Record<"facebook" | "instagram" | "tiktok" | "x", string>>;
  commerce: { free_delivery_from: number; returns_days: number };
  /** Terms quoted on the sell-with-us landing page and through onboarding. */
  seller: {
    registration_fee: number;
    commission_rate: number;
    payout_days: number;
    pay_number: string;
    pay_name: string;
  };
};

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: {
    name: "Kandi",
    suffix: "For Less",
    tagline: "Fashion for less, delivered across Uganda",
    logo_url: "",
    favicon_url: "",
  },
  promo: {
    lines: [
      "FREE delivery on orders over UGX 50,000",
      "Pay on delivery",
      "14-day free returns",
    ],
    cta_label: "Up to 80% off",
    cta_url: "/sale",
  },
  /* Four lines, and every one of them is something the checkout actually does.
     "100% authentic brands, checked before dispatch" used to be the fourth and
     it was the odd one out — a superlative wrapped around a claim nobody can
     verify, in a list where the other three are terms a shopper can hold the
     shop to. It is replaced by what the shop genuinely does instead: vetting
     the sellers. "No questions asked" went the same way; the returns page does
     ask questions, and promising otherwise in a ticker is a promise support
     has to break. */
  ticker: [
    "FREE delivery on orders over UGX 50,000",
    "Pay on delivery — cash, MTN MoMo or Airtel Money",
    "14 days to send an item back",
    "Every seller vetted before they can list",
  ],
  // No invented campaigns. An empty list makes the homepage derive its own from
  // the catalogue, which is always true; a default "Christmas Sale" here would
  // be live on every shop that never opened the settings screen.
  promotions: [],
  banner: {
    eyebrow: "Super Price Store",
    headline: "Up to 80% off RRP",
    cta_label: "Shop now",
    cta_url: "/sale",
    // Blank on purpose, and for the same reason `promotions` is empty above: a
    // default here would be a banner live on every shop that never opened the
    // settings screen. Blank means the built-in text hero, which is always
    // true and always readable.
    image_url: "",
    image_mobile_url: "",
    image_href: "/sale",
    image_alt: "",
  },
  support: {
    phone: "0200 804 020",
    email: "support@kandiug.com",
    hours: "Monday to Saturday, 9am – 6pm",
    address: "Kampala, Uganda",
    whatsapp: "",
  },
  app: { available: false, ios_url: "", android_url: "" },
  social: {},
  commerce: { free_delivery_from: 50000, returns_days: 14 },
  seller: {
    registration_fee: 50000,
    commission_rate: 10,
    payout_days: 7,
    pay_number: "",
    pay_name: "",
  },
};

/**
 * How long the shop's settings are reused before WordPress is asked again.
 *
 * ---- Why this one number was slowing down every page in the shop ----
 *
 * `getSiteSettings` is called from the root layout, so it runs on EVERY page —
 * the homepage, all 33 product pages, the static content pages, everything. In
 * Next.js the shortest `revalidate` of any fetch a page makes becomes that
 * page's own revalidate window, so a 60 here was not a setting on one request:
 * it pinned the entire site to a one-minute ISR cycle. The build output said so
 * out loud — every route in the table read "Revalidate 1m", including pages
 * like /about that have no shop data on them at all.
 *
 * That would be a curiosity if the origin were fast. Measured against the live
 * host, `/wp-json/kandi/v1/settings` answers in 0.9s to 4.2s. So the shop was
 * re-rendering every page every minute, and each of those renders blocked on a
 * WordPress call that can take four seconds — which is most of the 1.53s p75
 * TTFB that Speed Insights reports. On the pages that are rendered per request
 * rather than prerendered (/search, /sale, /category/[slug]) an expired window
 * is not refreshed in the background at all: the shopper waits for it.
 *
 * ---- Why an hour is safe ----
 *
 * The window has never been how a settings change reaches the shop. The
 * WordPress plugin pushes to /api/revalidate whenever anything is saved, and
 * that handler calls `revalidatePath("/", "layout")` — which drops the root
 * layout, and therefore this fetch, for every page at once. A shopkeeper who
 * edits the free-delivery figure still sees it on the next page load.
 *
 * This number is only the fallback for when that push cannot get through: the
 * plugin is not installed, or the request was dropped. An hour is a reasonable
 * ceiling for a phone number and a delivery threshold — values that change a
 * few times a year — and it is 60× fewer four-second WordPress calls on the
 * render path than a minute was.
 */
const REVALIDATE_SECONDS = 3600;

function str(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? fallback : text;
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function list(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((entry) => String(entry).trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

/**
 * Reads the campaign cards, dropping anything without a headline.
 *
 * No fallback list: an empty result is meaningful — it tells the homepage to
 * work out its own promotions from the catalogue rather than print whatever a
 * default array happened to say.
 */
function promotions(value: unknown): SiteSettings["promotions"] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const promo = (entry ?? {}) as Record<string, unknown>;
      return {
        badge: typeof promo.badge === "string" ? promo.badge.trim() : "",
        headline: typeof promo.headline === "string" ? promo.headline.trim() : "",
        note: typeof promo.note === "string" ? promo.note.trim() : "",
        url: typeof promo.url === "string" && promo.url.trim() ? promo.url.trim() : "/sale",
      };
    })
    .filter((promo) => promo.headline !== "")
    .slice(0, 6);
}

/** Merges the WordPress payload over the defaults, field by field. */
function merge(raw: unknown): SiteSettings {
  const payload = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const d = DEFAULT_SETTINGS;
  const brand = payload.brand ?? {};
  const promo = payload.promo ?? {};
  const banner = payload.banner ?? {};
  const support = payload.support ?? {};
  const commerce = payload.commerce ?? {};
  const app = payload.app ?? {};
  const seller = payload.seller ?? {};

  const iosUrl = typeof app.ios_url === "string" ? app.ios_url.trim() : "";
  const androidUrl = typeof app.android_url === "string" ? app.android_url.trim() : "";

  return {
    brand: {
      name: str(brand.name, d.brand.name),
      // Trimmed, so the join in `brandName` is the only thing deciding the
      // spacing — a suffix saved as " For Less" in wp-admin must not produce a
      // double space in every page title.
      suffix: str(brand.suffix, d.brand.suffix).trim(),
      tagline: str(brand.tagline, d.brand.tagline),
      // No fallback: an empty logo means "use the wordmark".
      logo_url: typeof brand.logo_url === "string" ? brand.logo_url.trim() : "",
      favicon_url: typeof brand.favicon_url === "string" ? brand.favicon_url.trim() : "",
    },
    promo: {
      lines: list(promo.lines, d.promo.lines),
      cta_label: str(promo.cta_label, d.promo.cta_label),
      cta_url: str(promo.cta_url, d.promo.cta_url),
    },
    ticker: list(payload.ticker, d.ticker),
    promotions: promotions(payload.promotions),
    banner: {
      eyebrow: str(banner.eyebrow, d.banner.eyebrow),
      headline: str(banner.headline, d.banner.headline),
      cta_label: str(banner.cta_label, d.banner.cta_label),
      cta_url: str(banner.cta_url, d.banner.cta_url),
      /* Not `str(…, default)` like the fields above, and the difference
         matters. `str` falls back to the default when the value is blank,
         which is right for wording — a shop that clears its headline wants
         the shipped one, not nothing.

         These are the opposite: blank means "no uploaded banner, draw the
         built-in hero instead", so a fallback would make the image
         impossible to REMOVE once set. Cleared in wp-admin has to arrive
         here as an empty string. */
      image_url: typeof banner.image_url === "string" ? banner.image_url.trim() : "",
      image_mobile_url:
        typeof banner.image_mobile_url === "string" ? banner.image_mobile_url.trim() : "",
      // The link does take a fallback: a banner with no destination is a dead
      // image, and /sale is the safe answer for a hero that is about price.
      image_href: str(banner.image_href, d.banner.image_href),
      image_alt: typeof banner.image_alt === "string" ? banner.image_alt.trim() : "",
    },
    support: {
      phone: str(support.phone, d.support.phone),
      email: str(support.email, d.support.email),
      hours: str(support.hours, d.support.hours),
      address: str(support.address, d.support.address),
      whatsapp: typeof support.whatsapp === "string" ? support.whatsapp.trim() : "",
    },
    app: {
      // Belt and braces: the badges only become links when the shop says the
      // app is live *and* there is somewhere to send people.
      available: Boolean(app.available) && Boolean(iosUrl || androidUrl),
      ios_url: iosUrl,
      android_url: androidUrl,
    },
    social: (payload.social ?? {}) as SiteSettings["social"],
    commerce: {
      free_delivery_from: num(commerce.free_delivery_from, d.commerce.free_delivery_from),
      returns_days: num(commerce.returns_days, d.commerce.returns_days),
    },
    seller: {
      // A zero fee is a real, meaningful value here — "registration is free" —
      // so it cannot go through `num`, which treats 0 as missing.
      registration_fee: Number.isFinite(Number(seller.registration_fee))
        ? Math.max(0, Number(seller.registration_fee))
        : d.seller.registration_fee,
      commission_rate: num(seller.commission_rate, d.seller.commission_rate),
      payout_days: num(seller.payout_days, d.seller.payout_days),
      pay_number: str(seller.pay_number, ""),
      pay_name: str(seller.pay_name, ""),
    },
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const base = process.env.WP_API_URL;
  if (!base) return DEFAULT_SETTINGS;

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/settings`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return DEFAULT_SETTINGS;
    return merge(await response.json());
  } catch {
    // The plugin may not be installed yet, or WordPress may be down. Branding
    // is never worth failing a page render over.
    return DEFAULT_SETTINGS;
  }
}

/* ------------------------------------------------------------------- favicon */

/**
 * There is deliberately no favicon logic here any more.
 *
 * `getFaviconUrl` used to read `brand.favicon_url`, fetch the PNG to measure
 * its IHDR, and decline anything more lopsided than 1.6:1 — because a wordmark
 * uploaded to the favicon field paints as a blank 16px tab, which is a bug this
 * shop actually shipped. All of that existed to make an arbitrary upload safe
 * to hand to Google's favicon crawler.
 *
 * The icon is a file in the repository now (`public/icon.png`), so none of it
 * applies: it is square, it is the right size, and it cannot fail to load.
 * `brand.favicon_url` is still parsed below because the wp-admin plugin still
 * sends the field, but nothing consumes it. See the icon note in
 * `app/layout.tsx` for the reasoning.
 */

/* ------------------------------------------------------------------ delivery */

/**
 * The shop's delivery rates, from wp-admin.
 *
 * Kept out of `SiteSettings` deliberately. That object is fetched by the layout
 * on every page and is fine to expose; these are pricing inputs and are only
 * ever read on the server, inside the quote route and when an order is priced.
 *
 * Any field the shop has not set falls back to `DEFAULT_RATES`, so a fresh
 * install quotes sensible Kampala figures rather than zero.
 */
export async function getDeliveryRates(): Promise<DeliveryRates> {
  const settings = await getSiteSettings();
  const raw = (settings as unknown as { delivery?: Partial<DeliveryRates> }).delivery ?? {};

  const pick = (value: unknown, fallback: number) =>
    Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

  return {
    origin: {
      lat: pick(raw.origin?.lat, DEFAULT_RATES.origin.lat),
      lng: pick(raw.origin?.lng, DEFAULT_RATES.origin.lng),
    },
    baseFee: pick(raw.baseFee, DEFAULT_RATES.baseFee),
    perKm: pick(raw.perKm, DEFAULT_RATES.perKm),
    freeRadiusKm: pick(raw.freeRadiusKm, DEFAULT_RATES.freeRadiusKm),
    maxFee: pick(raw.maxFee, DEFAULT_RATES.maxFee),
    maxDistanceKm: pick(raw.maxDistanceKm, DEFAULT_RATES.maxDistanceKm),
    // The free-delivery threshold is already a published commerce term, so it
    // comes from there rather than being configured twice and drifting.
    freeDeliveryFrom: settings.commerce.free_delivery_from,
  };
}

/**
 * The shop's full name — brand plus suffix, with a space between them.
 *
 * This exists because there wasn't one. Four call sites each built the name by
 * hand, and they did not agree: the header interpolated `${name} ${suffix}`,
 * while the layout and the site JSON-LD interpolated `${name}${suffix}` with no
 * separator. With the shipped settings that produced **"KandiFor Less"** in the
 * `<title>` of every page on the site, in the Open Graph card of every shared
 * link, and in the `OnlineStore` name Google reads to learn what the shop is
 * called — while the logo beside it read "Kandi For Less" correctly.
 *
 * A brand name misspelt in the title tag is not cosmetic. It is the string the
 * shop ranks for on its own name, the one a returning shopper types, and the
 * one that has to match across the site for Google to treat the mentions as the
 * same entity.
 *
 * `filter(Boolean)` so a shop that clears the suffix in wp-admin gets "Kandi"
 * rather than "Kandi " with a trailing space.
 */
export function brandName(settings: SiteSettings): string {
  return [settings.brand.name, settings.brand.suffix].filter(Boolean).join(" ");
}
