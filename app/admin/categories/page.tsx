"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ownerApi, OwnerApiError, type CategorizePreview } from "@/lib/owner";

/**
 * Category clean-up.
 *
 * The shop reads every product title ("Men's Running Shoes", "Unisex Hoodie",
 * "Dish Drying Rack") and proposes where it belongs in the existing category
 * tree. Nothing moves until the owner presses Apply, every proposed move is
 * listed first, and any one of them can be unticked. Products whose category
 * the owner chose by hand in Products are never touched.
 */
export default function AdminCategoriesPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<CategorizePreview | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missingEndpoint, setMissingEndpoint] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await ownerApi.categorizePreview();
      setPreview(next);
      setSkip(new Set());
      setError(null);
    } catch (caught) {
      if (caught instanceof OwnerApiError && caught.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (caught instanceof OwnerApiError && caught.status === 404) {
        setMissingEndpoint(true);
        return;
      }
      setError(caught instanceof Error ? caught.message : "Could not check your categories.");
    }
  }, [router]);

  useEffect(() => {
    // Fetching on mount is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selected = useMemo(
    () => (preview?.changes ?? []).filter((change) => !skip.has(change.id)),
    [preview, skip]
  );

  const apply = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ownerApi.categorizeApply({ ids: selected.map((change) => change.id) });
      setNotice(`${result.applied} ${result.applied === 1 ? "product" : "products"} moved to the right category.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not move the products.");
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await ownerApi.categorizeApply({ auto_enabled: !preview.auto_enabled });
      setPreview({ ...preview, auto_enabled: result.auto_enabled });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the setting.");
    } finally {
      setBusy(false);
    }
  };

  if (missingEndpoint) {
    return (
      <div className="mx-auto max-w-[720px] rounded-2xl border border-shop-line bg-white p-6">
        <h1 className="text-[21px] font-extrabold text-shop-ink">Categories need a plugin update</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-shop-muted">
          Upload the latest <code>wordpress/kandi-owner-api.php</code> (version 1.2.0) to
          wp-content/plugins/kandi-owner-api/ on your WordPress site, then open this page again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-[27px] font-extrabold leading-tight text-shop-ink">Categories</h1>
        <p className="mt-1 max-w-[62ch] text-[14px] text-shop-muted">
          Every product title is read to work out who it is for and what it is, then matched to your
          existing categories. Check the moves below and apply them. Products you filed by hand in
          Products are never moved.
        </p>
      </div>

      {preview && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-shop-line bg-white p-4">
          <div>
            <p className="text-[14px] font-semibold text-shop-ink">File new products automatically</p>
            <p className="text-[13px] text-shop-muted">
              New listings and imports go to the right category the moment they are published.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preview.auto_enabled}
            onClick={toggleAuto}
            disabled={busy}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              preview.auto_enabled ? "bg-pop-green" : "bg-shop-line"
            }`}
          >
            <span className="sr-only">File new products automatically</span>
            <span
              aria-hidden
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                preview.auto_enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-pop-green-soft px-4 py-3 text-[14px] font-medium text-pop-green">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red">
          {error}
        </p>
      )}

      {!preview ? (
        !error && <div className="h-40 animate-skeleton rounded-2xl bg-shop-hairline" />
      ) : preview.changes.length === 0 ? (
        <div className="rounded-2xl border border-shop-line bg-white p-8 text-center">
          <p className="text-[17px] font-bold text-shop-ink">Every product is in the right place</p>
          <p className="mt-1 text-[14px] text-shop-muted">
            Checked {preview.checked} products.{" "}
            <Link href="/" className="font-semibold text-shop-primary hover:underline">
              View shop
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-shop-surface/95 py-2 backdrop-blur">
            <p className="text-[14px] text-shop-body">
              <strong className="text-shop-ink">{preview.changes.length}</strong> of {preview.checked}{" "}
              products would move. {selected.length !== preview.changes.length && `${selected.length} selected.`}
            </p>
            <button
              type="button"
              onClick={apply}
              disabled={busy || selected.length === 0}
              className="btn-shop px-6 py-2.5 text-[14px] disabled:opacity-50"
            >
              {busy ? "Moving…" : `Apply ${selected.length} ${selected.length === 1 ? "move" : "moves"}`}
            </button>
          </div>

          <ul className="divide-y divide-shop-line overflow-hidden rounded-2xl border border-shop-line bg-white">
            {preview.changes.map((change) => {
              const on = !skip.has(change.id);
              return (
                <li key={change.id}>
                  <label className={`flex cursor-pointer items-start gap-3 p-3.5 ${on ? "" : "opacity-50"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSkip((current) => {
                          const next = new Set(current);
                          if (next.has(change.id)) next.delete(change.id);
                          else next.add(change.id);
                          return next;
                        })
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-shop-primary)]"
                    />
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-shop-surface">
                      {change.image && <Image src={change.image} alt="" fill sizes="48px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-[14px] font-semibold text-shop-ink">{change.name}</span>
                      <span className="mt-1 block text-[12px] text-shop-muted">
                        <span className="line-through">{change.from.join(", ") || "No category"}</span>
                      </span>
                      <span className="mt-0.5 block text-[13px] font-semibold text-pop-green">
                        → {change.to.join(" + ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
