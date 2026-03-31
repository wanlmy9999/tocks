export function formatPrice(v: number | string | null | undefined, d = 2): string {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 'N/A' : n.toFixed(d);
}
export function formatPercent(v: number | string | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return 'N/A';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
export function formatNumber(v: number | string | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return 'N/A';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}
export function formatMarketCap(v: number | string | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n) || n === 0) return 'N/A';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
export function formatDate(v: string | Date | undefined): string {
  if (!v) return 'N/A';
  try { return new Date(v).toLocaleDateString('zh-CN'); } catch { return String(v); }
}
export function getChangeColor(v: number | string | undefined): string {
  const n = parseFloat(String(v ?? 0));
  return n > 0 ? 'price-up' : n < 0 ? 'price-down' : 'price-neutral';
}
