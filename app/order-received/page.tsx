import Link from "next/link";
import { formatPrice } from "@/lib/currency";

export const metadata = { title: "Order received" };

export default async function OrderReceivedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; total?: string }>;
}) {
  const { id, total } = await searchParams;

  return (
    <main className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="text-[11px] tracking-[0.4em] uppercase text-gray-500 mb-4">
        Thank you
      </p>
      <h1 className="text-2xl md:text-3xl tracking-[0.2em] uppercase font-semibold mb-4">
        Order received
      </h1>
      {id && (
        <p className="text-sm text-gray-700 mb-2">
          Your order number is <span className="font-bold">#{id}</span>
          {total && Number(total) > 0 && (
            <>
              {" "}— total <span className="font-bold">{formatPrice(Number(total))}</span>
            </>
          )}
          .
        </p>
      )}
      <p className="text-sm text-gray-500 mb-3">
        We&apos;ll call you shortly to confirm delivery. You pay when your
        order arrives.
      </p>
      <p className="text-sm text-gray-500 mb-10">
        If you provided an email, check your inbox — we&apos;ve created your
        Kandi account and sent a link to set your password.
      </p>
      <Link
        href="/"
        className="inline-block bg-black text-white text-xs tracking-[0.25em] uppercase px-10 py-4 hover:bg-gray-800 transition-colors"
      >
        Continue shopping
      </Link>
    </main>
  );
}
