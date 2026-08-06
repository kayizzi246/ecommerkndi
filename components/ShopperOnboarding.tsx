"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CategoryNode } from "@/lib/woocommerce";
import { useCustomerSession } from "@/lib/customer-session";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const STORAGE_KEY = "kandi-onboarding-v1";

export type ShopperPreferences = {
  departments: string[];
  size: string;
  city: string;
  completed: boolean;
};

const SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const CITIES = ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Mbale", "Elsewhere in Uganda"];

/** Reads the saved preferences, or null when the shopper hasn't been through the flow. */
export function readShopperPreferences(): ShopperPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShopperPreferences) : null;
  } catch {
    return null;
  }
}

/**
 * Three-step welcome shown once to a new visitor: pick departments, pick a
 * size and city, then optionally sign in. Everything is skippable — it saves
 * whatever was answered and never asks again.
 */
export default function ShopperOnboarding({ departments }: { departments: CategoryNode[] }) {
  const { customer, refresh } = useCustomerSession();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [size, setSize] = useState("");
  const [city, setCity] = useState("");

  // Show a beat after load so it never competes with the first paint.
  useEffect(() => {
    if (readShopperPreferences()) return;
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  if (!visible) return null;

  const save = (completed: boolean) => {
    const preferences: ShopperPreferences = { departments: picked, size, city, completed };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Private browsing — the flow simply reappears next visit.
    }
    setVisible(false);
  };

  const toggleDepartment = (slug: string) =>
    setPicked((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );

  const steps = ["What do you shop for?", "Your size & city", "Save your picks"];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden bg-white shadow-2xl sm:rounded-lg">
        {/* Progress */}
        <div className="flex items-center gap-3 border-b border-bfl-line px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-bfl-yellow">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
              <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-black">{steps[step]}</p>
            <p className="text-[12px] text-bfl-grey">Step {step + 1} of 3</p>
          </div>
          <button
            type="button"
            onClick={() => save(false)}
            className="shrink-0 text-[13px] text-bfl-grey hover:text-black"
          >
            Skip
          </button>
        </div>

        <div className="h-1 w-full bg-bfl-surface">
          <div
            className="h-1 bg-bfl-yellow transition-all duration-300"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && (
            <>
              <p className="mb-4 text-[13px] text-bfl-grey">
                Pick a few departments and we&apos;ll lead with them on your homepage.
              </p>
              <div className="flex flex-wrap gap-2">
                {departments.slice(0, 12).map((department) => {
                  const active = picked.includes(department.slug);
                  return (
                    <button
                      key={department.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDepartment(department.slug)}
                      className={`border px-4 py-2.5 text-[13px] transition-colors ${
                        active
                          ? "border-black bg-black font-bold text-white"
                          : "border-bfl-line text-[#333] hover:border-[#8a8a8a]"
                      }`}
                    >
                      {department.name}
                    </button>
                  );
                })}
                {departments.length === 0 && (
                  <p className="text-[13px] text-bfl-grey">
                    Departments load from your store — add product categories in WordPress to see
                    them here.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-[13px] font-bold text-black">Usual clothing size</p>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={size === option}
                      onClick={() => setSize(size === option ? "" : option)}
                      className={`min-w-[58px] border px-4 py-2.5 text-[13px] transition-colors ${
                        size === option
                          ? "border-black font-bold text-black"
                          : "border-bfl-line text-[#333] hover:border-[#8a8a8a]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-bold text-black" htmlFor="onboard-city">
                  Where should we deliver?
                </label>
                <select
                  id="onboard-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full border border-bfl-line px-3 py-2.5 text-[14px] focus:border-black focus:outline-none"
                >
                  <option value="">Select your city</option>
                  {CITIES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <p className="mt-2 text-[12px] text-bfl-grey">
                  We use this to show accurate delivery dates on every product.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              {customer ? (
                <>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bfl-yellow">
                    <svg className="h-6 w-6" fill="none" stroke="#000" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                    </svg>
                  </span>
                  <p className="mt-4 text-[16px] font-bold text-black">
                    You&apos;re all set, {customer.name.split(" ")[0]}
                  </p>
                  <p className="mt-1 text-[13px] text-bfl-grey">
                    Your picks are saved to this device and your Kandi account.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-bold text-black">Save your picks to your account</p>
                  <p className="mx-auto mb-5 mt-1 max-w-sm text-[13px] leading-5 text-bfl-grey">
                    Sign in with Google to keep your wishlist, track orders and check out without
                    retyping your details.
                  </p>
                  <GoogleSignInButton
                    endpoint="/api/auth/google"
                    onSuccess={refresh}
                    text="continue_with"
                    width={300}
                  />
                  <p className="mt-4 text-[12px] text-bfl-grey">
                    You can keep browsing without an account — nothing is lost.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-bfl-line px-6 py-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((value) => value - 1)}
              className="border border-bfl-line px-5 py-2.5 text-[13px] font-bold text-[#333] hover:border-black"
            >
              Back
            </button>
          ) : (
            <Link href="/sale" onClick={() => save(false)} className="link-bfl text-[13px]">
              Just show me the deals
            </Link>
          )}

          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((value) => value + 1)}
              className="btn-bfl px-8 py-2.5 text-[13px]"
            >
              Continue
            </button>
          ) : (
            <button type="button" onClick={() => save(true)} className="btn-bfl px-8 py-2.5 text-[13px]">
              Start shopping
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
