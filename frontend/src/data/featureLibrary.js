/**
 * The feature library (spec `docs/perks-and-features-spec.md` Part 1).
 *
 * ONE list, feeding both the card grid at `/what-you-can-do` and every
 * detail page at `/features/{slug}`. Two lists would drift, and the one
 * that drifts is the one a stranger reads first.
 *
 * F5 — HONESTY. Only what exists today. Every entry below was checked
 * against the code before it was written, and the module that implements
 * it is named in `built`. Nothing aspirational, nothing half-built.
 *
 * Deliberately ABSENT, and each for a reason:
 *   * Perks — Part 2 of the same spec, not built. It would be the most
 *     attractive card here and it would be a lie.
 *   * Document / government services — discontinued (CLAUDE.md). Code may
 *     still exist behind DOCUMENT_SERVICES_ENABLED; it stays off.
 *   * Storage rentals — discontinued. The `storage` rental_type survives in
 *     code and must not be marketed.
 *
 * F3 — BENEFIT LANGUAGE, NEVER FEATURE NAMES. The titles below are what
 * the thing DOES FOR YOU. "iCal sync" is what we call it; "your calendar
 * stays right, everywhere" is why anyone would care. Where a card saves
 * someone time, the copy says so plainly — that is usually the real
 * reason to bother.
 *
 * AUDIENCES match `/join` exactly: traveller, host, business.
 */

export const AUDIENCES = ['business', 'host', 'traveller'];

/**
 * @typedef {object} Feature
 * @property {string}   slug       URL at /features/{slug}
 * @property {string}   icon       lucide-react icon name
 * @property {string[]} audiences  who this is for
 * @property {string}   cta        where the CTA sends someone to use it
 * @property {string}   built      the code that proves it exists (F5)
 */
export const FEATURES = [
  // ---- Business owner -------------------------------------------------
  {
    slug: 'your-own-page',
    icon: 'Store',
    audiences: ['business'],
    cta: '/dashboard?tab=my-businesses',
    built: 'frontend/src/pages/BusinessPage.jsx',
  },
  {
    slug: 'put-it-on-a-flyer',
    icon: 'QrCode',
    audiences: ['business', 'host'],
    cta: '/dashboard',
    built: 'backend/routes/short_links.py',
  },
  {
    slug: 'write-in-english',
    icon: 'Languages',
    audiences: ['business', 'host', 'traveller'],
    cta: '/dashboard?tab=messages',
    built: 'backend/utils/chat_translate.py',
  },
  {
    slug: 'take-payment',
    icon: 'CreditCard',
    audiences: ['business'],
    cta: '/dashboard?tab=my-businesses',
    built: 'backend/utils/payment_links.py',
  },
  {
    slug: 'work-comes-to-you',
    icon: 'Briefcase',
    audiences: ['business'],
    cta: '/businesses/jobs',
    built: 'frontend/src/pages/JobsBoard.jsx',
  },
  {
    slug: 'block-your-time',
    icon: 'CalendarOff',
    audiences: ['business'],
    cta: '/dashboard?tab=my-businesses',
    built: 'frontend/src/components/dashboard/BlockTimePanel.jsx',
  },

  // ---- Property host --------------------------------------------------
  {
    slug: 'one-calendar',
    icon: 'CalendarSync',
    audiences: ['host'],
    cta: '/dashboard',
    built: 'backend/routes/ical.py',
  },
  {
    slug: 'sign-without-printing',
    icon: 'FileSignature',
    audiences: ['host', 'traveller'],
    cta: '/dashboard?tab=contracts',
    built: 'backend/routes/contracts.py',
  },
  {
    slug: 'instant-or-ask',
    icon: 'Zap',
    audiences: ['host'],
    cta: '/dashboard',
    built: 'frontend/src/components/dashboard/AddPropertyModal.jsx',
  },
  {
    slug: 'many-at-once',
    icon: 'Upload',
    audiences: ['host'],
    cta: '/dashboard?tab=bulk-manager',
    built: 'backend/routes/bulk_upload.py',
  },
  {
    slug: 'what-to-charge',
    icon: 'TrendingUp',
    audiences: ['host'],
    cta: '/dashboard',
    built: 'frontend/src/components/dashboard/SmartPricingModal.jsx',
  },
  {
    slug: 'see-what-works',
    icon: 'BarChart3',
    audiences: ['host', 'business'],
    cta: '/dashboard',
    built: 'frontend/src/components/dashboard/PerformancePanel.jsx',
  },

  // ---- Traveller / renter ---------------------------------------------
  {
    slug: 'tell-owners-what-you-want',
    icon: 'Megaphone',
    audiences: ['traveller'],
    cta: '/requests/post',
    built: 'frontend/src/pages/RequestsBoard.jsx',
  },
  {
    slug: 'tell-me-when-it-appears',
    icon: 'BellRing',
    audiences: ['traveller'],
    cta: '/stays',
    built: 'backend/routes/saved_searches.py',
  },
  {
    slug: 'hire-a-local-pro',
    icon: 'Sparkles',
    audiences: ['traveller'],
    cta: '/businesses',
    built: 'frontend/src/pages/Services.jsx',
  },
];

/** Features for one audience, in list order. */
export function featuresFor(audience) {
  return FEATURES.filter((f) => f.audiences.includes(audience));
}

/** One feature by slug, or undefined. */
export function featureBySlug(slug) {
  return FEATURES.find((f) => f.slug === slug);
}

/**
 * The audience tab to open on.
 *
 * Signed out it is `business`, per the CLAUDE.md positioning note that the
 * supply side leads. Signed in it is the person's own role, because
 * someone who has told us what they are should not have to say it twice.
 */
export function defaultAudience(role) {
  if (role === 'owner' || role === 'manager') return 'host';
  if (role === 'provider') return 'business';
  if (role === 'renter') return 'traveller';
  return 'business';
}
