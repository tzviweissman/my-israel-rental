/**
 * The facts a customer needs before they will ask — pulled off a gig's
 * tiers, and shown only where they are real.
 *
 * The catalogue rows were a name, one truncated line and a price. That is
 * enough to compare prices and not enough to choose: a customer cannot tell
 * how long it takes, or what is actually included, so the cheapest option
 * looks like the same thing for less. Uncertainty is what stops people
 * asking, and the row removed none of it.
 *
 * Everything here is read from data the owner already entered
 * (`tiers[].duration_minutes`, `tiers[].features`). Nothing is inferred and
 * nothing is estimated — a gig whose owner has filled in neither shows
 * neither, exactly as it does today.
 */

/** Minutes rendered the way a person says them: 30m, 1h, 1h 30m, 2h. */
export function formatDuration(minutes, t) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (!h) return t('serviceFacts.minutes', { defaultValue: '{{n}} min', n: rem });
  if (!rem) return t('serviceFacts.hours', { defaultValue: '{{n}}h', n: h });
  return t('serviceFacts.hoursMinutes', { defaultValue: '{{h}}h {{m}}m', h, m: rem });
}

/**
 * `{ duration, includes }` for one gig, or nulls.
 *
 * Duration comes from the CHEAPEST tier rather than the first, because the
 * price shown on the row is the cheapest one and the two facts have to
 * describe the same thing. A row reading "from ₪260 · 2h" where the ₪260
 * option takes 45 minutes is worse than showing no duration at all.
 */
export function serviceFacts(gig, t) {
  const tiers = Array.isArray(gig?.tiers) ? gig.tiers.filter(Boolean) : [];
  if (!tiers.length) return { duration: null, includes: [] };

  const priced = tiers.filter((x) => Number.isFinite(Number(x?.price)));
  const cheapest = priced.length
    ? priced.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b))
    : tiers[0];

  const includes = (Array.isArray(cheapest?.features) ? cheapest.features : [])
    .map((f) => String(f || '').trim())
    .filter(Boolean);

  return { duration: formatDuration(cheapest?.duration_minutes, t), includes };
}

export default serviceFacts;
