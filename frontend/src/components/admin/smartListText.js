/**
 * Pure helpers behind the Smart Lists tab — filter option sets, the
 * WhatsApp/copy message builder, the sort, and the saved-preset summary.
 *
 * Split out of SmartListsTab.jsx so these can be unit-tested without
 * pulling React, axios and the whole App module graph into the test run.
 * Nothing here touches the DOM, the network or component state.
 */

export const AVAILABILITY_OPTIONS = [
  { value: 'next_month', label: 'Available within the next month' },
  { value: 'next_3_months', label: 'Available within the next 3 months' },
  { value: 'next_6_months', label: 'Available within the next 6 months' },
  { value: 'anytime', label: 'Available anytime (no date restriction)' },
];

export const formatPrice = (amount, currency) => {
  if (amount == null) return '-';
  const sym = currency === 'USD' ? '$' : '₪';
  return `${sym}${Number(amount).toLocaleString()}`;
};

export const RENTAL_CATEGORY_OPTIONS = [
  { value: 'any', label: 'Any type' },
  { value: 'long-term', label: 'Long-term' },
  { value: 'short-term', label: 'Short-term' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'sukkot', label: 'Sukkot rental' },
  { value: 'pesach', label: 'Pesach rental' },
];

export const VACATION_LIKE_CATEGORIES = new Set(['vacation', 'sukkot', 'pesach']);

// "Added in the last…" buckets. `''` means no recency restriction.
export const LISTED_WITHIN_OPTIONS = [
  { value: '',   label: 'Any time' },
  { value: '7',  label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

// How many listings may go into one message. WhatsApp will carry more,
// but a recipient will not read more — the cap is about the reader, not
// the protocol. `0` is the deliberate escape hatch for "send everything".
export const SEND_CAP_OPTIONS = [5, 10, 15, 20, 25, 0];

// The link is what gets cut off, so the link is what is measured. The first
// version compared the raw message against 3900, but the message travels
// URL-encoded: every ₪ is sent as %E2%82%AA (9 characters for 1), every
// newline as %0A and every space as %20. A message that measured 3600 could
// reach WhatsApp far longer, and the tail was dropped exactly as before.
// 3900 is the budget the tool always assumed, now spent in the unit that
// actually overflows.
export const WA_URL_LIMIT = 3900;

/** The wa.me link for a message. Measure THIS, never the raw text. */
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text || '')}`;

export const formatAvailable = (iso, now = new Date()) => {
  if (!iso) return 'Available now';
  try {
    // A bare "YYYY-MM-DD" is a calendar day, not an instant. `new Date()`
    // reads it as midnight UTC, which west of UTC is the evening before,
    // so a flat free on the 24th was announced for the 23rd.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
    if (Number.isNaN(d.getTime())) return `Available ${iso}`;
    // A date already passed means it is free now. "Available July 15",
    // sent in September, read as next July (a real Sukkot list, 17 Sep
    // 2026). Compared by calendar day, so today's date is "now" too.
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    if (day(d) <= day(now)) return 'Available now';
    return `Available ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  } catch {
    return `Available ${iso}`;
  }
};

export const formatBedrooms = (n) => {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  // 2.5 BR etc. — round to 1 decimal but drop trailing ".0".
  const display = v % 1 === 0 ? `${v}` : v.toFixed(1);
  return `${display} bedroom${v === 1 ? '' : 's'}`;
};

/**
 * Whole days since a listing was added, or null when unusable.
 *
 * null (not 0) for a missing/unparseable date — a handful of production
 * rows predate `created_at`, and stamping "Added today" on a six-month-old
 * listing is worse than showing nothing. Mirrors utils/listedAgo.js.
 */
export const daysSinceAdded = (createdAt, now = Date.now()) => {
  if (!createdAt) return null;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;
  // Clock skew can put a fresh listing slightly in the future; clamp
  // rather than render "added in 1 day".
  return Math.floor(Math.max(0, now - ts) / 86400000);
};

// Stands in for i18next's `t` when none is passed (tests, and any caller
// outside React): returns the English fallback with {{n}} filled in.
const fallbackT = (_key, fallback, opts) => String(fallback).replace('{{n}}', opts?.n);

