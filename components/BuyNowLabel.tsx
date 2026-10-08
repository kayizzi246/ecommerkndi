/**
 * "Buy now", alternating with the Luganda "Gula kati".
 *
 * Both words sit in the same grid cell, so the button is always as wide as the
 * longer one and nothing beside it shifts when they swap. The animation lives in
 * globals.css (`.buy-now-swap`) and switches off under reduced motion, leaving
 * the English on its own. Screen readers get one plain "Buy now".
 */
export default function BuyNowLabel({ className = "" }: { className?: string }) {
  return (
    <span className={`buy-now-swap ${className}`}>
      <span className="sr-only">Buy now</span>
      <span aria-hidden className="buy-now-word">
        Buy now
      </span>
      <span aria-hidden className="buy-now-word buy-now-word-lg">
        Gula kati
      </span>
    </span>
  );
}
