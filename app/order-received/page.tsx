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
    <main className="mx-auto max-w-2xl px-4 py-20">
      <div className="border border-bfl-line bg-white px-6 py-12 text-center md:px-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bfl-yellow">
          <svg className="h-7 w-7" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </span>

        <h1 className="mt-5 text-[21px] font-extrabold text-black">Order received</h1>
        <p className="mt-2 text-[14px] text-bfl-grey">Thank you for shopping with Kandi.</p>

        {id && (
          <div className="mx-auto mt-6 max-w-sm border border-bfl-line bg-bfl-surface px-5 py-4 text-[15px]">
            <div className="flex items-baseline justify-between">
              <span className="text-bfl-grey">Order number</span>
              <span className="font-semibold text-black">#{id}</span>
            </div>
            {total && Number(total) > 0 && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-bfl-grey">Order total</span>
                <span className="font-semibold text-black">{formatPrice(Number(total))}</span>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-[14px] leading-6 text-bfl-grey">
          We&apos;ll call you shortly to confirm delivery — you pay when your order arrives.
          If you gave us an email address, check your inbox: we&apos;ve created your Kandi account
          and sent a link to set your password.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-bfl px-8 py-3 text-[15px]">
            Continue shopping
          </Link>
          <Link
            href="/track-order"
            className="border border-bfl-line px-8 py-3 text-[15px] font-semibold text-[#333] transition-colors hover:border-black"
          >
            Track your order
          </Link>
        </div>
      </div>
    </main>
  );
}
