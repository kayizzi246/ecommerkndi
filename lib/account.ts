/** Shapes shared by the account dashboard pages and their API routes. */

export type OrderItem = {
  product_id: number;
  name: string;
  quantity: number;
  total: number;
  image: string;
  /** True when this shopper has already reviewed the product. */
  reviewed: boolean;
};

export type CustomerOrder = {
  id: number;
  number: string;
  status: string;
  date: string | null;
  total: number;
  currency: string;
  items: OrderItem[];
};

export type CustomerReview = {
  id: number;
  rating: number;
  date: string;
  text: string;
  verified: boolean;
  approved: boolean;
  product_id: number;
  product_name: string;
  product_image: string;
};

/** WooCommerce order statuses, in the words a shopper would use. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  processing: "Being prepared",
  "on-hold": "On hold",
  completed: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

/** Tailwind classes for the status chip, keyed by the same statuses. */
export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "bg-shop-hairline text-shop-body",
  processing: "bg-pop-blue-soft text-pop-blue",
  "on-hold": "bg-shop-hairline text-shop-body",
  completed: "bg-shop-successbg text-shop-success",
  cancelled: "bg-pop-red-soft text-pop-red",
  refunded: "bg-pop-violet-soft text-pop-violet",
  failed: "bg-pop-red-soft text-pop-red",
};

export function formatOrderDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
