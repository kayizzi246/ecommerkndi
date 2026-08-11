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
  banner: { eyebrow: string; headline: string; cta_label: string; cta_url: string };
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
  ticker: [
    "FREE delivery on orders over UGX 50,000",
    "Pay on delivery — cash, MTN MoMo or Airtel Money",
    "14-day free returns, no questions asked",
    "100% authentic brands, checked before dispatch",
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

const REVALIDATE_SECONDS = 60;

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
      suffix: str(brand.suffix, d.brand.suffix),
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

/** Beyond this ratio an image is a wordmark, not an icon. */
const MAX_ICON_RATIO = 1.6;

/** Reads width and height out of a PNG's IHDR, which is always the first chunk. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (!isPng) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * The favicon to advertise, or null to fall back to the icons shipped in `app/`.
 *
 * A browser paints the tab icon into a 16px square. Given a wide image it either
 * squashes it or, in several browsers, gives up and shows nothing — which is
 * exactly what happened here: the shop had uploaded its 1584×512 wordmark to the
 * favicon field, and the tab came up blank while the file itself was perfectly
 * valid. So a non-square upload is declined in favour of the built-in mark
 * rather than passed on to be mangled.
 *
 * Only PNGs are measured. `.ico` and `.svg` are formats made for this slot and
 * are trusted; anything else is trusted too, on the grounds that guessing wrong
 * about a shop's own branding is worse than an odd-looking tab.
 *
 * The response is cached for an hour, so this costs one request per hour rather
 * than one per render, and a failure just falls back — a favicon is never worth
 * failing a page over.
 */
export async function getFaviconUrl(): Promise<string | null> {
  const { favicon_url: url } = (await getSiteSettings()).brand;
  if (!url) return null;

  if (!/\.png(\?|$)/i.test(url)) return url;

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return null;

    const size = pngSize(new Uint8Array(await response.arrayBuffer()));
    if (!size || size.width === 0 || size.height === 0) return url;

    const ratio = Math.max(size.width / size.height, size.height / size.width);
    return ratio > MAX_ICON_RATIO ? null : url;
  } catch {
    return null;
  }
}

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
