"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useCommerceTerms } from "@/lib/commerce-terms";
import { formatPrice } from "@/lib/currency";

type Toast = {
  id: number;
  message: string;
  image?: string;
  showBagLink?: boolean;
};

type ToastContextValue = {
  notify: (message: string, options?: { image?: string; showBagLink?: boolean }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback(
    (message: string, options?: { image?: string; showBagLink?: boolean }) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { id, message, ...options }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, options?.showBagLink ? 4500 : 3200);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-in rounded-xl bg-[#111] px-3.5 py-3 text-white shadow-xl"
          >
            <div className="flex items-center gap-3">
              {toast.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toast.image}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-md bg-white object-contain"
                />
              )}
              <p className="flex-1 text-[13px] font-semibold">
                {toast.showBagLink && <span className="mr-1 text-shop-primary">✓</span>}
                {toast.message}
              </p>
              {toast.showBagLink && (
                <Link
                  href="/cart"
                  className="shrink-0 rounded-full bg-shop-primary px-3 py-1.5 text-[12px] font-bold text-black hover:bg-shop-primary-dark"
                >
                  View cart
                </Link>
              )}
            </div>
            {toast.showBagLink && <FreeDeliveryNudge />}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Under an "Added to cart" toast: how far the basket now is from free
 * delivery, with a bar that fills as it gets closer — the moment a shopper has
 * just added something is the moment they are most willing to add one more.
 * Live from the basket and the threshold set in wp-admin; says nothing when
 * the shop has no free-delivery threshold.
 */
function FreeDeliveryNudge() {
  const { subtotal } = useCart();
  const { freeDeliveryFrom } = useCommerceTerms();
  if (!(freeDeliveryFrom > 0)) return null;

  const away = Math.max(0, freeDeliveryFrom - subtotal);
  const progress = Math.min(100, (subtotal / freeDeliveryFrom) * 100);
  return (
    <div className="mt-2.5">
      <p className="text-[12px] text-white/85">
        {away > 0 ? (
          <>
            Add <strong className="text-shop-primary">{formatPrice(away)}</strong> more for free delivery
          </>
        ) : (
          <strong className="text-shop-primary">You get free delivery!</strong>
        )}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="toast-bar h-full rounded-full bg-shop-primary" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
