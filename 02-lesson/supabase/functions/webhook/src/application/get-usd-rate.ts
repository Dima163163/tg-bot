import { getCurrencyCode } from '../domain/currency.ts';
import type { RateProvider } from '../adapters/frankfurter-rate-provider.ts';

export type GetUsdRateResult =
  | { type: 'invalid-currency' }
  | { type: 'unsupported-currency'; currency: string }
  | { type: 'rate-unavailable' }
  | { type: 'rate'; currency: string; rate: number; date?: string };

interface GetUsdRateOptions {
  rateProvider: RateProvider;
}

export function createGetUsdRate({
  rateProvider,
}: GetUsdRateOptions): (messageText: unknown) => Promise<GetUsdRateResult> {
  return async function getUsdRate(messageText) {
    const currency = getCurrencyCode(messageText);

    if (!currency) {
      return { type: 'invalid-currency' };
    }

    if (currency === 'USD') {
      return { type: 'rate', currency, rate: 1 };
    }

    try {
      const quote = await rateProvider.getUsdRate(currency);
      return quote
        ? { type: 'rate', currency, ...quote }
        : { type: 'unsupported-currency', currency };
    } catch {
      return { type: 'rate-unavailable' };
    }
  };
}
