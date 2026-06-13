export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-AU").format(value);
}

export function summarizeDelta(deltaPercent: number): string {
  const prefix = deltaPercent > 0 ? "+" : "";
  return `${prefix}${deltaPercent.toFixed(1)}%`;
}
