const formatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return `UGX ${formatter.format(amount)}`;
}

export function hasPriceReduction(regular: number, current: number): boolean {
  return Number.isFinite(regular) && Number.isFinite(current) && regular > 0 && current >= 0 && regular > current;
}

export function discountPercent(regular: number, sale: number): number {
  if (!hasPriceReduction(regular, sale)) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}
