import { shownPrice, listingPrice } from './listingPrice';

// Shapes taken from live listings, 18 Sep 2026.
describe('shownPrice', () => {
  test('a vacation stay shows its nightly price', () => {
    expect(shownPrice({ rental_type: 'vacation', nightly_price: 500, currency: 'ILS' }))
      .toEqual({ amount: 500, currency: 'ILS', per: 'night' });
  });

  test('a stay priced only for Sukkot shows that price, not "Price on request"', () => {
    const p = { rental_type: 'vacation', holiday_lump_price: 6000, holiday_lump_currency: 'USD', currency: 'ILS', holiday_tags: ['sukkot'] };
    expect(shownPrice(p)).toEqual({ amount: 6000, currency: 'USD', per: 'holiday', holiday: 'sukkot' });
  });

  test('a per-night holiday price says per night', () => {
    const p = { rental_type: 'vacation', holiday_lump_price: 154, holiday_lump_currency: 'USD', holiday_lump_is_per_night: true, holiday_tags: ['sukkot'] };
    expect(shownPrice(p).per).toBe('holidayNight');
  });

  test('the holiday currency falls back to the listing currency', () => {
    expect(shownPrice({ rental_type: 'vacation', holiday_lump_price: 900, currency: 'USD' }).currency).toBe('USD');
  });

  test('a short-term listing shows its monthly rent, never a nightly figure derived from it', () => {
    expect(shownPrice({ rental_type: 'short-term', monthly_price: 8000, currency: 'ILS' }))
      .toEqual({ amount: 8000, currency: 'ILS', per: 'month' });
  });

  test('no price is null, not zero', () => {
    expect(shownPrice({ rental_type: 'vacation' })).toBeNull();
    expect(shownPrice({ rental_type: 'long-term' })).toBeNull();
  });

  test('holiday prices stay out of the nightly sort and filter', () => {
    expect(listingPrice({ rental_type: 'vacation', holiday_lump_price: 6000 })).toBe(0);
  });
});
