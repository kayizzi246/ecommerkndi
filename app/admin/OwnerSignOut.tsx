"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ownerApi } from "@/lib/owner";

/** Clears the owner cookie and drops back to the passcode screen. */
export default function OwnerSignOut() {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  // Nothing to sign out of on the sign-in screen itself.
  if (pathname === "/admin/login") {
    return null;
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await ownerApi.logout();
        } catch {
          // Signing out is not worth blocking on: the cookie call either
          // cleared it or the session was already gone.
        }
        router.replace("/admin/login");
        router.refresh();
      }}
      className="ml-auto rounded-lg border border-white/25 px-3 py-1.5 text-[13px] font-semibold text-white/85 hover:border-white hover:text-white disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
