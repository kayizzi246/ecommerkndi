import Link from "next/link";

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="font-bold">{children}</p>
      <span className="block w-8 h-1 bg-sun mt-2" />
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16">
      {/* Contact strip */}
      <div className="bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center text-sm">
          <div>
            <p className="text-3xl mb-2">📞</p>
            <p className="font-bold">0200 804 020</p>
            <p className="text-xs text-gray-500 mt-1">
              (Everyday from 8:00 AM to 10:00 PM)
            </p>
          </div>
          <div>
            <p className="text-3xl mb-2">✉️</p>
            <p className="font-bold">kaizerinvestments99@gmail.com</p>
          </div>
          <div>
            <p className="text-3xl mb-2">💬</p>
            <p className="font-bold">0200 804 020</p>
            <p className="text-xs text-gray-500 mt-1">(Reach us on WhatsApp)</p>
          </div>
          <div>
            <p className="font-bold mb-3">Connect with Us</p>
            <div className="flex justify-center gap-3">
              {["📷", "📘", "🎵"].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:border-black"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <ColumnTitle>Let us help you</ColumnTitle>
            <ul className="space-y-3 text-gray-600">
              <li><Link href="/" className="hover:text-black">Shipping &amp; Delivery</Link></li>
              <li><Link href="/" className="hover:text-black">Returns &amp; Cancellations</Link></li>
              <li><Link href="/" className="hover:text-black">Size Chart</Link></li>
              <li><Link href="/" className="hover:text-black">Customer Care</Link></li>
            </ul>
          </div>
          <div>
            <ColumnTitle>Who we are</ColumnTitle>
            <ul className="space-y-3 text-gray-600">
              <li><Link href="/" className="hover:text-black">About us</Link></li>
              <li><Link href="/sale" className="hover:text-black">Super Price Store</Link></li>
              <li><Link href="/" className="hover:text-black">📍 Find a Store</Link></li>
            </ul>
          </div>
          <div>
            <ColumnTitle>KandiStore.com</ColumnTitle>
            <ul className="space-y-3 text-gray-600">
              <li><Link href="/" className="hover:text-black">Privacy Policy</Link></li>
              <li><Link href="/" className="hover:text-black">Disclaimer Policy</Link></li>
              <li><Link href="/" className="hover:text-black">Terms &amp; Conditions</Link></li>
            </ul>
          </div>
          <div>
            <ColumnTitle>Let&apos;s keep in touch</ColumnTitle>
            <p className="text-gray-600 mb-4">
              Sign up to our newsletter to receive promotions and more.
            </p>
            <form action="/search" className="flex">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 border border-gray-300 border-r-0 px-4 py-2.5 text-sm focus:outline-none focus:border-black"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="bg-sun px-5 font-bold hover:brightness-95"
              >
                →
              </button>
            </form>

            <p className="font-bold mt-8 mb-2">Payment Methods</p>
            <span className="block w-8 h-1 bg-sun mb-4" />
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {["Cash", "MTN MoMo", "Airtel Money", "Visa"].map((method) => (
                <span
                  key={method}
                  className="border border-gray-300 rounded px-2.5 py-1"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* App badges + copyright */}
        <div id="kandi-app" className="max-w-7xl mx-auto px-4 md:px-8 pb-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-3">
            <a
              href="#"
              className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2"
            >
              <span className="text-xl"></span>
              <span className="text-left leading-tight">
                <span className="block text-[9px] text-gray-400">Download on the</span>
                <span className="block text-sm font-semibold">App Store</span>
              </span>
            </a>
            <a
              href="#"
              className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2"
            >
              <span className="text-xl">▶</span>
              <span className="text-left leading-tight">
                <span className="block text-[9px] text-gray-400">Get it on</span>
                <span className="block text-sm font-semibold">Google Play</span>
              </span>
            </a>
          </div>
          <p className="text-xs text-gray-500">
            Copyright {new Date().getFullYear()}. Kandi Store — All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
