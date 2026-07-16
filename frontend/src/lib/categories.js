/**
 * Frontend mirror of `backend/routes/marketplace/shared.py CATEGORIES`.
 *
 * Used anywhere we need to display a category label from its slug —
 * notification settings, snooze pages, dashboard chips, etc.  Keep in
 * sync with the backend list; if either drifts, the migration script
 * `backend/scripts/migrate_categories.py` also references
 * CATEGORY_MIGRATION to auto-remap legacy slugs at read-time.
 */
export const CATEGORY_LABELS = {
  'real-estate-services':  'Real Estate Services',
  'health-fitness':        'Health & Fitness',
  'personal-care':         'Personal Care',
  'transportation':        'Transportation',
  'home-services-repair':  'Home Services & Repair',
  'travel-tourism':        'Travel & Tourism',
  'creative-design':       'Creative & Design Services',
  'business-financial':    'Business & Financial Services',
  'moving-relocation':     'Moving & Relocation',
  'cleaning-services':     'Cleaning Services',
  'it-tech-support':       'IT & Tech Support',
  'education-tutoring':    'Education & Tutoring',
  'childcare-babysitting': 'Childcare & Babysitting',
  'pet-services':          'Pet Services',
  'events-catering':       'Events, Music & Catering',
  'other':                 'Other',
};

// Legacy → modern slug map. Applied at read-time on old bookmarks or
// saved-search links that were made before the 2026-07-15 restructure.
// Mirrors `CATEGORY_MIGRATION` in the backend shared.py.
export const LEGACY_CATEGORY_MIGRATION = {
  'womens-spa':          'personal-care',
  'home-organizers':     'home-services-repair',
  'home-repair':         'home-services-repair',
  'tours-activities':    'travel-tourism',
  'hotels-travel':       'travel-tourism',
  'photography':         'creative-design',
  'graphic-design':      'creative-design',
  'bookkeeping':         'business-financial',
  'music-entertainment': 'events-catering',
};

export const normalizeCategory = (slug) =>
  (slug && LEGACY_CATEGORY_MIGRATION[slug]) || slug || '';

export const labelForCategory = (slug) => {
  const normalized = normalizeCategory(slug);
  return CATEGORY_LABELS[normalized] || normalized || 'Other';
};

// Optional subcategory tags for merged buckets. Mirrors the backend
// SUBCATEGORIES map — kept as flat arrays so pickers stay dumb.
export const SUBCATEGORIES = {
  'home-services-repair': [
    { slug: 'plumbing',         label: 'Plumbing' },
    { slug: 'electrical',       label: 'Electrical' },
    { slug: 'handyman',         label: 'Handyman' },
    { slug: 'appliance-repair', label: 'Appliance Repair' },
    { slug: 'interior-design',  label: 'Interior Design' },
  ],
  'travel-tourism': [
    { slug: 'tour-guide',    label: 'Tour Guide' },
    { slug: 'tour-operator', label: 'Tour Operator' },
    { slug: 'hotel',         label: 'Hotel / Lodging' },
    { slug: 'travel-agency', label: 'Travel Agency' },
  ],
  'creative-design': [
    { slug: 'photography',    label: 'Photography' },
    { slug: 'videography',    label: 'Videography' },
    { slug: 'graphic-design', label: 'Graphic Design' },
    { slug: 'web-design',     label: 'Web Design' },
  ],
  'business-financial': [
    { slug: 'bookkeeping', label: 'Bookkeeping' },
    { slug: 'accounting',  label: 'Accounting' },
    { slug: 'tax-prep',    label: 'Tax Preparation' },
    { slug: 'legal',       label: 'Legal' },
    { slug: 'consulting',  label: 'Consulting' },
  ],
};
