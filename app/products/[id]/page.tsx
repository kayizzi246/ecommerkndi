import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProductsSafe } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import AddToCartButton from "@/components/AddToCartButton";
import ProductCard from "@/components/ProductCard";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(Number(id));

  if (!product) {
    notFound();
  }

  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0];
  const images = [product.image, ...product.gallery].filter(Boolean);

  const related = brand
    ? (await getProductsSafe({ category: brand.slug, per_page: 5 })).products
        .filter((p) => p.id !== product.id)
        .slice(0, 4)
    : [];

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-5">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-6 border-b border-gray-100 pb-4">
        <Link href="/" className="hover:underline">Home</Link>
        {brand && (
          <>
            {" › "}
            <Link href={`/category/${brand.slug}`} className="hover:underline">
              {brand.name}
            </Link>
          </>
        )}
        {" › "}
        <span className="text-gray-800">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Gallery: thumbnails + main image */}
        <div className="flex gap-4">
          {images.length > 1 && (
            <div className="flex flex-col gap-3 shrink-0">
              {images.slice(0, 5).map((src, i) => (
                <div
                  key={src}
                  className={`relative w-16 h-16 md:w-20 md:h-20 bg-[#f5f5f5] border ${
                    i === 0 ? "border-black" : "border-transparent"
                  }`}
                >
                  <Image
                    src={src}
                    alt={`${product.name} view ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="relative flex-1 aspect-square bg-[#f5f5f5]">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-contain p-6"
              priority
            />
            {discount > 0 && (
              <span className="absolute top-4 right-4 bg-sale text-white text-sm font-bold px-3 py-1.5">
                {discount}% OFF
              </span>
            )}
            {product.on_sale && (
              <span className="absolute bottom-4 left-4 bg-sale text-white text-xs font-bold uppercase px-3 py-1.5">
                Super Price
              </span>
            )}
          </div>
        </div>

        {/* Details column */}
        <div>
          {brand && (
            <p className="text-2xl font-extrabold">{brand.name}</p>
          )}
          <h1 className="text-xl md:text-2xl text-gray-800 mt-1">
            {product.name}
          </h1>

          <div className="mt-5 flex items-baseline gap-3">
            <p className={`font-heading text-3xl font-bold ${discount > 0 ? "text-sale" : ""}`}>
              {formatPrice(product.price)}
            </p>
            {discount > 0 && (
              <p className="text-gray-400 line-through">
                {formatPrice(product.regular_price)}
              </p>
            )}
          </div>
          {discount > 0 && (
            <p className="text-sm mt-1">
              <span className="text-gray-500">
                RRP: {formatPrice(product.regular_price)}
              </span>{" "}
              <span className="text-sale font-bold">({discount}% OFF)</span>
            </p>
          )}

          <p className="mt-2 text-sm">
            {product.stock_status === "instock" ? (
              <span className="text-fresh font-bold">
                In stock
                {product.stock_quantity !== null &&
                  product.stock_quantity <= 20 &&
                  ` — only ${product.stock_quantity} left`}
              </span>
            ) : product.stock_status === "onbackorder" ? (
              <span className="text-amber-600 font-bold">On backorder</span>
            ) : (
              <span className="text-sale font-bold">Sold out</span>
            )}
          </p>

          <p className="mt-4 text-sm">
            <a href="#delivery-info" className="font-semibold underline underline-offset-4 hover:text-gray-600">
              Delivery and returns info
            </a>
          </p>

          {product.short_description && (
            <p className="text-sm text-gray-600 leading-relaxed mt-4">
              {product.short_description}
            </p>
          )}

          <div className="mt-7">
            <AddToCartButton product={product} />
          </div>

          {/* Brand follow box */}
          {brand && (
            <div className="mt-8 border border-gray-200 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">{brand.name}</p>
                <p className="text-sm text-gray-500">
                  Explore more from this collection
                </p>
              </div>
              <Link
                href={`/category/${brand.slug}`}
                className="border border-black px-6 py-2 text-sm font-bold hover:bg-black hover:text-white transition-colors shrink-0"
              >
                View all
              </Link>
            </div>
          )}

          <ul
            id="delivery-info"
            className="mt-6 text-sm text-gray-600 space-y-2 border-t border-gray-100 pt-5"
          >
            <li>🚚 Fast delivery across Uganda</li>
            <li>💵 Pay on delivery — cash or mobile money</li>
            <li>📞 Call to order: 0200 804 020</li>
          </ul>
        </div>
      </div>

      {/* Product details spec table */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-extrabold border-b-2 border-sun inline-block pb-1 mb-5">
          Product Details
        </h2>

        {product.description && (
          <div
            className="text-sm text-gray-700 leading-relaxed [&_p]:my-3 mb-6"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        )}

        <table className="w-full text-sm">
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
                <tr key={label} className={i % 2 === 0 ? "bg-gray-100" : "bg-white"}>
                  <td className="px-4 py-3 font-semibold w-1/3">{label}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{value}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {related.length > 0 && (
        <section className="mt-14 border-t border-gray-200 pt-10">
          <h2 className="text-xl font-extrabold mb-6">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
