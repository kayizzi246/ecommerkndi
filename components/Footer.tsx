import Link from "next/link";

const links = [
  { title: "Customer service", items: [{ name: "Help centre", href: "/help" }, { name: "Shipping & delivery", href: "/shipping" }, { name: "Returns & refunds", href: "/returns" }, { name: "Contact us", href: "/contact" }] },
  { title: "Shopping with us", items: [{ name: "Buyer protection", href: "/buyer-protection" }, { name: "Safe payments", href: "/payments" }, { name: "Track your order", href: "/track-order" }, { name: "Kandi app", href: "#kandi-app" }] },
  { title: "About Kandi", items: [{ name: "About us", href: "/about" }, { name: "Careers", href: "/careers" }, { name: "Terms & conditions", href: "/terms" }, { name: "Privacy policy", href: "/privacy" }] },
];

export default function Footer() {
  return <footer className="mt-14 bg-[#222] text-white">
    <div className="border-b border-white/10 bg-[#2c2c2c]"><div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 text-center text-sm sm:grid-cols-3 md:px-6"><div><p className="font-bold">Fast local delivery</p><p className="mt-1 text-xs text-white/60">Across Kampala and beyond</p></div><div><p className="font-bold">Secure checkout</p><p className="mt-1 text-xs text-white/60">Cash, card and mobile money</p></div><div><p className="font-bold">Need help?</p><p className="mt-1 text-xs text-white/60">Call 0200 804 020</p></div></div></div>
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 md:px-6">
      {links.map(column => <div key={column.title}><h2 className="mb-4 text-sm font-bold">{column.title}</h2><ul className="space-y-2.5 text-sm text-white/60">{column.items.map(item => <li key={item.name}><Link className="hover:text-white" href={item.href}>{item.name}</Link></li>)}</ul></div>)}
      <div id="kandi-app"><h2 className="mb-3 text-sm font-bold">Get the Kandi app</h2><p className="text-sm leading-6 text-white/60">Shop faster, receive exclusive offers and track every order.</p><div className="mt-4 flex gap-2"><span className="rounded bg-white px-3 py-2 text-xs font-bold text-black">App Store</span><span className="rounded bg-white px-3 py-2 text-xs font-bold text-black">Google Play</span></div></div>
    </div>
    <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-white/45 md:flex-row md:items-center md:justify-between md:px-6"><span>© {new Date().getFullYear()} Kandi Uganda. All rights reserved.</span><span>Pay securely with Cash · MTN MoMo · Airtel Money · Visa</span></div></div>
  </footer>;
}
