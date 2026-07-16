import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">🛒</p>
      <h1 className="text-2xl font-bold mb-2">Product not found</h1>
      <p className="text-gray-600 mb-6">
        It may have been removed or is no longer available.
      </p>
      <Link
        href="/"
        className="inline-block bg-kandi hover:bg-kandi-dark text-white font-semibold px-6 py-3 rounded-md"
      >
        Continue shopping
      </Link>
    </main>
  );
}
