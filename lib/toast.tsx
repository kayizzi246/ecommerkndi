"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import Link from "next/link";

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
      }, 3200);
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
            className="toast-in bg-black text-white shadow-xl px-4 py-3 flex items-center gap-3"
          >
            {toast.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={toast.image}
                alt=""
                className="w-10 h-10 object-contain bg-white shrink-0"
              />
            )}
            <p className="text-xs tracking-widest uppercase flex-1">
              {toast.message}
            </p>
            {toast.showBagLink && (
              <Link
                href="/cart"
                className="text-xs tracking-widest uppercase underline underline-offset-4 shrink-0 hover:opacity-70"
              >
                View bag
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
