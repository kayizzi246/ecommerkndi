/** Consistent English labels for purchase actions. */
export default function BuyNowLabel({ className = "" }: { className?: string }) {
  return <span className={className}>Buy now</span>;
}

export function AddToCartLabel({ className = "" }: { className?: string }) {
  return <span className={className}>Add to cart</span>;
}

export function CheckoutLabel({ className = "" }: { className?: string }) {
  return <span className={className}>Proceed to checkout</span>;
}
