"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A link that starts loading its whole page the moment a shopper reaches for
 * it: on hover, on touch, or on keyboard focus.
 *
 * A plain `<Link>` to a category or a search only loads that page's skeleton
 * ahead of time, and fetches the products after the tap. This one fetches the
 * products too, in the moment between reaching and tapping, so the page is
 * there when the tap lands. Only on intent, not for every link on screen: a
 * homepage shows dozens of these and most are never opened.
 */
export default function IntentLink({ onPointerEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [reached, setReached] = useState(false);

  return (
    <Link
      {...props}
      prefetch={reached ? true : null}
      onPointerEnter={(event) => {
        setReached(true);
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        setReached(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setReached(true);
        onFocus?.(event);
      }}
    />
  );
}
