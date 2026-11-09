"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The Black November row: one swipeable line of deal tiles, with arrows on a
 * desktop. The tiles themselves are rendered on the server and passed in.
 */
export default function DealsTrack({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows]);

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul ref={trackRef} onScroll={updateArrows} className="bnd-grid">
        {children}
      </ul>
      {canPrev && (
        <button type="button" aria-label="Previous deals" onClick={() => scroll(-1)} className="hx-arrow hx-arrow-prev">
          ‹
        </button>
      )}
      {canNext && (
        <button type="button" aria-label="More deals" onClick={() => scroll(1)} className="hx-arrow hx-arrow-next">
          ›
        </button>
      )}
    </div>
  );
}
