import { getCurrencyCode } from '../domain/currency.js';

export function createGetUsdRate({ rateProvider }) {
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
