"use client";

import { useEffect, useRef } from "react";

/**
 * The drifting particle field behind the /sell hero.
 *
 * ---- Why a canvas and not divs ----
 *
 * Sixty absolutely-positioned elements animated with CSS transforms would work
 * and would cost sixty layers for the compositor to keep, plus a style
 * recalculation every time the pointer moved. One canvas is one layer and one
 * paint, and the whole field — dots, links and the pointer reaction — is a
 * single loop the browser can drop frames from gracefully. On the phones this
 * page is actually read on, that difference is the whole feature.
 *
 * ---- What it does ----
 *
 * The dots drift on their own at a speed just fast enough to notice if you look
 * for it. The pointer pushes the ones near it away and they ease back when it
 * leaves, and dots close to each other are joined by a hairline — the join is
 * what makes it read as a field rather than as scattered specks, and it is what
 * makes the pointer's wake visible, because pushing one dot stretches every
 * line attached to it.
 *
 * ---- Where it refuses to run ----
 *
 *   • `prefers-reduced-motion` — no loop is started at all. Movement in the
 *     background of a page somebody is reading is exactly what that setting is
 *     for, and a static field would still be decoration they did not ask for,
 *     so nothing is drawn.
 *   • Off screen — an IntersectionObserver stops the loop once the hero has
 *     scrolled away, so reading the FAQ does not cost an animation frame.
 *   • Hidden tab — `visibilitychange` does the same, because a background tab
 *     still runs `requestAnimationFrame` in some browsers.
 *
 * It is `aria-hidden` and `pointer-events-none` throughout: it must never
 * intercept a click meant for the CTA sitting on top of it.
 */

/** Dot count at a desktop width. Phones get a third of it — see `resize`. */
const MAX_PARTICLES = 64;
/** How close two dots must be before a line is drawn between them, in px. */
const LINK_DISTANCE = 118;
/** How close the pointer gets before a dot starts moving away, in px. */
const POINTER_RADIUS = 130;

type Particle = {
  x: number;
  y: number;
  /** Drift, in px per frame at 60fps. */
  vx: number;
  vy: number;
  radius: number;
  /** 0 = brand orange, 1 = the page's green, 2 = ink. */
  tone: 0 | 1 | 2;
};

const TONES = ["255,106,0", "22,163,74", "17,24,39"] as const;

export default function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;

    // Off-canvas until the pointer arrives, so nothing is repelled towards the
    // top-left corner before the page has been touched.
    const pointer = { x: -9999, y: -9999 };

    /**
     * Sizes the backing store to the element's real pixels.
     *
     * `devicePixelRatio` is capped at 2: a 3x phone would otherwise paint nine
     * times the pixels for a field of blurred dots nobody is inspecting, which
     * is the most expensive way possible to draw something deliberately faint.
     */
    function resize() {
      if (!canvas) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);

      // Density by area rather than a fixed count: the same 64 dots that look
      // like a field on a 1400px hero look like a swarm on a 380px one.
      const target = Math.min(
        MAX_PARTICLES,
        Math.round((width * height) / 22000)
      );

      particles = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        radius: 1.1 + Math.random() * 2.1,
        // Mostly ink, so the field reads as texture; the brand colours are the
        // occasional accent rather than a scatter of confetti.
        tone: (Math.random() < 0.18 ? 0 : Math.random() < 0.22 ? 1 : 2) as 0 | 1 | 2,
      }));
    }

    function step() {
      if (!running) return;
      context!.clearRect(0, 0, width, height);

      for (const p of particles) {
        // ---- The pointer ----
        // A push away from the cursor that falls off with distance, so a dot at
        // the edge of the radius barely moves and one under the cursor leaves
        // quickly. Added to the drift rather than replacing it, which is what
        // makes the field settle back by itself once the pointer has gone.
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < POINTER_RADIUS && distance > 0.01) {
          const push = (1 - distance / POINTER_RADIUS) * 1.1;
          p.x += (dx / distance) * push;
          p.y += (dy / distance) * push;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap rather than bounce. A bounce concentrates dots along the edges
        // over time; wrapping keeps the density even and nobody can tell.
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }

      // ---- Links ----
      // O(n²) over at most 64 dots — about 2,000 comparisons a frame, which is
      // nothing. It is only worth saying because the cost is quadratic: raising
      // MAX_PARTICLES is not the cheap change it looks like.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > LINK_DISTANCE) continue;
          const alpha = (1 - distance / LINK_DISTANCE) * 0.16;
          context!.strokeStyle = `rgba(17,24,39,${alpha})`;
          context!.lineWidth = 1;
          context!.beginPath();
          context!.moveTo(a.x, a.y);
          context!.lineTo(b.x, b.y);
          context!.stroke();
        }
      }

      for (const p of particles) {
        context!.fillStyle = `rgba(${TONES[p.tone]},${p.tone === 2 ? 0.22 : 0.5})`;
        context!.beginPath();
        context!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        context!.fill();
      }

      frame = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }

    function onPointerMove(event: PointerEvent) {
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    }

    function onPointerLeave() {
      pointer.x = -9999;
      pointer.y = -9999;
    }

    resize();

    // The canvas is `pointer-events-none`, so it can never receive a pointer
    // event itself — the listener has to sit on the window and the position be
    // worked out relative to the canvas. That is also why the CTA on top of the
    // field still moves the particles: the cursor is tracked, not hit-tested.
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize);

    const seen = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 }
    );
    seen.observe(canvas);

    function onVisibility() {
      if (document.hidden) stop();
      else if (canvas && canvas.getBoundingClientRect().bottom > 0) start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      seen.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  );
}
