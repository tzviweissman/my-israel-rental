/**
 * Money on the orders surfaces. Mirrors `_CURRENCY_SYMBOL` in
 * backend/routes/marketplace/orders.py, including its fallback of the
 * code plus a space for a currency it does not know. Every order payload
 * (the form, the created order, the list, the courier's stops, the track
 * link) carries `currency`; a figure rendered without it is a guess, and
 * a USD store once showed "$18" beside the item and "₪18" as the total.
 */
const SYMBOL = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

export const symbolFor = (currency) => {
  const code = String(currency || 'ILS').toUpperCase();
  return SYMBOL[code] || `${code} `;
};

export const money = (n, currency) => `${symbolFor(currency)}${Number(n || 0).toLocaleString()}`;
