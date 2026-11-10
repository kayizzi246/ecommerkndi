/**
 * The shop's four promises in one line under the banner: what a first-time
 * shopper needs to know before trusting a price. Every one is a real term of
 * the shop (see the About block at the foot of the homepage).
 */
export default function PromiseStrip({ returnsDays }: { returnsDays: number }) {
  const promises = [
    {
      title: "Pay on delivery",
      detail: "Cash to the rider in Kampala",
      // A banknote.
      icon: "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 8v2a2 2 0 0 0 2-2H4Zm14 0a2 2 0 0 0 2 2V8h-2ZM4 14v2h2a2 2 0 0 0-2-2Zm16 0a2 2 0 0 0-2 2h2v-2Z",
    },
    {
      title: "Delivery across Uganda",
      detail: "Fee shown before you pay",
      // A van.
      icon: "M2 6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2h3a1 1 0 0 1 .8.4l3 4a1 1 0 0 1 .2.6v3a1 1 0 0 1-1 1h-1a3 3 0 0 1-6 0h-4a3 3 0 0 1-6 0H3a1 1 0 0 1-1-1V6Zm13 4v3h4.5l-2.25-3H15ZM7 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
    },
    {
      title: `${returnsDays}-day returns`,
      detail: "Send it back if it is not right",
      // An arrow turning back.
      icon: "M9 4 3 9l6 5v-3h5a4 4 0 0 1 0 8H8v2h6a6 6 0 0 0 0-12H9V4Z",
    },
    {
      title: "Secure payment",
      detail: "MTN MoMo, Airtel Money, card",
      // A shield with a tick.
      icon: "M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Zm-1 13.5L7.5 12 9 10.5l2 2 4-4 1.5 1.5-5.5 5.5Z",
    },
  ];

  return (
    <ul className="hx-promise no-scrollbar" aria-label="Why shop with us">
      {promises.map((promise) => (
        <li key={promise.title}>
          <svg aria-hidden viewBox="0 0 24 24" fill="currentColor">
            <path d={promise.icon} />
          </svg>
          <span>
            <strong>{promise.title}</strong>
            <small>{promise.detail}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
