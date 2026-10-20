"use client";

import { useCommerceTerms } from "@/lib/commerce-terms";

/**
 * The rotating offer line on a product tile: free delivery when the price
 * earns it, then mobile money, then the returns window, rolling upward
 * one after another without stopping.
 *
 * Every line is something the shop actually offers everywhere. Cash on
 * delivery is NOT one of them: it only runs within 40 km of central Kampala (see
 * lib/cod-zones.ts), so promising it on every tile would be refused at
 * checkout for most shoppers. Free delivery only
 * appears on a tile whose price clears the threshold set in wp-admin, and the
 * returns days come from the same settings.
 *
 * The roll is a CSS animation rather than a timer, so a grid of forty-eight
 * tiles costs the phone nothing per tick. The first line is repeated at the
 * end of the list so the jump back to the start is invisible. Under reduced
 * motion the first line simply stays.
 */
export default function TileOffers({ price }: { price: number }) {
  const { freeDeliveryFrom, returnsDays } = useCommerceTerms();
  const free = freeDeliveryFrom > 0 && price >= freeDeliveryFrom;

  const offers: { text: string; tone: string }[] = [
    free
      ? { text: "Free delivery", tone: "tile-offer-green" }
      : { text: "Fast delivery", tone: "tile-offer-green" },
    { text: "MTN & Airtel Money", tone: "tile-offer-momo" },
    { text: `${returnsDays} day returns`, tone: "tile-offer-dark" },
  ];

  return (
    <div className="tile-offers" aria-label={offers.map((offer) => offer.text).join(", ")}>
      <ul aria-hidden className="tile-offers-roll">
        {[...offers, offers[0]].map((offer, i) => (
          <li key={i} className={offer.tone}>
            {offer.tone === "tile-offer-momo" ? (
              <>
                <span className="tile-momo tile-momo-mtn">MTN</span>
                <span className="tile-momo tile-momo-airtel">Airtel</span>
                Money
              </>
            ) : (
              offer.text
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
