"use client";

/**
 * The one quantity control the shop uses: a grey pill holding two round
 * white buttons with drawn minus and plus icons, and the count in bold
 * between them.
 *
 * At a quantity of one the minus becomes a bin, so taking the last one out
 * is the same tap in the same place rather than a separate link to find.
 * `onRemove` is optional; without it the minus simply stops at one.
 */
export default function QuantityStepper({
  quantity,
  onChange,
  onRemove,
  name,
  size = "md",
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  onRemove?: () => void;
  name: string;
  size?: "sm" | "md";
}) {
  const atOne = quantity <= 1;
  const binMode = atOne && Boolean(onRemove);

  return (
    <div className={`qty-stepper qty-stepper-${size}`}>
      <button
        type="button"
        aria-label={binMode ? `Remove ${name}` : `One less ${name}`}
        disabled={atOne && !onRemove}
        onClick={() => (binMode ? onRemove?.() : onChange(Math.max(1, quantity - 1)))}
        className={`qty-btn ${binMode ? "qty-btn-bin" : ""}`}
      >
        {binMode ? (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
            <path strokeLinecap="round" d="M5 12h14" />
          </svg>
        )}
      </button>
      <span className="qty-value" aria-live="polite" aria-label={`Quantity ${quantity}`}>
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`One more ${name}`}
        onClick={() => onChange(quantity + 1)}
        className="qty-btn"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
