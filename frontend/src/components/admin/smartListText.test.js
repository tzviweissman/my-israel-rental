import {
  applySort,
  buildCopyText,
  buildHeader,
  daysSinceAdded,
  describeFilters,
  formatAdded,
  formatBedrooms,
  formatPrice,
  WA_URL_LIMIT,
  whatsappUrl,
  toggleSelection,
  topIds,
  trimToCap,
} from './smartListText';

describe('selection rules', () => {
  const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  test('topIds takes the first N on screen, or all when uncapped', () => {
    expect(topIds(rows, 2)).toEqual(['a', 'b']);
    expect(topIds(rows, 0)).toEqual(['a', 'b', 'c', 'd']);
    expect(topIds(rows, 10)).toEqual(['a', 'b', 'c', 'd']);
    expect(topIds(null, 3)).toEqual([]);
  });

  test('ticking under the cap adds, in the order picked', () => {
    expect(toggleSelection(['b'], 'a', 3)).toEqual({ ids: ['b', 'a'], refused: false });
  });

  // The admin decides what to drop. A tick at the cap must not quietly
  // evict an earlier pick.
  test('a tick at the cap is refused and changes nothing', () => {
    const ids = ['a', 'b'];
    const out = toggleSelection(ids, 'c', 2);
    expect(out.refused).toBe(true);
    expect(out.ids).toBe(ids);
  });

  // Swapping a pick out has to stay possible at the cap.
  test('unticking always works, including at the cap', () => {
    expect(toggleSelection(['a', 'b'], 'a', 2)).toEqual({ ids: ['b'], refused: false });
  });

  test('no cap never refuses', () => {
    expect(toggleSelection(['a', 'b', 'c'], 'd', 0).refused).toBe(false);
  });

  test('lowering the cap keeps the earliest picks; raising or removing it keeps all', () => {
    expect(trimToCap(['c', 'a', 'd'], 2)).toEqual(['c', 'a']);
    const ids = ['a', 'b'];
    expect(trimToCap(ids, 5)).toBe(ids);
    expect(trimToCap(ids, 0)).toBe(ids);
  });
});

const DAY = 86400000;
const now = Date.now();
const ago = (days) => new Date(now - days * DAY).toISOString();

const row = (id, days, extra = {}) => ({
  id,
  created_at: days == null ? null : ago(days),
  price: 8000,
  currency: 'ILS',
  price_label: '/mo',
  bedrooms: 3,
  area: 'Jerusalem - Sanhedria',
  available_from: null,
  listing_url: `https://myisraelrental.com/property/${id}`,
  ...extra,
});

describe('daysSinceAdded', () => {
  test('counts whole days', () => {
    expect(daysSinceAdded(ago(3))).toBe(3);
  });

  // A handful of production listings predate `created_at`. Returning 0
  // would stamp them "Added today" — the reason this returns null.
  test('returns null, not 0, for a missing or unusable date', () => {
    expect(daysSinceAdded(null)).toBeNull();
    expect(daysSinceAdded('')).toBeNull();
    expect(daysSinceAdded('not-a-date')).toBeNull();
  });

  test('clamps a future timestamp rather than going negative', () => {
    expect(daysSinceAdded(new Date(now + 5 * DAY).toISOString())).toBe(0);
  });
});

describe('formatAdded', () => {
  test('today, yesterday, and a day count', () => {
    expect(formatAdded(ago(0))).toBe('Added today');
    expect(formatAdded(ago(1))).toBe('Added yesterday');
    expect(formatAdded(ago(5))).toBe('Added 5 days ago');
  });

  // The failure this guards: an undated listing stamped "Added today".
  test('renders nothing for a missing or unparseable date', () => {
    expect(formatAdded(null)).toBeNull();
    expect(formatAdded(undefined)).toBeNull();
    expect(formatAdded('garbage')).toBeNull();
  });

  test('a future timestamp reads as today, not "in 1 day"', () => {
    expect(formatAdded(new Date(now + 2 * DAY).toISOString())).toBe('Added today');
  });

  test('past a month it stops stamping', () => {
    expect(formatAdded(ago(45))).toBeNull();
  });

  test('uses the translator it is given, with n rather than count', () => {
    const calls = [];
    const t = (key, fallback, opts) => { calls.push([key, opts]); return `T:${key}`; };
    expect(formatAdded(ago(3), t)).toBe('T:sweep.addedDaysAgo');
    expect(calls[0][1]).toEqual({ n: 3 });
  });
});

describe('formatBedrooms and formatPrice', () => {
  test('bedrooms: singular, plural, half rooms, missing', () => {
    expect(formatBedrooms(1)).toBe('1 bedroom');
    expect(formatBedrooms(3)).toBe('3 bedrooms');
    expect(formatBedrooms(2.5)).toBe('2.5 bedrooms');
    expect(formatBedrooms(null)).toBeNull();
    expect(formatBedrooms('x')).toBeNull();
  });

  test('price: currency symbol and a missing price', () => {
    expect(formatPrice(8000, 'ILS')).toBe('₪8,000');
    expect(formatPrice(1200, 'USD')).toBe('$1,200');
    expect(formatPrice(null, 'ILS')).toBe('—');
  });
});

