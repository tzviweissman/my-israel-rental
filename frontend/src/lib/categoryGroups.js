/**
 * Grouping for the category pickers (spec N2).
 *
 * `docs/categories-expansion-spec.md` ruling 2 makes new niches top-level
 * categories rather than subcategories, which takes the list past twenty.
 * That overrides the principle written into `shared.py`:
 *
 *   "the alternative is a new slug per trade and a list nobody can scan."
 *
 * The concern is real and this file is the answer to it. A flat list of
 * twenty-five is a list whose bottom half dies; a grouped one is fine.
 * The spec is explicit that N1 does not ship unless this does.
 *
 * PRESENTATION ONLY. There is no `group` field on a gig, on a category
 * record, or anywhere in Mongo. A business's category is its slug, and
 * these groups exist so the picker can be re-arranged by editing this
 * file — never a migration. Nothing here may be persisted or sent to the
 * API.
 *
 * THE ORDER IS THE PRODUCT. Groups run in the order below and that order
 * is deliberate: Home & Property leads because rentals lead
 * (`CLAUDE.md`), and the groups after it run roughly by expected demand.
 * Within a group, slugs run in the order written here, not alphabetically
 * — alphabetical ordering is a coin toss dressed up as a rule.
 *
 * THE UNGROUPED CASE IS THE IMPORTANT ONE. The categories come from the
 * API, not from this file, so the backend can add one that no group here
 * knows about. When that happens it lands in a trailing "More" group
 * rather than vanishing from the picker. A new category that cannot be
 * chosen is worse than an ugly one, and it fails silently — nobody
 * notices until a business asks why their trade isn't on the list.
 */

/**
 * Ordered groups. `slugs` may name categories that do not exist yet
 * (N1 adds several); unknown slugs are skipped, so this list can lead
 * the backend without breaking.
 */
export const CATEGORY_GROUPS = [
  {
    id: 'home-property',
    labelKey: 'categoryGroups.homeProperty',
    labelDefault: 'Home & Property',
    slugs: [
      'home-services-repair',
      'cleaning-services',
      'moving-relocation',
      'real-estate-services',
    ],
  },
  {
    id: 'buy-sell',
    labelKey: 'categoryGroups.buySell',
    labelDefault: 'Buy & Sell',
    slugs: ['buy-sell', 'shops-products', 'vehicles'],
  },
  {
    id: 'money-admin',
    labelKey: 'categoryGroups.moneyAdmin',
    labelDefault: 'Money & Admin',
    slugs: [
      'money-exchange',
      'business-financial',
      'insurance',
      'immigration-documents',
    ],
  },
  {
    id: 'personal-family',
    labelKey: 'categoryGroups.personalFamily',
    labelDefault: 'Personal & Family',
    slugs: [
      'personal-care',
      'health-fitness',
      'medical-health',
      'childcare-babysitting',
      'education-tutoring',
      'pet-services',
    ],
  },
  {
    id: 'events-creative',
    labelKey: 'categoryGroups.eventsCreative',
    labelDefault: 'Events & Creative',
    slugs: ['events-catering', 'creative-design', 'travel-tourism'],
  },
  {
    id: 'community',
    labelKey: 'categoryGroups.community',
    labelDefault: 'Community',
    slugs: ['religious-services'],
  },
  {
    id: 'tech-transport',
    labelKey: 'categoryGroups.techTransport',
    labelDefault: 'Tech & Transport',
    slugs: ['it-tech-support', 'transportation'],
  },
];

/** Trailing catch-all. See the note above about the ungrouped case. */
export const OTHER_GROUP = {
  id: 'more',
  labelKey: 'categoryGroups.more',
  labelDefault: 'More',
};

/** slug → group id, built once. */
const GROUP_OF = new Map();
CATEGORY_GROUPS.forEach((g) => g.slugs.forEach((s) => {
  // First group wins, so a slug listed twice by mistake shows up once
  // rather than in two places — a category appearing twice in a picker
  // reads as a bug to the person using it.
  if (!GROUP_OF.has(s)) GROUP_OF.set(s, g.id);
}));

export const groupIdForCategory = (slug) => GROUP_OF.get(slug) || OTHER_GROUP.id;

/**
 * Arrange the API's category list into display groups.
 *
 * @param {Array<{slug: string, label: string}>} categories from the API
 * @param {Function} t  i18next `t`; omit for raw English defaults
 * @returns {Array<{id, label, items}>} groups in order, empties dropped,
 *          every input category present exactly once
 */
export function groupCategories(categories, t) {
  const tr = typeof t === 'function' ? t : (_k, d) => d;
  const byId = new Map();

  (categories || []).forEach((c) => {
    if (!c || !c.slug) return;
    const gid = groupIdForCategory(c.slug);
    if (!byId.has(gid)) byId.set(gid, []);
    // The API serves labels in English only, so without this a Hebrew
    // visitor read English category names under Hebrew group headings.
    // The API's own label is the fallback, so a category the backend has
    // but the locale files do not still shows its name.
    byId.get(gid).push({ ...c, label: tr(`categoryLabels.${c.slug}`, c.label) });
  });

  // Within a group, follow the order written above rather than the
  // order the API happened to return.
  const rank = (gid) => {
    const g = CATEGORY_GROUPS.find((x) => x.id === gid);
    return (slug) => {
      const i = g ? g.slugs.indexOf(slug) : -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
  };

  const out = [];
  [...CATEGORY_GROUPS, OTHER_GROUP].forEach((g) => {
    const items = byId.get(g.id);
    if (!items || !items.length) return;   // an empty group is noise
    const r = rank(g.id);
    items.sort((a, b) => r(a.slug) - r(b.slug));
    out.push({ id: g.id, label: tr(g.labelKey, g.labelDefault), items });
  });
  return out;
}

/**
 * The same list flattened back out, with a `groupLabel` on each entry.
 *
 * For pickers whose markup cannot nest — a `<Combobox>` filtering one
 * flat array, say. They still get the grouped ORDER, and can show the
 * group as a hint beside the label.
 */
export function flattenGrouped(groups) {
  return groups.flatMap((g) => g.items.map((c) => ({ ...c, groupId: g.id, groupLabel: g.label })));
}
