const formatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return `UGX ${formatter.format(amount)}`;
}

export function discountPercent(regular: number, sale: number): number {
  if (!regular || regular <= sale) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}
