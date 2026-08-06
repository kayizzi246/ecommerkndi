"use client";

import { useEffect, useState } from "react";
import { readShopperPreferences } from "@/components/ShopperOnboarding";

const CITIES = ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Mbale"];

/**
 * The yellow "Get it tomorrow by 10:00 PM" strip. The date is computed on the
 * client after mount — reading the clock during render would make the server
 * and client markup disagree.
 */
export default function DeliveryPromise({ className = "" }: { className?: string }) {
  const [city, setCity] = useState("Kampala");
  const [day, setDay] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const saved = readShopperPreferences();
    if (saved?.city && CITIES.includes(saved.city)) setCity(saved.city);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDay(
      tomorrow.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
    );
  }, []);

  return (
    <div className={`relative bg-[#fff6d6] px-4 py-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-black">
        <svg className="mr-1 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v9H3V7Zm10 3h4l3 3v3h-7v-6Z" />
          <circle cx="7" cy="18" r="1.4" />
          <circle cx="17" cy="18" r="1.4" />
        </svg>
        <span className="font-bold italic">Get it {day ? day : "tomorrow"} by 10:00 PM</span>
        <span>, order before 12 AM</span>
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-expanded={picking}
          className="ml-1 inline-flex items-center gap-1 font-bold underline underline-offset-2"
        >
          {city}
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {picking && (
        <ul className="absolute right-3 top-full z-20 mt-1 w-48 border border-bfl-line bg-white py-1 shadow-lg">
          {CITIES.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => {
                  setCity(option);
                  setPicking(false);
                }}
                className={`block w-full px-4 py-2 text-left text-[13px] hover:bg-bfl-surface ${
                  option === city ? "font-bold text-black" : "text-[#333]"
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
