/**
 * Turn a business's services into the groups its page renders (spec C1).
 *
 * One place, because the same rules are needed by the sections, the
 * sticky chip nav and the search, and three copies would drift.
 *
 * Order of preference:
 *
 *  1. The owner's own collections. Only they know that "Shabbos
 *     packages" is a meaningful group; no clustering we invent will beat
 *     that. A service may appear in several, which is deliberate — a
 *     Shabbos package belongs under both "Shabbos" and "Packages" and
 *     making the owner choose serves nobody.
 *
 *  2. Failing that, and only past a threshold, auto-group by category.
 *     This is a FALLBACK, not a feature: it exists so a business with
 *     twenty ungrouped services is not an undifferentiated wall while
 *     they get round to organising it. Labelled plainly so nobody
 *     mistakes it for curation.
 *
 *  3. Below the threshold, one flat list. Six services do not need
 *     sections, and adding them would be ceremony.
 *
 * Anything in no group lands in "More from this business". Never orphan
 * a service — an item that exists but appears nowhere is worse than an
 * ugly group, because the owner cannot tell it is missing.
 */

// Below this many services, grouping costs more than it gives.
export const AUTO_GROUP_MIN = 8;

// Fewest services a category needs before it earns its own heading.
export const AUTO_GROUP_MIN_SIZE = 2;

const titleCase = (s) =>
  String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * @returns {{groups: Array, mode: 'owner'|'auto'|'flat'}}
 *   groups: [{ id, name, description, services: [...] }]
 *   mode:   which rule produced them, so the UI can prompt an owner
 *           whose page is only held together by the fallback.
 */
/**
 * How answerable a listing is, 0-4. Higher sorts first WITHIN a group.
 *
 * Nothing on this page decided what a first-time visitor sees first, so the
 * order was whatever the database returned. That matters: the first two
 * rows are most of what a shared link gets looked at, and landing on a
 * nameless service with no photo and no price is the version of this page
 * least likely to be sent to anyone.
 *
 * Deliberately NOT a popularity or a demand signal. There is no data for
 * either, and inventing one would be exactly the fabricated-demand pattern
 * this project refuses. This ranks how much of the customer's question the
 * listing can answer — a photo, a description, a price, a stated duration
 * or contents — so the listings that can be judged come first.
 *
 * The side effect is the honest kind: an owner who fills their listings in
 * gets seen first, and the ones who have not are not hidden, only later.
 *
 * Ties keep their original relative order (Array#sort is stable), so a
 * business whose listings are all equally complete sees no reshuffling.
 */
export function answerability(gig) {
  if (!gig) return 0;
  let score = 0;
  const tiers = Array.isArray(gig.tiers) ? gig.tiers : [];
  const products = Array.isArray(gig.products) ? gig.products : [];

  const hasPhoto = Boolean(
    (Array.isArray(gig.gallery) && gig.gallery[0])
    || tiers.some((t) => Array.isArray(t?.images) && t.images[0])
    || products.some((p) => Array.isArray(p?.images) && p.images[0]),
  );
  if (hasPhoto) score += 1;
  if (String(gig.description || '').trim().length > 20) score += 1;
  if (Number.isFinite(Number(gig.cheapest_price))) score += 1;
  if (tiers.some((t) => Number(t?.duration_minutes) > 0
      || (Array.isArray(t?.features) && t.features.length))) score += 1;
  return score;
}

/** Most answerable first, stable within equal scores. */
function byAnswerability(services) {
  return [...services].sort((a, b) => answerability(b) - answerability(a));
}

export function buildCollections(listings = [], collections = [], { t } = {}) {
  const all = Array.isArray(listings) ? listings : [];
  const label = (key, fallback) => (t ? t(key, fallback) : fallback);

  if (!all.length) return { groups: [], mode: 'flat' };

  const byId = new Map(all.map((g) => [g.id, g]));
  const owner = (collections || []).filter((c) => c && (c.service_ids || []).length);

  if (owner.length) {
    const used = new Set();
    const groups = owner
      .map((c) => {
        // Stale ids are skipped rather than rendered as holes: a service
        // deleted after being grouped should vanish, not leave a gap.
        const services = (c.service_ids || [])
          .map((id) => byId.get(id))
          .filter(Boolean);
        services.forEach((g) => used.add(g.id));
        return { id: c.id, name: c.name, description: c.description || '', services: byAnswerability(services) };
      })
      .filter((g) => g.services.length);

    const leftover = all.filter((g) => !used.has(g.id));
    if (leftover.length) {
      groups.push({
        id: '__more__',
        name: label('businessPage.moreFrom', 'More from this business'),
        description: '',
        services: byAnswerability(leftover),
      });
    }
    return { groups, mode: 'owner' };
  }

  if (all.length < AUTO_GROUP_MIN) {
    return {
      groups: [{ id: '__all__', name: '', description: '', services: byAnswerability(all) }],
      mode: 'flat',
    };
  }

  // Auto-group by the category each service already carries.
  const buckets = new Map();
  for (const g of all) {
    const key = g.category || '__other__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(g);
  }
  // A category with a single service is not a group. Ten services
  // across six categories produced four sections of one item each -
  // more headings than content, and it reads as broken rather than
  // organised. Anything under the minimum joins the catch-all.
  const strays = [];
  const real = [];
  for (const [key, services] of buckets.entries()) {
    if (key === '__other__' || services.length < AUTO_GROUP_MIN_SIZE) strays.push(...services);
    else real.push([key, services]);
  }

  // Biggest first: the largest group is the likeliest thing a visitor
  // came for, and it makes the page open with substance.
  const groups = real
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, services]) => ({
      id: `auto-${key}`,
      name: titleCase(key),
      description: '',
      services: byAnswerability(services),
    }));

  if (strays.length) {
    groups.push({
      id: '__more__',
      name: label('businessPage.moreFrom', 'More from this business'),
      description: '',
      services: byAnswerability(strays),
    });
  }

  // If nothing survived as a real group, sections add nothing over one
  // list - which is the honest outcome for a business whose services are
  // all in different categories.
  if (!groups.length || (groups.length === 1 && groups[0].id === '__more__')) {
    return { groups: [{ id: '__all__', name: '', description: '', services: all }], mode: 'flat' };
  }
  return { groups, mode: 'auto' };
}

export default buildCollections;