/**
 * "Added today / yesterday / N days ago", or null.
 *
 * Takes the component's `t` so the stamp is translated, while staying pure
 * and testable. null when the date is missing or unusable (never "Added
 * today"), and null past a month, where it stops being a selling point.
 * Interpolates `n`, never `count` - see the note on sweep.matchedSelected.
 */
export const formatAdded = (createdAt, t = fallbackT, now = Date.now()) => {
  const d = daysSinceAdded(createdAt, now);
  if (d == null) return null;
  if (d === 0) return t('sweep.addedToday', 'Added today');
  if (d === 1) return t('sweep.addedYesterday', 'Added yesterday');
  if (d < 31) return t('sweep.addedDaysAgo', 'Added {{n}} days ago', { n: d });
  return null;
};

export const stripCity = (loc) => {
  if (!loc) return '';
  const trimmed = loc.trim();
  return trimmed.includes(' - ') ? trimmed.split(' - ', 2)[1].trim() : trimmed;
};

export const CATEGORY_TITLE = {
  any: 'rentals',
  'long-term': 'long-term rentals',
  'short-term': 'short-term rentals',
  vacation: 'vacation rentals',
  sukkot: 'Sukkot rentals',
  pesach: 'Pesach rentals',
};

export const buildHeader = (filters) => {
  // Headline broker-style: "MyIsraelRental.com" big, then "<Neighborhood>
  // <category> rentals" subtitle. WhatsApp/email recipients should know in
  // two seconds where the list came from and what's in it.
  const neighborhood = stripCity(filters?.location);
  const categoryLabel = CATEGORY_TITLE[filters?.rental_category] || 'rentals';
  let subtitle = neighborhood
    ? `${neighborhood} ${categoryLabel}`
    : categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1);
  // A recency-filtered blast is a different message from a catalogue —
  // say so in the subtitle so the recipient knows these are new.
  const days = Number(filters?.listed_within_days) || 0;
  if (days > 0) {
    const prefix =
      days <= 7 ? 'Just listed' : days <= 14 ? 'New this fortnight' : 'New this month';
    subtitle = `${prefix} - ${subtitle}`;
  }
  return ['MyIsraelRental.com', subtitle];
};

export const buildCopyText = (properties, filters = {}) => {
  const [brand, subtitle] = buildHeader(filters);
  // Leading the message with the bare homepage URL on its own line is the
  // trick that gets messaging apps (WhatsApp, iMessage, Telegram) to fetch
  // the site's Open Graph metadata and render the MyIsraelRental logo as
  // the preview card at the very top of the message. Without this, the
  // first URL in the message would be a property listing URL and WhatsApp
  // would show that property's photo as the preview instead of the logo.
  const SITE_URL = 'https://myisraelrental.com';
  const body = properties
    .map((p) => {
      // When the admin picked a specific location, force every row to that
      // canonical form so the list never mixes "Maalot Dafna" with
      // "Jerusalem - Maalot Dafna".
      const area = filters?.location || p.area || 'Israel';
      const beds = formatBedrooms(p.bedrooms);
      const lines = [
        area,
        `${formatPrice(p.price, p.currency)}${p.price_label || ''}`,
      ];
      if (beds) lines.push(beds);
      lines.push(formatAvailable(p.available_from));
      lines.push(p.listing_url);
      return lines.join('\n');
    })
    .join('\n\n');
  return `${SITE_URL}\n\n${brand}\n${subtitle}\n\n${body}`;
};

/**
 * One-line summary of a saved preset's filters.
 *
 * Extracted from the JSX because the inline version only knew about the
 * two filters that existed when it was written, so every filter added
 * since was invisible on the saved row — you had to open a list to find
 * out what it actually did.
 */
export const describeFilters = (f = {}) => {
  const parts = [f.location || 'Any location'];
  if (f.rental_category && f.rental_category !== 'any') parts.push(f.rental_category);

  const min = f.min_monthly_rent_ils;
  const max = f.max_monthly_rent_ils;
  const money = (n) => `₪${Number(n).toLocaleString()}`;
  if (min != null && max != null) parts.push(`${money(min)}–${money(max)}`);
  else if (max != null) parts.push(`≤ ${money(max)}`);
  else if (min != null) parts.push(`≥ ${money(min)}`);
  else parts.push('Any price');

  const bMin = f.min_bedrooms;
  const bMax = f.max_bedrooms;
  if (bMin != null && bMax != null) {
    parts.push(bMin === bMax ? `${bMin} bed` : `${bMin}–${bMax} beds`);
  } else if (bMin != null) parts.push(`${bMin}+ beds`);
  else if (bMax != null) parts.push(`up to ${bMax} beds`);

  if (f.listed_within_days) parts.push(`added in last ${f.listed_within_days}d`);
  return parts.join(' · ');
};

