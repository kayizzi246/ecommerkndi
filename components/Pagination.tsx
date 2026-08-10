import Link from "next/link";

/**
 * Shared Previous / Next pager. Server-safe: it only emits links, so it can be
 * dropped into any listing page without turning it into a client component.
 */
export default function Pagination({
  basePath,
  page,
  totalPages,
  params = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  /** Extra query parameters to preserve across pages (sort, q, …). */
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="border border-bfl-line px-5 py-2.5 text-[14px] font-semibold text-[#333] transition-colors hover:border-black"
        >
          ← Previous
        </Link>
      ) : (
        <span className="border border-bfl-line px-5 py-2.5 text-[14px] font-semibold text-[#c4c4c4]">
          ← Previous
        </span>
      )}

      <span className="text-[14px] text-bfl-grey">
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className="border border-bfl-line px-5 py-2.5 text-[14px] font-semibold text-[#333] transition-colors hover:border-black"
        >
          Next →
        </Link>
      ) : (
        <span className="border border-bfl-line px-5 py-2.5 text-[14px] font-semibold text-[#c4c4c4]">
          Next →
        </span>
      )}
    </nav>
  );
}
