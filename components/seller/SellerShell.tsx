"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSellerSession } from "@/lib/seller-session";
import VerifyEmailCard from "@/app/seller/VerifyEmailCard";
import BackendNotice from "@/components/seller/BackendNotice";
import { storeHref } from "@/lib/store-routes";

/** Routes inside /seller that must render without the authenticated chrome. */
const PUBLIC_ROUTES = ["/seller/login", "/seller/register"];

/**
 * The setup gate. Signed in, but not finished: verification documents not sent,
 * or the monthly fee unpaid.
 *
 * It renders on its own, without the dashboard chrome — a sidebar of links to
 * places the seller cannot go yet is an invitation to try them.
 */
const SETUP_ROUTE = "/seller/onboarding";

/**
 * `approvedOnly` marks the screens that do nothing for a store awaiting review.
 *
 * WordPress already refuses to create a listing for an unapproved seller, and
 * an unapproved store has by definition never had an order or earned anything —
 * so these three pages can only show an error or three zeros. Hiding them is
 * not a restriction; it is not offering a door that opens onto a wall.
 */
const NAV = [
  {
    href: "/seller",
    label: "Overview",
    exact: true,
    icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z",
  },
  {
    href: "/seller/products",
    label: "Products",
    approvedOnly: true,
    icon: "M4 7l8-3.5L20 7v10l-8 3.5L4 17V7Zm8 3.5L4 7m8 3.5L20 7m-8 3.5V20",
  },
  {
    href: "/seller/orders",
    label: "Orders",
    approvedOnly: true,
    icon: "M3 6h2.2l2 10.5h11.1L20 9H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8.5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  },
  {
    href: "/seller/commissions",
    label: "Earnings",
    approvedOnly: true,
    icon: "M12 3v18M8 7h6.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16",
  },
  {
    href: "/seller/guide",
    label: "How it works",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4.5v-.01M9.8 9.2a2.3 2.3 0 1 1 3.3 2.05c-.7.35-1.1 1-1.1 1.75",
  },
  {
    href: "/seller/settings",
    label: "Settings",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.4 8.4 0 0 0-.13-1.45l2-1.55-2-3.46-2.35.95a8.5 8.5 0 0 0-2.5-1.45L15 2.5H9l-.42 2.54a8.5 8.5 0 0 0-2.5 1.45L3.73 5.54l-2 3.46 2 1.55a8.5 8.5 0 0 0 0 2.9l-2 1.55 2 3.46 2.35-.95a8.5 8.5 0 0 0 2.5 1.45L9 21.5h6l.42-2.54a8.5 8.5 0 0 0 2.5-1.45l2.35.95 2-3.46-2-1.55c.09-.48.13-.96.13-1.45Z",
  },
];

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  approved: { label: "Live", className: "bg-shop-successbg text-shop-success" },
  pending: { label: "Pending review", className: "bg-pop-orange-soft text-pop-orange" },
  suspended: { label: "Suspended", className: "bg-pop-red-soft text-pop-red" },
  rejected: { label: "Rejected", className: "bg-pop-red-soft text-pop-red" },
};

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { seller, loading, signOut, refresh } = useSellerSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Whether the confirm-email strip has been expanded into the code box. */
  const [enteringCode, setEnteringCode] = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isSetup = pathname === SETUP_ROUTE;

  /**
   * Whether the seller still owes us something before the dashboard opens.
   *
   * `fee_amount` rather than the shop's current fee: a seller is held to the
   * figure that applied on the day they applied, and a shop that later sets the
   * fee to zero must not strand the people who already owe the old one.
   * `waived` covers a shop that charges nothing at all.
   */
  const setupDue = Boolean(
    seller &&
      (seller.kyc_status === "missing" ||
        seller.kyc_status === "rejected" ||
        (seller.fee_status === "unpaid" && seller.fee_amount > 0))
  );

  // Bounce unauthenticated visitors to the sign-in screen, and unfinished ones
  // to the setup gate. Enforced here rather than on the gate page itself, so
  // typing /seller/products cannot walk around it.
  useEffect(() => {
    if (isPublic || loading) return;

    if (!seller) {
      router.replace("/seller/login");
      return;
    }
    if (setupDue && !isSetup) {
      router.replace(SETUP_ROUTE);
    }

    // Deliberately no redirect *away* from the setup page when nothing is
    // outstanding. It used to bounce straight back to the dashboard, which is
    // what happened to anyone pressing "Upload documents" from the checklist at
    // a moment the shell thought they were finished: the page appeared and
    // vanished. The gate now stands on its own and says what it sees.
  }, [isPublic, isSetup, loading, seller, setupDue, router]);

  // Sign-in and sign-up carry the backend warning too — a mismatched plugin is
  // most likely to be noticed *because* signing in is behaving strangely, and
  // that is the screen the seller is looking at when it does.
  if (isPublic) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[720px] px-4 pt-6 empty:hidden">
          <BackendNotice />
        </div>
        {children}
      </div>
    );
  }

  if (loading || !seller) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[15px] text-shop-muted">
        Loading your Seller Centre…
      </div>
    );
  }

  // The gate stands alone: no sidebar, no navigation, nothing to click past.
  if (isSetup) {
    return <div className="min-h-screen bg-shop-hairline/40">{children}</div>;
  }

  // Redirect in flight — render nothing rather than a flash of the dashboard
  // the seller is about to be moved away from.
  if (setupDue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[15px] text-shop-muted">
        Taking you to your setup…
      </div>
    );
  }

  const status = STATUS_COPY[seller.status] ?? STATUS_COPY.pending;
  const feeDue = seller.fee_status === "unpaid" && seller.fee_amount > 0;
  /** Products, Orders and Earnings only mean something once the store is live. */
  const storeApproved = seller.status === "approved";

  return (
    // The Seller Centre is columns of figures, so it runs in the neutral face
    // rather than the geometric one the storefront is set in.
    <div className="font-tabular min-h-screen bg-shop-hairline/40">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-shop-line bg-white px-4 md:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-label="Toggle navigation"
          className="text-shop-ink lg:hidden"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <Link href="/seller" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-shop-flame text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
              <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
            </svg>
          </span>
          <span className="hidden text-[17px] font-semibold text-shop-ink sm:block">
            Seller Centre
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3 md:gap-4">
          <Link
            href={storeHref(seller.store_slug)}
            className="hidden text-[14px] font-semibold text-shop-body hover:text-shop-primary md:block"
          >
            View my store
          </Link>
          <div className="hidden text-right lg:block">
            <p className="text-[14px] font-semibold leading-tight text-shop-ink">
              {seller.store_name}
            </p>
            <p className="text-[12px] leading-tight text-shop-muted">{seller.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-shop-line px-3.5 py-2 text-[14px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-16 left-0 z-30 w-64 shrink-0 overflow-y-auto border-r border-shop-line bg-white transition-transform lg:static lg:inset-auto lg:translate-x-0 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="border-b border-shop-line p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-shop-muted">
              Store status
            </p>
            <span
              className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
            <p className="mt-2.5 text-[13px] text-shop-muted">
              Commission{" "}
              <span className="font-semibold text-shop-ink">{seller.commission_rate}%</span>
            </p>
          </div>

          <nav className="p-2">
            {NAV.filter((item) => storeApproved || !item.approvedOnly).map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition-colors ${
                    active
                      ? "bg-shop-primary-soft text-shop-primary"
                      : "text-shop-body hover:bg-shop-hairline hover:text-shop-ink"
                  }`}
                >
                  <svg
                    className="h-[19px] w-[19px] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Before approval this offered a button WordPress refuses to honour:
              creating a listing is rejected outright for an unapproved store.
              The panel now says what is actually happening instead. */}
          {storeApproved ? (
            <div className="m-2 rounded-xl bg-shop-hairline p-4">
              <p className="text-[14px] font-semibold text-shop-ink">Add a product</p>
              <p className="mt-1 text-[13px] leading-5 text-shop-muted">
                Listings go live once our team approves them.
              </p>
              <Link
                href="/seller/products/new"
                onClick={() => setDrawerOpen(false)}
                className="btn-shop mt-3 w-full py-2.5 text-[14px]"
              >
                New listing
              </Link>
            </div>
          ) : (
            <div className="m-2 rounded-xl bg-pop-orange-soft p-4">
              <p className="text-[14px] font-semibold text-pop-orange">Store under review</p>
              <p className="mt-1 text-[13px] leading-5 text-shop-body">
                Listings, orders and earnings open up as soon as your store is approved.
              </p>
              <Link
                href="/seller/guide"
                onClick={() => setDrawerOpen(false)}
                className="mt-3 block text-[13px] font-semibold text-shop-primary hover:underline"
              >
                How selling works ›
              </Link>
            </div>
          )}
        </aside>

        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 top-16 z-20 cursor-default bg-black/40 lg:hidden"
          />
        )}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <BackendNotice />

          {/* ---- Unconfirmed email ----
               A seller is signed in and working before this is done, so it is a
               strip rather than a gate: it asks, on every screen, and carries
               the code box with it so confirming never means navigating
               somewhere to look for it. Payouts are the one thing held back
               until it is finished, and it says so.

               This is the visible half of the change that let sellers in at
               all — the code used to stand between registering and the
               dashboard, and an undelivered email meant nobody got past it. */}
          {!seller.email_verified && (
            <div className="mb-6 rounded-2xl border border-pop-orange/30 bg-pop-orange-soft p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold text-pop-orange">
                    Confirm your email address
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-shop-body">
                    We sent a six-digit code to{" "}
                    <span className="font-semibold text-shop-ink">{seller.email}</span>. Everything
                    here works without it — but we cannot pay you out until the address is
                    confirmed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnteringCode((open) => !open)}
                  className="shrink-0 rounded-lg bg-shop-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
                >
                  {enteringCode ? "Not now" : "Enter the code"}
                </button>
              </div>

              {enteringCode && (
                <div className="mt-4 max-w-[420px]">
                  <VerifyEmailCard
                    email={seller.email}
                    onVerified={async () => {
                      // Re-reads /me, so the strip disappears on the spot rather
                      // than at the next full page load.
                      await refresh();
                      setEnteringCode(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* An unpaid monthly fee hides the seller's products, so it is said on every screen
              rather than only on the one the seller happens to open. */}
          {feeDue && (
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-shop-primary bg-shop-primary-soft p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-shop-primary">
                  Your monthly seller fee is unpaid
                </p>
                <p className="mt-1 text-[14px] leading-relaxed text-shop-body">
                  Your store cannot be approved until it clears. Quote reference{" "}
                  <span className="font-mono font-semibold text-shop-ink">
                    {seller.fee_reference}
                  </span>{" "}
                  when you pay, and we will confirm by email.
                </p>
              </div>
              <Link
                href="/seller/settings"
                className="shrink-0 rounded-lg bg-shop-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
              >
                Payment details
              </Link>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
