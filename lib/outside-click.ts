"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Closes a panel when the shopper clicks away from it — without closing it when
 * they click a dialog the panel itself opened.
 *
 * ---- The bug this exists to stop happening again ----
 *
 * Every menu on this site used the same four lines:
 *
 *     if (box.current && !box.current.contains(event.target)) setOpen(false);
 *
 * which is correct right up until something inside the panel opens a layer that
 * is PORTALLED somewhere else in the document. The verification dialog is
 * portalled into `document.body` — it has to be, because the masthead's
 * transform makes it the containing block for anything `fixed` inside it, so a
 * dialog rendered in place lands against the header instead of the viewport.
 *
 * The moment it moved, `contains()` started answering "no" for every click
 * inside it. Opening the account menu, tapping "Verify now" and then tapping
 * "Use my email address instead" made the dropdown decide the shopper had
 * clicked away: it closed, `SignInPanel` unmounted, and the dialog went with
 * it. From the outside that is not a dropdown bug, it is the popup dying.
 *
 * ---- Why an attribute rather than a second ref ----
 *
 * A ref would mean every panel knowing about every dialog it might ever open,
 * and passing that ref down through the component that opens it. The attribute
 * inverts it: a portalled layer declares itself once, and every panel using
 * this hook respects it — including panels written later, which is the half a
 * ref cannot cover.
 *
 * `closest()` walks the portalled DOM tree, not the React tree, which is
 * exactly right here: the question being asked is "is this click visually
 * inside a layer that is on top of me", and that is a DOM question.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void
) {
  useEffect(() => {
    if (!active) return;

    const handle = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || !ref.current) return;

      // A click inside the panel is not outside it.
      if (ref.current.contains(target)) return;

      /* Nor is a click inside a layer that was opened from it. `closest` needs
         an Element; a click that lands on a text node reports its parent, so in
         practice this is always one. The guard is for the cases where it is
         not — a click on the document itself, or on an SVG in an older engine
         where `closest` is missing. */
      if (typeof target.closest === "function" && target.closest("[data-portal-layer]")) {
        return;
      }

      onOutside();
    };

    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, active, onOutside]);
}