describe('applySort', () => {
  const rows = [row('a', 10), row('b', 1), row('c', null), row('d', 30), row('e', 0)];

  test('newest first', () => {
    expect(applySort(rows, 'newest').map((r) => r.id)).toEqual(['e', 'b', 'a', 'd', 'c']);
  });

  // The subtle one: undated rows go last in BOTH directions, so "oldest
  // first" never opens with a listing whose age we don't actually know.
  test('oldest first still puts undated rows last', () => {
    expect(applySort(rows, 'oldest').map((r) => r.id)).toEqual(['d', 'a', 'b', 'e', 'c']);
  });

  test('never mutates the input', () => {
    const before = rows.map((r) => r.id);
    applySort(rows, 'newest');
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  test('existing price sort is unaffected', () => {
    const priced = [row('x', 1, { price: 9000 }), row('y', 1, { price: 3000 })];
    expect(applySort(priced, 'price_asc').map((r) => r.id)).toEqual(['y', 'x']);
  });

  test('USD rows are normalised to ILS before comparing', () => {
    const mixed = [
      row('usd', 1, { price: 1000, currency: 'USD' }), // ~3700 ILS
      row('ils', 1, { price: 5000 }),
    ];
    expect(applySort(mixed, 'price_asc', 3.7).map((r) => r.id)).toEqual(['usd', 'ils']);
  });
});

describe('buildHeader', () => {
  test('names the neighbourhood and category', () => {
    expect(
      buildHeader({ location: 'Jerusalem - Sanhedria', rental_category: 'long-term' })[1],
    ).toBe('Sanhedria long-term rentals');
  });

  // A recency-filtered blast is a different message from a catalogue, and
  // the recipient should be able to tell in the first line.
  test('flags a recency-filtered list in the subtitle', () => {
    expect(buildHeader({ listed_within_days: 7, rental_category: 'any' })[1]).toMatch(
      /^Just listed — /,
    );
    expect(buildHeader({ listed_within_days: 30, rental_category: 'any' })[1]).toMatch(
      /^New this month — /,
    );
  });
});

describe('whatsappUrl', () => {
  // The link is what WhatsApp truncates, and it is much longer than the
  // text: ₪ travels as %E2%82%AA. Measuring the raw text let an over-long
  // link through (site audit 2026-09-14, finding 1).
  test('measures the encoded link, not the raw text', () => {
    const text = buildCopyText(Array.from({ length: 20 }, (_, i) => row(`id${i}`, 1)), { listed_within_days: 7 });
    const url = whatsappUrl(text);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url.length).toBeGreaterThan(text.length * 1.3);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(text);
  });

  test('the limit is on the link', () => {
    expect(WA_URL_LIMIT).toBeGreaterThan(0);
  });
});

describe('buildCopyText', () => {
  // Leading with the bare homepage URL is what makes WhatsApp render the
  // MyIsraelRental logo as the preview card instead of the first
  // property's photo. Easy to lose in a refactor, invisible in review.
  test('leads with the bare site URL so the logo is the link preview', () => {
    const text = buildCopyText([row('a', 1)], { rental_category: 'any' });
    expect(text.startsWith('https://myisraelrental.com\n\n')).toBe(true);
  });

  test('includes every selected listing URL', () => {
    const text = buildCopyText([row('a', 1), row('b', 2)], {});
    expect(text).toContain('/property/a');
    expect(text).toContain('/property/b');
  });
});

describe('describeFilters', () => {
  test('shows a two-sided rent range', () => {
    expect(
      describeFilters({
        location: 'Tel Aviv',
        min_monthly_rent_ils: 5000,
        max_monthly_rent_ils: 9000,
      }),
    ).toBe('Tel Aviv · ₪5,000–₪9,000');
  });

  test('reads a single bedroom count as singular', () => {
    expect(describeFilters({ min_bedrooms: 3, max_bedrooms: 3 })).toContain('3 bed');
    expect(describeFilters({ min_bedrooms: 3, max_bedrooms: 3 })).not.toContain('3 beds');
  });

  test('surfaces the recency window', () => {
    expect(describeFilters({ listed_within_days: 7 })).toContain('added in last 7d');
  });

  // Presets saved before the range fields existed must still read
  // correctly rather than showing "Any price".
  test('still describes a preset saved under the old filter shape', () => {
    expect(
      describeFilters({ location: 'Haifa', max_monthly_rent_ils: 6000, min_bedrooms: 2 }),
    ).toBe('Haifa · ≤ ₪6,000 · 2+ beds');
  });

  test('handles an empty preset', () => {
    expect(describeFilters({})).toBe('Any location · Any price');
  });
});
