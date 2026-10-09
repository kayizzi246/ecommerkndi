import { getProductsSafe, type Product } from "@/lib/woocommerce";
import { absolute, productPath, siteUrl } from "@/lib/seo";

/**
 * Google Merchant Center product feed, served at /feeds/google.xml.
 *
 * Merchant Center reads this to list the catalogue in Google's free Shopping
 * listings: the Shopping tab, and the product panels shown on searches such as
 * "sneakers in Kampala". Add it in Merchant Center under Products → Feeds as a
 * scheduled fetch of https://kandiug.com/feeds/google.xml.
 *
 * Format: RSS 2.0 with the `g:` namespace, per
 * https://support.google.com/merchants/answer/7052112
 */

export const revalidate = 3600;

const MAX_PRODUCTS = 5000;
const PAGE_SIZE = 100;
const BRAND_ATTRIBUTES = ["brand", "pa_brand", "manufacturer"];

async function allProducts(): Promise<Product[]> {
  const first = await getProductsSafe({ per_page: PAGE_SIZE }).catch(() => null);
  if (!first) return [];
  const products = [...first.products];
  const pages = Math.min(first.total_pages || 1, Math.ceil(MAX_PRODUCTS / PAGE_SIZE));
  for (let page = 2; page <= pages; page++) {
    const next = await getProductsSafe({ per_page: PAGE_SIZE, page }).catch(() => null);
    if (!next || next.products.length === 0) break;
    products.push(...next.products);
  }
  return products;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** WooCommerce descriptions are HTML; the feed wants plain text. */
function plainText(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function availability(product: Product): string {
  if (product.stock_status === "outofstock") return "out_of_stock";
  if (product.stock_status === "onbackorder") return "backorder";
  return "in_stock";
}

function money(amount: number): string {
  return `${Math.round(amount)} UGX`;
}

function brandOf(product: Product): string | null {
  const attribute = product.attributes.find((entry) =>
    BRAND_ATTRIBUTES.includes(entry.name.trim().toLowerCase())
  );
  return attribute?.options[0]?.name?.trim() || null;
}

function item(product: Product): string | null {
  const price = Number(product.price);
  if (!product.image || !(price > 0)) return null;

  const regular = Number(product.regular_price);
  const onSale = product.on_sale && regular > price;
  const description =
    plainText(product.description) || plainText(product.short_description) || product.name;
  const extraImages = product.gallery
    .filter((src) => src && src !== product.image)
    .slice(0, 10);
  const productType = product.categories.map((category) => category.name).join(" > ");
  const brand = brandOf(product);

  const fields: [string, string][] = [
    ["g:id", String(product.id)],
    ["g:title", product.name.trim().slice(0, 150)],
    ["g:description", description.slice(0, 5000)],
    ["g:link", absolute(productPath(product))],
    ["g:image_link", product.image],
    ...extraImages.map((src): [string, string] => ["g:additional_image_link", src]),
    ["g:availability", availability(product)],
    ["g:price", money(onSale ? regular : price)],
    ...(onSale ? [["g:sale_price", money(price)] as [string, string]] : []),
    ["g:condition", "new"],
    ...(brand ? [["g:brand", brand] as [string, string]] : []),
    ["g:identifier_exists", "no"],
    ...(productType ? [["g:product_type", productType] as [string, string]] : []),
  ];

  return [
    "<item>",
    ...fields.map(([tag, value]) => `<${tag}>${escapeXml(value)}</${tag}>`),
    "</item>",
  ].join("");
}

export async function GET() {
  const products = await allProducts();
  const items = products.map(item).filter(Boolean).join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `<channel>\n` +
    `<title>KandiUg</title>\n` +
    `<link>${escapeXml(siteUrl())}</link>\n` +
    `<description>KandiUg products, delivered in Kampala and across Uganda</description>\n` +
    `${items}\n` +
    `</channel>\n` +
    `</rss>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
