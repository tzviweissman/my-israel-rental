import { shownPrice, listingPrice, unitLabel, formatShownPrice } from './listingPrice';
// The same cases the server's implementation is held to
// (backend/tests/test_listing_price_parity.py). Change a rule there first.
import cases from '../../../shared/listing_price_cases.json';

const t = (key, fallback, vars) => {
  const s = typeof fallback === 'string' ? fallback : key;
  return vars ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]) : s;
};

describe('shownPrice: the shared cases', () => {
  test.each(cases.cases.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(shownPrice(c.property, { holiday: c.holiday || null })).toEqual(c.expected);
  });
});

describe('what a person reads', () => {
  test('whole-holiday price', () => {
    const p = { rental_type: 'vacation', holiday_lump_price: 6000, holiday_lump_currency: 'USD', holiday_tags: ['sukkot'] };
    expect(formatShownPrice(shownPrice(p), t)).toBe('$6,000 / Sukkot');
  });

  test('per-night holiday price never reads as the whole holiday', () => {
    const p = { rental_type: 'vacation', holiday_lump_price: 154, holiday_lump_currency: 'USD', holiday_lump_is_per_night: true, holiday_tags: ['sukkot'] };
    expect(formatShownPrice(shownPrice(p), t)).toBe('$154 / night (Sukkot)');
  });

  test('both holidays are both named', () => {
    const p = { rental_type: 'vacation', holiday_lump_price: 9000, holiday_tags: ['pesach', 'sukkot'] };
    expect(unitLabel(shownPrice(p), t)).toBe('Sukkot/Pesach');
  });

  test('no price reads as nothing, not "₪0"', () => {
    expect(formatShownPrice(shownPrice({ rental_type: 'vacation' }), t)).toBeNull();
  });

  test('holiday prices stay out of the nightly sort and filter', () => {
    expect(listingPrice({ rental_type: 'vacation', holiday_lump_price: 6000 })).toBe(0);
  });
});
