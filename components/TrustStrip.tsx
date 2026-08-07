const PROMISES = [
  { title: "Free Delivery", copy: "on UGX 50,000+ orders" },
  { title: "Free Return", copy: "within 14 days" },
  { title: "100% Authentic", copy: "international brands" },
];

/** Three-column reassurance band under the buy box. */
export default function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid grid-cols-3 divide-x divide-shop-line rounded-xl border border-shop-line bg-shop-cream ${className}`}
    >
      {PROMISES.map((promise) => (
        <div key={promise.title} className="px-3 py-4 text-center">
          <p className="text-[13px] font-semibold leading-tight text-shop-ink">{promise.title}</p>
          <p className="mt-1 text-[11px] leading-tight text-shop-muted">{promise.copy}</p>
        </div>
      ))}
    </div>
  );
}
