"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const SIGNED_IN_LINKS = [
  { href: "/account/orders", label: "My orders" },
  { href: "/#wishlist", label: "My wishlist" },
  { href: "/account", label: "Account settings" },
  { href: "/seller", label: "Seller Centre" },
];

/** Header account button: Google sign-in when signed out, a menu when signed in. */
export default function AccountMenu() {
  const { customer, loading, refresh, signOut } = useCustomerSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const onSignedIn = useCallback(async () => {
    await refresh();
    setOpen(false);
  }, [refresh]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={customer ? `Account: ${customer.name}` : "Sign in"}
        className="flex items-center gap-2 text-white hover:text-bfl-yellow"
      >
        {customer?.avatar ? (
          <Image
            src={customer.avatar}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3.75" />
            <path strokeLinecap="round" d="M4.5 20.1a7.5 7.5 0 0 1 15 0" />
          </svg>
        )}
        <span className="hidden max-w-[90px] truncate text-[13px] xl:inline">
          {loading ? "" : customer ? customer.name.split(" ")[0] : "Sign in"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[300px] border border-bfl-line bg-white p-4 text-left shadow-xl">
          {customer ? (
            <>
              <div className="flex items-center gap-3 border-b border-bfl-line pb-3">
                {customer.avatar ? (
                  <Image
                    src={customer.avatar}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bfl-surface text-[15px] font-bold text-bfl-ink">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-black">{customer.name}</p>
                  <p className="truncate text-[12px] text-bfl-grey">{customer.email}</p>
                </div>
              </div>

              <ul className="py-2">
                {SIGNED_IN_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block px-1 py-2 text-[13px] text-[#333] hover:text-black hover:underline"
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
                className="w-full border border-bfl-line py-2 text-[13px] font-bold text-[#333] hover:border-black"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-[15px] font-bold text-black">Welcome to Kandi</p>
              <p className="mb-4 mt-1 text-[12px] leading-5 text-bfl-grey">
                Sign in to track orders, save your wishlist and check out faster.
              </p>

              <GoogleSignInButton
                endpoint="/api/auth/google"
                onSuccess={onSignedIn}
                onError={setError}
                text="continue_with"
                width={268}
              />

              {error && (
                <p role="alert" className="mt-3 text-[12px] text-bfl-red">
                  {error}
                </p>
              )}

              <p className="mt-4 border-t border-bfl-line pt-3 text-center text-[12px] text-bfl-grey">
                Selling with us?{" "}
                <Link href="/seller/login" onClick={() => setOpen(false)} className="link-bfl font-bold">
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
