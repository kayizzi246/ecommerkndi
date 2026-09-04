"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";
import { useOutsideClick } from "@/lib/outside-click";
import SignInPanel from "@/components/SignInPanel";

const SIGNED_IN_LINKS = [
  { href: "/account", label: "My dashboard" },
  { href: "/account/orders", label: "My orders" },
  { href: "/account/reviews", label: "My reviews" },
  { href: "/account/wishlist", label: "My wishlist" },
  { href: "/account/settings", label: "Settings" },
  { href: "/seller", label: "Seller Centre" },
];

/** Header account button: Google sign-in when signed out, a menu when signed in. */
export default function AccountMenu() {
  const { customer, loading, refresh, signOut } = useCustomerSession();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Through the shared hook, because this menu opens a dialog that is portalled
     out of it. The four inline lines this replaces closed the dropdown on every
     click inside that dialog — see lib/outside-click.ts. */
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(boxRef, open, close);

  const onSignedIn = useCallback(async () => {
    await refresh();
    setOpen(false);
  }, [refresh]);

  return (
    <div ref={boxRef} className="relative flex items-center">
      {/* Signed in, the account button goes straight to the dashboard — the
          menu is reachable from the caret beside it. Signed out, there is
          nothing to visit yet, so the same spot opens the sign-in panel. */}
      {customer ? (
        <Link
          href="/account"
          aria-label={`Account: ${customer.name}`}
          // Near-black, not `text-shop-body`. This component is rendered in
          // exactly one place — the masthead's working row — so it takes that
          // row's palette directly rather than carrying a prop for a second
          // surface it does not have.
          //
          // The row is white, so ink is 16:1 here and the choice is easy; it
          // was made when the row was orange, where ink was 5.5:1 and the two
          // obvious alternatives both failed — body grey at about 2.1:1, and
          // white at 2.9:1, the failure the palette note in `globals.css`
          // warns about. Ink was right on orange and is still right on white,
          // which is why nothing in the resting state moved.
          //
          // Hover did move: it was white, a lift that only reads on a coloured
          // ground, and on this row it would erase the control. Brand orange
          // instead, matching the rest of the masthead.
          className="flex items-center gap-2 text-shop-ink transition-colors hover:text-shop-primary"
        >
          <Avatar customer={customer} />
          <span className="hidden max-w-[90px] truncate text-[13px] xl:inline">
            {customer.name.split(" ")[0]}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Sign in"
          // Same palette as the signed-in link above, and for the same
          // reasons — see the note there.
          className="flex items-center gap-2 text-shop-ink transition-colors hover:text-shop-primary"
        >
          <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3.75" />
            <path strokeLinecap="round" d="M4.5 20.1a7.5 7.5 0 0 1 15 0" />
          </svg>
          <span className="hidden max-w-[90px] truncate text-[13px] xl:inline">
            {loading ? "" : "Sign in"}
          </span>
        </button>
      )}

      {customer && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Account menu"
          className="ml-1 text-shop-ink/70 transition-colors hover:text-shop-primary"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[300px] rounded-xl border border-shop-line bg-white p-4 text-left shadow-xl">
          {customer ? (
            <>
              <div className="flex items-center gap-3 border-b border-bfl-line pb-3">
                {customer.avatar ? (
                  <Image
                    src={customer.avatar}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bfl-surface text-[16px] font-semibold text-bfl-ink">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-black">{customer.name}</p>
                  <p className="truncate text-[13px] text-bfl-grey">{customer.email}</p>
                </div>
              </div>

              <ul className="py-2">
                {SIGNED_IN_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block px-1 py-2 text-[14px] text-[#333] hover:text-black hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setOpen(false);
                }}
                className="w-full border border-bfl-line py-2 text-[14px] font-semibold text-[#333] hover:border-black"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-[16px] font-semibold text-black">Welcome to Kandi</p>
              <p className="mb-4 mt-1 text-[13px] leading-5 text-bfl-grey">
                Sign in to track orders, save your wishlist and check out faster.
              </p>

              {/* `onSignedIn`, not `refresh`: it refreshes *and* closes the
                  dropdown. Leaving the panel open over a now-signed-in menu
                  looks like the sign-in did not take. */}
              <SignInPanel onSuccess={onSignedIn} />

              <p className="mt-4 border-t border-bfl-line pt-3 text-center text-[13px] text-bfl-grey">
                Selling with us?{" "}
                <Link href="/seller/login" onClick={() => setOpen(false)} className="link-bfl font-semibold">
                  Seller Centre
                </Link>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The shopper's Google photo, or their initial when there isn't one.
 *
 * `unoptimized` throughout: this sits in the masthead of every page, so an
 * avatar host the image optimiser has not been told about does not fail one
 * picture — it throws, and takes the entire site down for that shopper.
 */
function Avatar({ customer }: { customer: { name: string; avatar: string } }) {
  if (customer.avatar) {
    return (
      <Image
        src={customer.avatar}
        alt=""
        width={26}
        height={26}
        unoptimized
        className="h-[26px] w-[26px] rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-shop-primary-soft text-[13px] font-semibold text-shop-primary">
      {customer.name.charAt(0).toUpperCase()}
    </span>
  );
}
