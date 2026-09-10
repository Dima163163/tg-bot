export function getCurrencyCode(text: unknown): string | null {
  const currency = String(text ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export function formatRate(rate: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 6,
  }).format(rate);
}
