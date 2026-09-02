import type { SellerOrder } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import { formatUgPhone } from "@/lib/phone";

/**
 * Prints a packing slip for one order.
 *
 * A seller packing three parcels on a table needs the address on paper — or at
 * least on a screen that is not the one they are about to hand to a rider — and
 * the alternative they were using was a screenshot of a table that did not
 * carry the address at all.
 *
 * ---- Why an iframe and not window.open ----
 *
 * A popup is blocked by default on most phones unless the browser is convinced
 * the click caused it, and "convinced" varies. A same-document iframe is never
 * blocked, prints the same, and disappears afterwards. The trade is that the
 * slip cannot inherit the page's stylesheet, so this carries its own — which is
 * wanted anyway: the Seller Centre's palette is designed for a screen and a
 * warm grey on paper is just a smudge.
 *
 * The markup is built as a string rather than rendered by React because it is
 * never part of this document's tree; it is a second document that exists for
 * the length of one print dialog.
 */
export function printPackingSlip(order: SellerOrder, storeName: string) {
  const frame = document.createElement("iframe");
  // Off-screen rather than `display:none`: a hidden iframe is not guaranteed to
  // have a layout, and Safari will print a blank page for one that does not.
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(slipHtml(order, storeName));
  doc.close();

  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return;
  }

  // The print dialog is modal and synchronous in every browser that matters, so
  // the frame can go straight afterwards — but Safari resolves it a tick later,
  // hence the timeout rather than an immediate remove.
  win.focus();
  win.print();
  window.setTimeout(() => frame.remove(), 1000);
}

/** Minimal escaping. Every value below comes from an order, so none of it is trusted. */
function esc(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slipHtml(order: SellerOrder, storeName: string): string {
  const address = [order.address_1, order.address_2, order.city]
    .filter((line) => line && line.trim() !== "")
    .map(esc)
    .join("<br>");

  const rows = order.items
    .map(
      (item) => `<tr>
        <td class="qty">${item.quantity}</td>
        <td>${esc(item.name)}</td>
        <td class="num">${esc(formatPrice(item.total))}</td>
      </tr>`
    )
    .join("");

  const date = order.date
    ? new Date(order.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Packing slip — order ${esc(order.number)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 13px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #111;
  }
  h1 { margin: 0; font-size: 20px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #111; padding-bottom: 10px; }
  .muted { color: #555; }
  .block { margin-top: 18px; }
  .label { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #666; }
  .to { font-size: 15px; line-height: 1.7; margin-top: 4px; }
  .to strong { font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid #ddd; }
  th { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #666; }
  .qty { width: 44px; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .note { margin-top: 14px; padding: 8px 10px; border: 1px solid #bbb; }
  .sign { margin-top: 34px; display: flex; gap: 40px; }
  .sign div { flex: 1; border-top: 1px solid #999; padding-top: 6px; font-size: 11px; color: #666; }
  .foot { margin-top: 26px; font-size: 11px; color: #777; }
</style></head>
<body>
  <div class="head">
    <div>
      <h1>Order #${esc(order.number)}</h1>
      <p class="muted" style="margin:4px 0 0">${esc(date)}${
        order.payment ? ` · ${esc(order.payment)}` : ""
      }</p>
    </div>
    <div style="text-align:right">
      <strong>${esc(storeName)}</strong>
      <p class="muted" style="margin:4px 0 0">Packing slip</p>
    </div>
  </div>

  <div class="block">
    <p class="label">Deliver to</p>
    <p class="to">
      <strong>${esc(order.customer)}</strong><br>
      ${order.phone ? `${esc(formatUgPhone(order.phone))}<br>` : ""}
      ${address || '<span class="muted">No street address — call the buyer.</span>'}
    </p>
    ${
      order.map_url
        ? `<p class="muted" style="margin:6px 0 0;font-size:11px;word-break:break-all">Pin: ${esc(
            order.map_url
          )}</p>`
        : ""
    }
  </div>

  <div class="block">
    <p class="label">Items from ${esc(storeName)}</p>
    <table>
      <thead><tr><th class="qty">Qty</th><th>Item</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="text-align:right;font-weight:600;border-bottom:0">Your total</td>
        <td class="num" style="font-weight:600;border-bottom:0">${esc(
          formatPrice(order.seller_total)
        )}</td>
      </tr></tfoot>
    </table>
  </div>

  ${order.note ? `<div class="note"><strong>The buyer asked:</strong> ${esc(order.note)}</div>` : ""}

  <div class="sign">
    <div>Packed by</div>
    <div>Collected by (rider)</div>
    <div>Date &amp; time</div>
  </div>

  <p class="foot">Only this store's items are listed. Other sellers in the same order pack their own.</p>
</body></html>`;
}
