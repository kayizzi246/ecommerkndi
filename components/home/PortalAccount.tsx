"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useCustomerSession } from "@/lib/customer-session";

/**
 * The greeting, read off the READER'S clock.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`, and the reason is
 * exactly what the hook is for: the time of day is external state the server
 * cannot see, and the hook takes a separate server snapshot for precisely that
 * case. Setting it from an effect would work, but it is a second render for a
 * word, and the React Compiler rejects it on sight.
 *
 * `subscribe` returns a no-op unsubscribe because nothing here changes after
 * mount. A shopper whose visit crosses noon keeps the greeting they arrived
 * with, which is the correct amount of effort to spend on this.
 */
const clock = {
  subscribe: () => () => {},
  now: () => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  },
  /* "Welcome" is true at every hour, so it is what the server sends and what a
     reader with no JavaScript keeps. */
  server: () => "Welcome",
};

/**
 * The account panel that closes the portal band.
 *
 * Two states, and the signed-out one is the one that matters: it is a sign-in
 * call to action in the top right of the homepage, which is the position every
 * marketplace reserves for it and the one place this shop never had one outside
 * the masthead's icon.
 *
 * Signed in, it stops selling and starts serving — the shopper's name, and the
 * four places they actually go. That is the whole difference. A panel that keeps
 * saying "log in now" to somebody who is logged in is the most common way this
 * block goes wrong.
 *
 * ---- Why it is a client component ----
 *
 * The session lives in `CustomerSessionProvider`, which is client state fetched
 * from `/api/auth/me` after mount. The panel is small, renders its signed-out
 * shape on the server, and swaps when the session arrives; there is nothing here
 * worth making the page dynamic for.
 */
export default function PortalAccount({
  /** The free-delivery threshold, already formatted. Passed rather than read so
      this stays a client component with no settings dependency. */
  freeDeliveryLabel,
}: {
  freeDeliveryLabel: string;
}) {
  const { customer } = useCustomerSession();

  const greeting = useSyncExternalStore(clock.subscribe, clock.now, clock.server);

  return (
    <aside
      aria-label="Your account"
      className="hidden h-full flex-col rounded-2xl bg-white p-4 ring-1 ring-shop-line xl:flex"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shop-primary-soft">
          {customer?.avatar ? (
            <Image
              src={customer.avatar}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 object-cover"
            />
          ) : (
            <svg
              className="h-5 w-5 text-shop-primary-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" />
            </svg>
          )}
        </span>

        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-shop-ink">
            {customer ? `${greeting}, ${customer.name.split(" ")[0]}` : greeting}
          </p>
          {/* Wraps to two lines rather than truncating. The column is 235px and
              the signed-out line is thirty-eight characters, so `truncate` cut
              it at "Sign in for your orders a…" — a subtitle that stops
              mid-word reads as a rendering fault, and this is the one panel on
              the page whose job is to be trusted with a password. */}
          <p className="line-clamp-2 text-[12px] leading-snug text-shop-muted">
            {customer
              ? "Your orders and saved items"
              : "Sign in for your orders and saved items"}
          </p>
        </div>
      </div>

      {customer ? (
        <Link
          href="/account"
          className="btn-shop mt-3.5 block w-full rounded-full py-2 text-center text-[13.5px]"
        >
          My account
        </Link>
      ) : (
        <>
          <Link
            href="/account"
            className="btn-shop mt-3.5 block w-full rounded-full py-2 text-center text-[13.5px]"
          >
            Sign in
          </Link>
          {/* Register is a link rather than a second button. Two pills of equal
              weight make the shopper choose between them before they have read
              either; this makes the common path obvious and leaves the other
              one plainly available. */}
          <p className="mt-2 text-center text-[12px] text-shop-muted">
            New here?{" "}
            <Link href="/account" className="font-semibold text-shop-primary hover:underline">
              Create an account
            </Link>
          </p>
        </>
      )}

      {/* The four destinations, as a 2×2. They are the same four whether the
          shopper is signed in or not — a signed-out tap lands on the sign-in
          screen and comes back, which is a shorter path than hiding them and
          making somebody find them after. */}
      <ul className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3 border-t border-shop-hairline pt-3.5">
        {[
          { label: "Orders", href: "/account/orders" },
          { label: "Saved", href: "/account/wishlist" },
          { label: "Stores", href: "/sellers" },
          { label: "Reviews", href: "/account/reviews" },
        ].map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="block truncate text-center text-[12px] font-medium text-shop-body transition-colors hover:text-shop-primary"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* The shop's one unconditional promise, at the foot of the panel. It is
          the same figure checkout applies — it comes from settings, not from a
          sentence somebody typed — so it can be printed beside a sign-in button
          without qualifying it. */}
      <Link
        href="/shipping"
        className="mt-auto flex items-center gap-2 rounded-xl bg-shop-primary-soft px-3 py-2.5 text-[12px] font-semibold leading-tight text-shop-primary-ink transition-colors hover:bg-shop-cream"
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M3 7h11v9H3V7ZM14 10h4l3 3v3h-7v-6Z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </svg>
        Free delivery over {freeDeliveryLabel}
      </Link>
    </aside>
  );
}
