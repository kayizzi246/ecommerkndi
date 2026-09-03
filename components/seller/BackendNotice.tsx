"use client";

import { useEffect, useState } from "react";
import type { SellerHealth } from "@/app/api/seller/health/route";

/**
 * Says — quietly, and to the right audience — when the WordPress half of the
 * Seller Centre is not the half this storefront was built against.
 *
 * The Seller Centre is two deployments pretending to be one product: this
 * Next.js app, and a PHP plugin somebody uploads by hand. When they disagree,
 * every symptom is misleading — a fix shipped here against a plugin that was
 * never re-uploaded is indistinguishable from a fix that did not work, and a
 * plugin installed *twice* (as a file and as a Code Snippet) means the code
 * being edited may not be the code answering.
 *
 * ---- Who was reading this, and who it was written for ----
 *
 * It used to print the whole diagnosis on the page: the version WordPress is
 * running, the version this build expects, the path of the file to re-upload,
 * and every duplicate copy's location on disk.
 *
 * That is the correct information and it was being shown to the wrong person.
 * The Seller Centre is opened by shopkeepers — a seller signs in to restock a
 * listing and meets a red-bordered panel naming a PHP file, two version
 * numbers and a wp-content path. None of it is theirs to act on. What it tells
 * them is that the platform holding their money is broken in a way somebody
 * has left on the screen, and what it tells anyone else looking over their
 * shoulder is the shape of the shop's backend.
 *
 * So the page says the thing a seller can actually use — this part is briefly
 * unavailable, nothing you do here is lost — and the diagnosis goes to the
 * browser console, where whoever runs the shop is already looking when they
 * open a seller's screen to find out why something is not working. Nothing is
 * lost; it is only no longer addressed to the wrong reader.
 *
 * It still says nothing at all when the backend is the expected build, which is
 * the normal case.
 */
export default function BackendNotice() {
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    fetch("/api/seller/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((health: SellerHealth) => {
        const duplicated = health.duplicates.length > 0;
        if (health.reachable && health.up_to_date && !duplicated) return;

        /* ---- The diagnosis, for the one person it is addressed to ----
         *
         * Grouped and collapsed so it is one line in a console that is not
         * otherwise noisy, and `console.warn` rather than `error` because
         * nothing here is a thrown exception — it is a deployment that is half
         * done. Every field the panel used to print is in the payload, so this
         * is the same information at the same completeness, moved rather than
         * reduced.
         */
        console.groupCollapsed(
          "%cKandi Seller Centre%c backend does not match this storefront",
          "font-weight:700",
          "font-weight:400"
        );
        if (!health.reachable) {
          console.warn("Unreachable:", health.message);
        } else if (!health.up_to_date) {
          console.warn(
            `WordPress is running plugin version ${health.version ?? "unknown"}, ` +
              `this storefront expects ${health.expected_version}. ` +
              "Re-upload wordpress/kandi-seller-api.php — until you do, changes to " +
              "sign-in, sign-up and verification are not live."
          );
        }
        if (duplicated) {
          console.warn(
            `The plugin is installed more than once. The copy answering requests ` +
              `loaded from ${health.loaded_from}; ${health.duplicates.length} more ` +
              "tried to load after it:",
            health.duplicates,
            "— delete all but one. Most often this is the same file installed as a " +
              "plugin AND pasted into Code Snippets, and the one you edit is not the " +
              "one running."
          );
        }
        console.groupEnd();

        setDegraded(true);
      })
      .catch(() => undefined);
  }, []);

  if (!degraded) return null;

  return (
    /* Warm rather than red. A seller cannot fix this and is not at fault for
       it, so the panel's job is to explain a wobble, not to raise an alarm —
       and a two-pixel red border at the top of the Overview is the loudest
       object in the Seller Centre. `role="status"` for the same reason
       `role="alert"` was wrong: this is information, not an interruption. */
    <div
      role="status"
      className="mb-4 rounded-2xl bg-shop-primary-soft px-4 py-3.5 text-[13.5px] leading-relaxed text-shop-body ring-1 ring-shop-primary/20"
    >
      <p className="text-[14.5px] font-semibold text-shop-ink">
        Some seller tools are under maintenance
      </p>
      {/* Naming the parts is not a leak — a seller who is about to try signing
          a colleague up should know it will not take, and one who is here to
          restock should know that it will. Vagueness at this point costs more
          trust than it saves. */}
      <p className="mt-1">
        Sign-in, sign-up and account verification may not work for the next
        little while. Your listings, orders and earnings are unaffected, and
        anything you save here is safe.
      </p>
    </div>
  );
}
