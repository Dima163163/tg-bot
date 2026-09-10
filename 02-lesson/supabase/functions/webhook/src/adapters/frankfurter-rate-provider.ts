const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';

export interface RateQuote {
  rate: number;
  date?: string;
}

export interface RateProvider {
  getUsdRate(currency: string): Promise<RateQuote | null>;
}

interface FrankfurterResponse {
  date?: string;
  rates?: Record<string, number>;
}

interface FrankfurterRateProviderOptions {
  fetchFn?: typeof fetch;
}

export function createFrankfurterRateProvider({
  fetchFn = fetch,
}: FrankfurterRateProviderOptions = {}): RateProvider {
  return {
    async getUsdRate(currency) {
      const response = await fetchFn(FRANKFURTER_URL);

      if (!response.ok) {
        throw new Error('Frankfurter API request failed');
      }

      const data = (await response.json()) as FrankfurterResponse;
      const rate = data.rates?.[currency];

      return typeof rate === 'number'
        ? { rate, date: data.date }
        : null;
    },
  };
}
