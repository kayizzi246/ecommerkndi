"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, use } from "react";
import { getProduct, getProductsSafe, Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import AddToCartButton from "@/components/AddToCartButton";
import ProductCard from "@/components/ProductCard";
import ImageGallery from "@/components/ImageGallery";
import ReviewSection from "@/components/ReviewSection";
import StarRating from "@/components/StarRating";

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const fetchedProduct = await getProduct(Number(id));
      setProduct(fetchedProduct);

      if (fetchedProduct) {
        setActiveImage(fetchedProduct.image);
        const brand = fetchedProduct.categories[0];
        if (brand) {
          const relatedRes = await getProductsSafe({ category: brand.slug, per_page: 6 });
          const filteredRelated = relatedRes.products
            .filter((p) => p.id !== fetchedProduct.id)
            .slice(0, 5);
          setRelated(filteredRelated);
        }
      }
    }
    fetchData();
  }, [id]);

  if (!product) {
    // You can return a loading skeleton here
    return <main className="max-w-7xl mx-auto px-4 md:px-8 py-4 pb-24 lg:pb-8">Loading...</main>;
  }

  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0];
  const images = [product.image, ...product.gallery].filter(Boolean);
  const colorAttribute = product.attributes?.find(attr => attr.name.toLowerCase() === 'color');
  const simulatedRating = 4.5;
  const simulatedReviews = 162;

  const handleOptionChange = (name: string, value: string | null) => {
    if (name.toLowerCase() === 'color' && value && colorAttribute) {
      const optionWithImage = colorAttribute.options.find(opt => opt.name === value && opt.image);
      if (optionWithImage && optionWithImage.image) {
        setActiveImage(optionWithImage.image);
      } else {
        setActiveImage(product.image); // Fallback to main image
      }
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-4 pb-24 lg:pb-8">
      {/* Breadcrumbs */}
      <nav className="text-xs text-gray-500 mb-4 pb-3 border-b border-gray-100 overflow-x-auto whitespace-nowrap no-scrollbar">
        <Link href="/" className="hover:text-market transition-colors">Home</Link>
        {brand && <> <span className="mx-1.5">/</span> <Link href={`/category/${brand.slug}`} className="hover:text-market transition-colors">{brand.name}</Link> </>}
        <span className="mx-1.5">/</span>
        <span className="text-gray-800 font-medium">{product.name}</span>
      </nav>

      {/* Product main section */}
      <div className="grid gap-8 lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_520px]">
        {/* Gallery */}
        <ImageGallery images={images} productName={product.name} activeImage={activeImage} setActiveImage={setActiveImage} />

        {/* Product info column */}
        <div>
          {/* Brand */}
          {brand && (
            <p className="text-sm font-bold text-market uppercase tracking-wider mb-1">
              {brand.name}
            </p>
          )}

          {/* Title */}
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">
            {product.name}
          </h1>

          {/* Rating row */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-bold text-market">{simulatedRating.toFixed(1)}</span>
            <StarRating rating={simulatedRating} size="sm" />
            <span className="text-xs text-gray-500">({simulatedReviews} reviews)</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-500">
              {simulatedReviews > 999
                ? `${(simulatedReviews / 1000).toFixed(1)}k`
                : simulatedReviews}{" "}
              sold
            </span>
          </div>

          {/* Price block */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-extrabold text-market">
                {formatPrice(product.price)}
              </span>
              {discount > 0 && (
                <span className="text-sm text-gray-400 line-through">
                  {formatPrice(product.regular_price)}
                </span>
              )}
            </div>
            {discount > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-market/10 text-market text-xs font-bold px-2 py-0.5 rounded">
                  -{discount}%
                </span>
                <span className="text-xs text-gray-500">
                  You save {formatPrice(product.regular_price - product.price)}
                </span>
              </div>
            )}
          </div>

          {/* Stock status */}
          <div className="mt-3 flex items-center gap-2">
            {product.stock_status === "instock" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-fresh" />
                <span className="text-sm text-fresh font-medium">
                  In stock
                  {product.stock_quantity !== null &&
                    product.stock_quantity <= 20 &&
                    ` — only ${product.stock_quantity} left`}
                </span>
              </>
            ) : product.stock_status === "onbackorder" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm text-amber-600 font-medium">On backorder</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm text-market font-medium">Sold out</span>
              </>
            )}
          </div>

          {/* Shipping info panel */}
          <div className="mt-4 border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-fresh">🚚</span>
              <span>
                <span className="font-semibold">Free shipping</span> on orders over UGX 50,000
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>📦</span>
              <span>Delivery within <span className="font-semibold">1-3 business days</span> across Uganda</span>
            </div>
            <div className="flex items-center gap-2">
              <span>💵</span>
              <span>Pay on delivery — cash, MTN MoMo, Airtel Money</span>
            </div>
          </div>

          {/* Product description */}
          {product.short_description && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              {product.short_description}
            </p>
          )}

          {/* Add to cart section */}
          <div className="mt-5">
            <AddToCartButton product={product} onOptionChange={handleOptionChange} />
          </div>

          {/* Seller / Brand card */}
          {brand && (
            <div className="mt-5 border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 shrink-0">
                  {brand.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold">{brand.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <StarRating rating={4.5} size="sm" showCount={false} />
                    <span>96% positive</span>
                    <span>·</span>
                    <span>1.2k followers</span>
                  </div>
                </div>
              </div>
              <Link
                href={`/category/${brand.slug}`}
                className="text-xs font-bold text-market hover:underline shrink-0"
              >
                View store
              </Link>
            </div>
          )}

          {/* Product details table */}
          <section className="mt-8">
            <h2 className="text-sm font-bold border-b-2 border-market inline-block pb-0.5 mb-4">
              Product Details
            </h2>

            <table className="w-full text-xs">
              <tbody>
                {[
                  ["Style code", `KD-${product.id}`],
                  brand ? ["Category", brand.name] : null,
                  ...(product.attributes ?? []).map(
                    (attr) => [attr.name, attr.options.join(", ")] as [string, string]
                  ),
                  [
                    "Availability",
                    product.stock_status === "instock" ? "In stock" : product.stock_status,
                  ],
                ]
                  .filter((row): row is [string, string] => row !== null)
                  .map(([label, value], i) => (
                    <tr key={label} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <td className="px-3 py-2 font-semibold w-1/3 text-gray-700">{label}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{value}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          {/* Full description */}
          {product.description && (
            <div className="mt-6">
              <h2 className="text-sm font-bold border-b-2 border-market inline-block pb-0.5 mb-3">
                Description
              </h2>
              <div
                className="text-sm text-gray-700 leading-relaxed [&_p]:my-2.5"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <ReviewSection totalReviews={simulatedReviews} averageRating={simulatedRating} />

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-bold mb-5">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
