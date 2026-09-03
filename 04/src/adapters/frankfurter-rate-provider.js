const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';

export function createFrankfurterRateProvider({ fetchFn = fetch }) {
  return {
    async getUsdRate(currency) {
      const response = await fetchFn(FRANKFURTER_URL);

      if (!response.ok) {
        throw new Error('Frankfurter API request failed');
      }

      const data = await response.json();
      const rate = data.rates?.[currency];

      return typeof rate === 'number'
        ? { rate, date: data.date }
        : null;
    },
  };
}
