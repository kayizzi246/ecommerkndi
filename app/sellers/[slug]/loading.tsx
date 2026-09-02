import { ListingPageSkeleton } from "@/components/Skeletons";

/** Shown while a store page is being built. Prerendered for the shops that
 *  exist today, on demand for every one that opens after the last deploy. */
export default function Loading() {
  return <ListingPageSkeleton />;
}
