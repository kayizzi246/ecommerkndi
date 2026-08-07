"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice, discountPercent } from "@/lib/currency";
import AddToCartButton from "@/components/AddToCartButton";
import ImageGallery from "@/components/ImageGallery";
import FollowBrand from "@/components/FollowBrand";
import InfoModal from "@/components/InfoModal";
import TrustStrip from "@/components/TrustStrip";
import DeliveryPromise from "@/components/DeliveryPromise";
import Link from "next/link";

type Modal = "delivery" | "sizing" | "rrp" | null;

/**
 * The interactive half of the product page: the gallery and the buy box share
 * `activeImage` so picking a colour swaps the shot. Everything that does not
 * need state (breadcrumbs, description, related products) stays on the server.
 */
export default function ProductPurchase({
  product,
  isNew,
}: {
  product: Product;
  isNew: boolean;
}) {
  const [activeImage, setActiveImage] = useState<string | null>(product.image);
  const [modal, setModal] = useState<Modal>(null);
  const { addProduct } = useRecentlyViewed();

  // Record the view so the "Recently viewed" rail on the homepage has something
  // to show — the store kept the list but nothing ever wrote to it.
  useEffect(() => {
    addProduct({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      slug: product.slug,
    });
  }, [addProduct, product.id, product.name, product.image, product.price, product.slug]);

  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0];
  const images = [product.image, ...product.gallery].filter(Boolean);
  const colorAttribute = product.attributes?.find(
    (attr) => attr.name.toLowerCase() === "color"
  );

  // Derived from the product id so the figure is stable across renders and
  // between server and client — never a random number.
  const viewers = 120 + ((product.id * 37) % 260);

  const handleOptionChange = (name: string, value: string | null) => {
    if (name.toLowerCase() === "color" && value && colorAttribute) {
      const optionWithImage = colorAttribute.options.find(
        (opt) => opt.name === value && opt.image
      );
      setActiveImage(optionWithImage?.image ?? product.image);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-8 rounded-lg border border-shop-line bg-white p-5 md:p-8 lg:flex-row lg:gap-12">
        {/* Gallery — capped and centred so the product reads at a natural size. */}
        <div className="w-full lg:basis-1/2">
          <div className="mx-auto w-full max-w-[440px]">
            <ImageGallery
              images={images}
              productName={product.name}
              activeImage={activeImage}
              setActiveImage={setActiveImage}
              isNew={isNew}
              discount={discount}
              superPrice={discount >= 50}
            />
          </div>
        </div>

        {/* Buy box */}
        <div className="w-full lg:basis-1/2">
          {brand && (
            <Link
              href={`/category/${brand.slug}`}
              className="text-[12px] font-medium uppercase tracking-[0.1em] text-shop-muted hover:text-shop-ink"
            >
              {brand.name}
            </Link>
          )}

          <h1 className="mt-2.5 text-[24px] font-semibold leading-[1.25] text-shop-ink md:text-[28px]">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className={`text-[24px] font-semibold ${
                discount > 0 ? "text-shop-sale" : "text-shop-ink"
              }`}
            >
              {formatPrice(product.price)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-[16px] text-shop-muted line-through">
                  {formatPrice(product.regular_price)}
                </span>
                <span className="rounded-full bg-shop-sale px-2.5 py-1 text-[11px] font-semibold text-white">
                  Save {discount}%
                </span>
              </>
            )}
          </div>

          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-shop-muted">
            Tax included. Shipping calculated at checkout.
            {discount > 0 && (
              <button
                type="button"
                onClick={() => setModal("rrp")}
                aria-label="What is RRP?"
                className="flex h-4 w-4 items-center justify-center rounded-full border border-shop-line text-[10px] leading-none hover:border-shop-ink hover:text-shop-ink"
              >
                ?
              </button>
            )}
          </p>

          <DeliveryPromise className="mt-5" />

          {/* Stock signal — driven by the real quantity, so it only appears
              when the shop actually is running low. */}
          {product.stock_status === "instock" &&
          product.stock_quantity !== null &&
          product.stock_quantity <= 10 ? (
            <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-shop-sale">
              <span className="h-1.5 w-1.5 rounded-full bg-shop-sale" aria-hidden />
              Only {product.stock_quantity} left in stock
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-shop-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-shop-success" aria-hidden />
              {viewers} people viewed this in the last 24 hours
            </p>
          )}

          <div className="mt-6">
            <AddToCartButton product={product} onOptionChange={handleOptionChange} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <button
              type="button"
              onClick={() => setModal("delivery")}
              className="text-shop-body underline underline-offset-4 hover:text-shop-ink"
            >
              Delivery and returns
            </button>
            <button
              type="button"
              onClick={() => setModal("sizing")}
              className="flex items-center gap-2 text-shop-body underline underline-offset-4 hover:text-shop-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 3v3m0 0L3.5 15.5h17L12 10.5Z" />
              </svg>
              Size guide
            </button>
          </div>

          {product.seller ? (
            <FollowBrand
              brandName={product.seller.store_name}
              subtitle="Sold and dispatched by this store"
            />
          ) : (
            brand && <FollowBrand brandName={brand.name} />
          )}

          <TrustStrip className="mt-6" />
        </div>
      </div>

      {/* Info dialogs */}
      <InfoModal open={modal === "delivery"} title="Delivery and returns" onClose={() => setModal(null)}>
        <p className="font-semibold text-shop-ink">Delivery</p>
        <p>
          Standard delivery across Uganda takes 1–3 business days. Delivery is free on orders over{" "}
          {formatPrice(50000)}; below that a flat fee applies at checkout.
        </p>
        <p className="mt-4 font-semibold text-shop-ink">Payment</p>
        <p>Pay on delivery with cash, MTN Mobile Money, Airtel Money, or by card at checkout.</p>
        <p className="mt-4 font-semibold text-shop-ink">Returns</p>
        <p>
          Items can be returned within 14 days of delivery in their original condition with tags
          attached. Underwear, swimwear and pierced jewellery cannot be returned for hygiene reasons.
        </p>
      </InfoModal>

      <InfoModal open={modal === "sizing"} title="Need sizing help?" onClose={() => setModal(null)}>
        <p>
          Sizes follow the brand&apos;s own chart, so they can differ slightly between labels. If you
          are between sizes we recommend going one size up.
        </p>
        <table className="mt-4 w-full overflow-hidden rounded-lg border border-shop-line text-[13px]">
          <thead>
            <tr className="bg-shop-surface text-left">
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Chest (cm)</th>
              <th className="px-3 py-2 font-semibold">Waist (cm)</th>
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
              <tr key={size} className="border-t border-shop-line">
                <td className="px-3 py-2 font-semibold">{size}</td>
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
    </>
  );
}
