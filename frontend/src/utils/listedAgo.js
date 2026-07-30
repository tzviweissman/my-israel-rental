/**
 * "Listed today / 3 days ago" freshness stamp for listing cards.
 *
 * In a market where good apartments are gone within hours, how recently
 * something was posted is one of the first things a renter wants to know —
 * and the cards had no way to say it.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Whole days between `created_at` and now, or `null` when unusable.
 *
 * `null` (not 0) for a missing or unparseable date: the caller renders
 * nothing rather than claiming a listing is brand new. Roughly 8 production
 * listings have no `created_at` at all, and "Listed today" on a six-month-old
 * listing is worse than no stamp.
 *
 * Compared on UTC-day boundaries rather than raw elapsed hours, so a listing
 * posted last night reads "Yesterday" rather than "today" — which is what
 * someone scanning a results page actually means by the word.
 */
export const daysSinceListed = (createdAt, now = Date.now()) => {
  if (!createdAt) return null;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;
  // Clock skew and server/client timezone differences can put a fresh listing
  // slightly in the future. Clamp rather than render "in 1 day".
  const diff = Math.max(0, now - ts);
  return Math.floor(diff / MS_PER_DAY);
};

/**
 * Translated label, or '' when there's nothing trustworthy to show.
 *
 * Buckets rather than exact counts past a week: "Listed 43 days ago" is
 * noise, and the useful signal is just "this is stale".
 *
 * @param {string}   createdAt ISO timestamp from the listing
 * @param {function} t         i18next translator
 */
export const listedAgoLabel = (createdAt, t, now = Date.now()) => {
  const days = daysSinceListed(createdAt, now);
  if (days == null) return '';
  const tr = typeof t === 'function' ? t : (_k, o) => (o && o.defaultValue) || '';
  // Interpolated as `n`, never `count`: passing `count` makes i18next resolve
  // a plural-suffixed key, and Hebrew has more plural categories (one/two/
  // many/other) than English. The two locales would end up with different key
  // sets and the parity check would flag drift on every one of these. Each
  // branch below is already narrowed to a range where one wording is correct.
  // Hebrew has a dual form: two weeks is "שבועיים", not "2 שבועות", and the
  // numeric version reads as broken Hebrew. English just spells the 2 out.
  // Separate keys keep both locales on the same key set.
  if (days === 0) return tr('stays.listedToday', { defaultValue: 'Listed today' });
  if (days === 1) return tr('stays.listedYesterday', { defaultValue: 'Listed yesterday' });
  if (days === 2) return tr('stays.listedTwoDays', { defaultValue: 'Listed 2 days ago' });
  // 3–6 days: plural in both languages.
  if (days < 7) return tr('stays.listedDaysAgo', { n: days, defaultValue: `Listed ${days} days ago` });
  if (days < 14) return tr('stays.listedWeekAgo', { defaultValue: 'Listed last week' });
  if (days < 21) return tr('stays.listedTwoWeeks', { defaultValue: 'Listed 2 weeks ago' });
  if (days < 31) {
    const n = Math.floor(days / 7);
    return tr('stays.listedWeeksAgo', { n, defaultValue: `Listed ${n} weeks ago` });
  }
  if (days < 62) return tr('stays.listedMonthAgo', { defaultValue: 'Listed last month' });
  if (days < 92) return tr('stays.listedTwoMonths', { defaultValue: 'Listed 2 months ago' });
  const n = Math.floor(days / 30);
  return tr('stays.listedMonthsAgo', { n, defaultValue: `Listed ${n} months ago` });
};

/** True for listings worth visually flagging as fresh (today or yesterday). */
export const isFreshListing = (createdAt, now = Date.now()) => {
  const days = daysSinceListed(createdAt, now);
  return days != null && days <= 1;
};