// ── The selection rules ─────────────────────────────────────────────────
//
// The part of the tab that decides what is actually SENT. Pure, so the
// rules can be tested without mounting the component (site audit
// 2026-09-14, finding 6: the selection layer had no coverage at all).
// `cap` is listings per message; 0 means no cap.

/** The first `cap` ids on screen, or all of them when uncapped. */
export const topIds = (rows, cap) => (rows || []).slice(0, cap > 0 ? cap : undefined).map((p) => p.id);

/**
 * Tick or untick one row.
 *
 * Unticking always works, including at the cap, so a pick can be swapped.
 * A tick past the cap is REFUSED and the selection returned unchanged,
 * never made room for by evicting someone else's pick.
 */
export const toggleSelection = (ids, id, cap) => {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), refused: false };
  if (cap > 0 && ids.length >= cap) return { ids, refused: true };
  return { ids: [...ids, id], refused: false };
};

/** Lowering the cap keeps the earliest picks, in the order they were made. */
export const trimToCap = (ids, cap) => (cap > 0 && ids.length > cap ? ids.slice(0, cap) : ids);

export const SORT_OPTIONS = [
  { value: 'default',       label: 'Default order' },
  { value: 'newest',        label: 'Newest first' },
  { value: 'oldest',        label: 'Oldest first' },
  { value: 'price_asc',     label: 'Cheapest first' },
  { value: 'price_desc',    label: 'Most expensive first' },
  { value: 'bedrooms_asc',  label: 'Fewest bedrooms first' },
  { value: 'bedrooms_desc', label: 'Most bedrooms first' },
];

/**
 * Sort the generated property list by the chosen criterion. Returns a
 * new array — never mutates the original. Properties with missing fields
 * are pushed to the end regardless of sort direction (so a price-asc
 * sort won't bubble priceless rows to the top just because `null < 1`).
 *
 * Currency normalization: if the smart-list endpoint included a
 * usd_to_ils_rate, USD-priced rows are converted to an ILS-equivalent
 * for sort purposes only. Display values stay untouched.
 */
export const applySort = (properties, sortOrder, usdToIlsRate) => {
  if (!sortOrder || sortOrder === 'default' || !properties?.length) return properties;
  const sorted = [...properties];

  const priceInIls = (p) => {
    if (p.price == null) return null;
    const v = Number(p.price);
    if (!Number.isFinite(v)) return null;
    // Fall back to a sensible USD→ILS rate when the backend doesn't
    // include one (e.g. no live FX in the response). Keeps a mixed-
    // currency list ordered roughly correctly. Display values are
    // untouched — this conversion is for sort only.
    const fallbackRate = 3.7;
    if (p.currency === 'USD') return v * (usdToIlsRate || fallbackRate);
    return v;
  };
  const bedrooms = (p) => {
    if (p.bedrooms == null) return null;
    const v = Number(p.bedrooms);
    return Number.isFinite(v) ? v : null;
  };
  const addedAt = (p) => {
    if (!p.created_at) return null;
    const ts = Date.parse(p.created_at);
    return Number.isNaN(ts) ? null : ts;
  };

  // Stable sort that pushes nulls to the end no matter the direction.
  const cmp = (asc, getter) => (a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return asc ? av - bv : bv - av;
  };

  switch (sortOrder) {
    case 'price_asc':     sorted.sort(cmp(true,  priceInIls)); break;
    case 'price_desc':    sorted.sort(cmp(false, priceInIls)); break;
    case 'bedrooms_asc':  sorted.sort(cmp(true,  bedrooms));   break;
    case 'bedrooms_desc': sorted.sort(cmp(false, bedrooms));   break;
    // Undated rows sort last in BOTH directions (cmp pushes nulls to the
    // end regardless), so "oldest first" never leads with a listing whose
    // age we don't actually know.
    case 'newest':        sorted.sort(cmp(false, addedAt));    break;
    case 'oldest':        sorted.sort(cmp(true,  addedAt));    break;
    default: break;
  }
  return sorted;
};
