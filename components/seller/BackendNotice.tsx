"use client";

import { useEffect, useState } from "react";
import type { SellerHealth } from "@/app/api/seller/health/route";

/**
 * Says out loud when the WordPress half of the Seller Centre is not the half
 * this storefront was built against.
 *
 * The Seller Centre is two deployments pretending to be one product: this
 * Next.js app, and a PHP plugin somebody uploads by hand. When they disagree,
 * every symptom is misleading — a fix shipped here against a plugin that was
 * never re-uploaded is indistinguishable from a fix that did not work, and a
 * plugin installed *twice* (as a file and as a Code Snippet) means the code
 * being edited may not be the code answering.
 *
 * Both of those were invisible until now. This makes them a sentence on the
 * screen. It says nothing at all when the backend is the expected build, which
 * is the normal case.
 */
export default function BackendNotice() {
  const [health, setHealth] = useState<SellerHealth | null>(null);

  useEffect(() => {
    fetch("/api/seller/health", { cache: "no-store" })
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => undefined);
  }, []);

  if (!health) return null;

  const duplicated = health.duplicates.length > 0;
  if (health.reachable && health.up_to_date && !duplicated) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-2xl border-2 border-pop-red bg-pop-red-soft p-5 text-[14px] leading-relaxed text-shop-body"
    >
      <p className="text-[16px] font-semibold text-pop-red">
        The seller backend on WordPress does not match this storefront
      </p>

      {!health.reachable && <p className="mt-1.5">{health.message}</p>}

      {health.reachable && !health.up_to_date && (
        <p className="mt-1.5">
          WordPress is running plugin version{" "}
          <span className="font-semibold text-shop-ink">{health.version ?? "unknown"}</span>, but
          this storefront expects{" "}
          <span className="font-semibold text-shop-ink">{health.expected_version}</span>. Re-upload{" "}
          <code className="font-mono text-[13px]">wordpress/kandi-seller-api.php</code>. Until you
          do, changes to sign-in, sign-up and verification are not live.
        </p>
      )}

      {duplicated && (
        <p className="mt-2.5">
          <span className="font-semibold text-shop-ink">It is installed more than once.</span> The
          copy answering requests loaded from{" "}
          <code className="font-mono text-[13px]">{health.loaded_from}</code>, and{" "}
          {health.duplicates.length === 1 ? "another copy" : `${health.duplicates.length} more copies`}{" "}
          tried to load after it:{" "}
          {health.duplicates.map((path) => (
            <code key={path} className="mr-1 font-mono text-[13px]">
              {path}
            </code>
          ))}
          . Delete all but one — most often this is the same file installed as a plugin
          <em> and </em> pasted into Code Snippets, and the one you edit is not the one running.
        </p>
      )}
    </div>
  );
}
