"use client";

import Link from "next/link";
import { useState, useEffect, use } from "react";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import AddToCartButton from "@/components/AddToCartButton";
import ImageGallery from "@/components/ImageGallery";
import ProductCarousel from "@/components/ProductCarousel";
import FollowBrand from "@/components/FollowBrand";
import InfoModal from "@/components/InfoModal";
import ReviewSection from "@/components/ReviewSection";
import TrustStrip from "@/components/TrustStrip";
import DeliveryPromise from "@/components/DeliveryPromise";

const NEW_WINDOW_DAYS = 30;

type Modal = "delivery" | "sizing" | "rrp" | null;

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
      if (!response.ok || cancelled) return;
      const data = (await response.json()) as { product: Product; related: Product[] };
      if (cancelled) return;

      setProduct(data.product);
      setRelated(data.related);
      setActiveImage(data.product.image);
      // Read the clock here rather than during render, which must stay pure.
      setIsNew(
        data.product.date_created
          ? Date.now() - new Date(data.product.date_created).getTime() <
              NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
          : false
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!product) {
    return (
      <main className="mx-auto max-w-[1280px] px-4 py-20 text-center text-sm text-bfl-grey md:px-8">
        Loading product…
      </main>
    );
  }

  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0];
  const subCategory = product.categories[1];
  const images = [product.image, ...product.gallery].filter(Boolean);
  const colorAttribute = product.attributes?.find(
    (attr) => attr.name.toLowerCase() === "color"
  );

  // Derived from the product id so the figure is stable across renders and
  // between server and client — never a random number.
  const viewers = 120 + ((product.id * 37) % 260);

  const detailRows: [string, string][] = [
    ...(product.attributes ?? []).map(
      (attr) =>
        [attr.name, attr.options.map((option) => option.name).join(", ")] as [string, string]
    ),
    ["Care", "Machine washable"],
    brand ? (["Ideal For", brand.name] as [string, string]) : null,
    [
      "Disclaimer",
      "Product color may slightly vary due to photographic lighting sources or your monitor settings.",
    ],
    ["Occasion", "Casual"],
    [
      "Availability",
      product.stock_status === "instock"
        ? product.stock_quantity !== null && product.stock_quantity <= 20
          ? `In stock — only ${product.stock_quantity} left`
          : "In stock"
        : product.stock_status === "onbackorder"
          ? "On backorder"
          : "Sold out",
    ],
  ].filter((row): row is [string, string] => row !== null && Boolean(row[1]));

  const handleOptionChange = (name: string, value: string | null) => {
    if (name.toLowerCase() === "color" && value && colorAttribute) {
      const optionWithImage = colorAttribute.options.find(
        (opt) => opt.name === value && opt.image
      );
      setActiveImage(optionWithImage?.image ?? product.image);
    }
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-3 md:px-8 lg:pb-12">
      {/* Breadcrumbs */}
      <nav className="mb-5 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 text-[13px] text-[#555] no-scrollbar">
        <Link href="/" className="hover:text-black hover:underline">
          Home
        </Link>
        {brand && (
          <>
            <Chevron />
            <Link href={`/category/${brand.slug}`} className="hover:text-black hover:underline">
              {brand.name}
            </Link>
          </>
        )}
        {subCategory && (
          <>
            <Chevron />
            <Link href={`/category/${subCategory.slug}`} className="hover:text-black hover:underline">
              {subCategory.name}
            </Link>
          </>
        )}
        <Chevron />
        <span className="text-black">{product.name}</span>
      </nav>

      {/* Gallery + buy box */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-12">
        <ImageGallery
          images={images}
          productName={product.name}
          activeImage={activeImage}
          setActiveImage={setActiveImage}
          isNew={isNew}
          discount={discount}
          superPrice={discount >= 50}
        />

        <div>
          {/* Brand */}
          {brand && (
            <Link
              href={`/category/${brand.slug}`}
              className="text-[18px] font-medium text-bfl-ink hover:underline"
            >
              {brand.name}
            </Link>
          )}

          {/* Title */}
          <h1 className="mt-2 text-[23px] font-normal leading-snug text-bfl-ink md:text-[25px]">
            {product.name}
          </h1>

          {/* Price */}
          <div className="mt-5 flex items-baseline gap-3">
            <span className={`text-[22px] font-bold ${discount > 0 ? "text-bfl-red" : "text-black"}`}>
              {formatPrice(product.price)}
            </span>
            {discount > 0 && (
              <span className="text-[15px] text-bfl-grey line-through">
                {formatPrice(product.regular_price)}
              </span>
            )}
          </div>

          {discount > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-bfl-grey">
              RRP: <span>{formatPrice(product.regular_price)}</span>
              <span className="font-bold text-bfl-red">({discount}% OFF)</span>
              <button
                type="button"
                onClick={() => setModal("rrp")}
                aria-label="What is RRP?"
                className="flex h-4 w-4 items-center justify-center rounded-full border border-bfl-grey text-[10px] leading-none text-bfl-grey hover:border-black hover:text-black"
              >
                ?
              </button>
            </p>
          )}
          <p className="mt-0.5 text-[12px] text-bfl-grey">(Incl. VAT)</p>

          {/* Delivery promise */}
          <DeliveryPromise className="mt-4" />

          {/* Social proof */}
          <div className="mt-3 flex items-center gap-3 bg-[#1c1c1c] px-4 py-3 text-white">
            <span aria-hidden className="text-[18px] leading-none">
              🔥
            </span>
            <p className="text-[14px]">
              <span className="font-bold">Trending Now!</span> {viewers} people viewed this product
              recently
            </p>
          </div>

          {/* Info links */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button type="button" onClick={() => setModal("delivery")} className="link-bfl text-[14px]">
              Delivery and returns Info
            </button>
            <button
              type="button"
              onClick={() => setModal("sizing")}
              className="link-bfl flex items-center gap-2 text-[14px]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 3v3m0 0L3.5 15.5h17L12 10.5Z" />
              </svg>
              Need sizing help?
            </button>
          </div>

          {/* Options + add to cart */}
          <div className="mt-6">
            <AddToCartButton product={product} onOptionChange={handleOptionChange} />
          </div>

          {/* Pay in instalments */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { name: "MTN MoMo Pay", copy: "Split into 4 payments on orders above UGX 100,000" },
              { name: "Airtel Pay Later", copy: "Split into 4 payments on orders above UGX 100,000" },
            ].map((option) => (
              <div key={option.name} className="border border-bfl-line px-4 py-3 text-center">
                <p className="text-[12px] leading-4 text-bfl-grey">{option.copy}</p>
                <p className="mt-2 text-[13px] font-bold text-bfl-ink">{option.name}</p>
              </div>
            ))}
          </div>

          {/* Follow the store, or the brand when the listing has no seller */}
          {product.seller ? (
            <FollowBrand
              brandName={product.seller.store_name}
              subtitle="Sold and dispatched by this store"
            />
          ) : (
            brand && <FollowBrand brandName={brand.name} />
          )}

          {/* Trust strip */}
          <TrustStrip className="mt-5" />

          {/* Product details */}
          <section className="mt-9">
            <h2 className="inline-block border-b-[3px] border-bfl-yellow pb-2 text-[16px] font-medium text-black">
              Product Details
            </h2>
            <div className="-mt-px border-b border-bfl-line" />

            <ul className="mt-4 list-disc pl-5 text-[13px] text-[#333]">
              <li>Style Code: KD-{product.id}</li>
              {product.short_description && <li>{product.short_description}</li>}
            </ul>

            <table className="mt-4 w-full text-[13px]">
              <tbody>
                {detailRows.map(([label, value], i) => (
                  <tr key={label} className={i % 2 === 0 ? "bg-bfl-surface" : "bg-white"}>
                    <td className="w-2/5 px-4 py-3 align-top text-[#333]">{label}</td>
                    <td className="px-4 py-3 align-top text-[#333]">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {product.description && (
              <div
                className="mt-5 text-[13px] leading-6 text-[#444] [&_p]:my-2.5"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            )}
          </section>
        </div>
      </div>

      <ProductCarousel title="You May Also Like" products={related} />

      <ReviewSection totalReviews={162} averageRating={4.5} />

      {/* Info dialogs */}
      <InfoModal open={modal === "delivery"} title="Delivery and returns" onClose={() => setModal(null)}>
        <p className="font-bold text-black">Delivery</p>
        <p>
          Standard delivery across Uganda takes 1–3 business days. Delivery is free on orders over{" "}
          {formatPrice(50000)}; below that a flat fee applies at checkout.
        </p>
        <p className="mt-4 font-bold text-black">Payment</p>
        <p>Pay on delivery with cash, MTN Mobile Money, Airtel Money, or by card at checkout.</p>
        <p className="mt-4 font-bold text-black">Returns</p>
        <p>
          Items can be returned within 14 days of delivery in their original condition with tags
          attached. Underwear, swimwear and pierced jewellery cannot be returned for hygiene reasons.
        </p>
      </InfoModal>

      <InfoModal open={modal === "sizing"} title="Need sizing help?" onClose={() => setModal(null)}>
        <p>
          Sizes follow the brand&apos;s own chart, so they can differ slightly between labels. If you are
          between sizes we recommend going one size up.
        </p>
        <table className="mt-4 w-full border border-bfl-line text-[13px]">
          <thead>
            <tr className="bg-bfl-surface text-left">
              <th className="px-3 py-2 font-bold">Size</th>
              <th className="px-3 py-2 font-bold">Chest (cm)</th>
              <th className="px-3 py-2 font-bold">Waist (cm)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["XS", "82–86", "66–70"],
              ["S", "86–92", "70–76"],
              ["M", "92–98", "76–82"],
              ["L", "98–104", "82–88"],
              ["XL", "104–112", "88–96"],
            ].map(([size, chest, waist]) => (
              <tr key={size} className="border-t border-bfl-line">
                <td className="px-3 py-2 font-bold">{size}</td>
                <td className="px-3 py-2">{chest}</td>
                <td className="px-3 py-2">{waist}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </InfoModal>

      <InfoModal open={modal === "rrp"} title="What is RRP?" onClose={() => setModal(null)}>
        <p>
          RRP is the Recommended Retail Price — the price the brand suggests the item is sold at in
          full-price retail. The discount shown is the saving against that RRP.
        </p>
      </InfoModal>
    </main>
  );
}

function Chevron() {
  return (
    <svg className="h-3 w-3 shrink-0 text-[#999]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  );
}
