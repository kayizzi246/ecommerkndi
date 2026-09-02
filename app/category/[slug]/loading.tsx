import { ListingPageSkeleton } from "@/components/Skeletons";

/**
 * Shown while a department page is being built.
 *
 * This route is fully dynamic — it is not prerendered at all, so EVERY category
 * click paid for a WordPress round trip against a blank screen. It is also the
 * most-clicked link in the shop after the logo, which made it the single
 * highest-value loading state missing from the site.
 */
export default function Loading() {
  return <ListingPageSkeleton />;
}
