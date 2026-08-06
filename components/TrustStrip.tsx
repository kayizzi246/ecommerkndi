const PROMISES = [
  { title: "Free Delivery", copy: "on UGX 50,000+ orders" },
  { title: "Free Return", copy: "within 14 days" },
  { title: "100% Authentic", copy: "international brands" },
];

/** The green three-column reassurance band under the buy box. */
export default function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-3 divide-x divide-white/40 bg-[#e4f5e6] ${className}`}>
      {PROMISES.map((promise) => (
        <div key={promise.title} className="px-2 py-3 text-center">
          <p className="text-[14px] font-bold leading-tight text-[#0a7a2f]">{promise.title}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-[#3a6b45]">{promise.copy}</p>
        </div>
      ))}
    </div>
  );
}
