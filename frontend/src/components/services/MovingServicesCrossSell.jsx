import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Truck, Sparkles, Wrench, X } from 'lucide-react';

/**
 * Cross-sell from the (free) rentals side into the (paid) services side.
 *
 * Shown at the two highest-intent moments in the rental flow: while reading a
 * listing, and right after sending a booking request — the point at which
 * someone has actually committed to moving and needs movers, cleaners and a
 * handyman.
 *
 * Deliberately a strip, not a modal: the brief is to add demand to services
 * without getting in the way of the rental. It never covers the booking CTA
 * and it can be dismissed.
 */

// Category slugs come from CATEGORIES in backend/routes/marketplace/shared.py.
// `subcategory` is only honoured by /services when a category is set too.
const CATEGORY_LINKS = [
  { key: 'movers', icon: Truck, category: 'moving-relocation' },
  { key: 'cleaners', icon: Sparkles, category: 'cleaning-services' },
  { key: 'handyman', icon: Wrench, category: 'home-services-repair', subcategory: 'handyman' },
];

// Marketplace location slugs (LOCATIONS in the same backend module). Only
// cities that exist on BOTH sides are here — a property in Eilat or Kfar Saba
// simply gets no location filter rather than a slug the services page would
// silently ignore.
const CITY_TO_SERVICE_SLUG = {
  jerusalem: 'jerusalem',
  'tel aviv': 'tel-aviv',
  'beit shemesh': 'bet-shemesh',
  'bet shemesh': 'bet-shemesh',
  modiin: 'modiin',
  netanya: 'netanya',
  haifa: 'haifa',
  ashdod: 'ashdod',
  beersheba: 'beersheba',
  herzliya: 'herzliya',
  raanana: 'raanana',
  "ra'anana": 'raanana',
  'rishon lezion': 'rishon',
  'petah tikva': 'petah-tikva',
};

/**
 * Marketplace location slug for a property's stored `area`, or '' when we
 * can't tell.
 *
 * Only the explicit "<City> - <Neighborhood>" shape and a bare city name are
 * accepted. A bare neighbourhood is deliberately NOT guessed: "Old City"
 * exists in both Jerusalem and Beersheba, and "Romema" in both Jerusalem and
 * Haifa, so inferring a city would filter the services list to the wrong one.
 * No filter is a better default than a confidently wrong filter.
 */
export const serviceLocationSlug = (area) => {
  const raw = (area == null ? '' : String(area)).trim();
  if (!raw) return '';
  const city = (raw.includes(' - ') ? raw.split(' - ')[0] : raw).trim().toLowerCase();
  return CITY_TO_SERVICE_SLUG[city] || '';
};

const buildHref = ({ category, subcategory }, locationSlug) => {
  const params = new URLSearchParams({ category });
  if (subcategory) params.set('subcategory', subcategory);
  if (locationSlug) params.set('location', locationSlug);
  return `/services?${params.toString()}`;
};

/**
 * @param {object}  property   the listing being viewed
 * @param {string}  variant    'detail' (browsing) | 'booked' (just enquired)
 * @param {string}  storageKey localStorage key holding the dismissal
 */
const MovingServicesCrossSell = ({ property, variant = 'detail', storageKey }) => {
  const { t } = useTranslation();
  const key = storageKey || `mir.crossSell.${variant}.dismissed`;

  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return window.localStorage.getItem(key) === '1';
    } catch {
      // Private-mode Safari throws on localStorage access. Showing the strip
      // is the safe failure: worst case the user dismisses it again.
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      /* Non-persistent dismissal is still better than ignoring the click. */
    }
  };

  if (dismissed) return null;

  const locationSlug = serviceLocationSlug(property?.area);
  const isBooked = variant === 'booked';

  return (
    <div
      className="rounded-2xl border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 bg-gradient-to-br from-[#f2f8f8] via-white to-[#f2f8f8] p-4 md:p-5"
      data-testid={`services-cross-sell-${variant}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm md:text-base font-bold text-gray-900">
            {isBooked
              ? t('services.crossSell.bookedTitle', 'Request sent — now sort the move out?')
              : t('services.crossSell.title', 'Moving in? Find movers, cleaners & handymen')}
          </h3>
          <p className="text-xs md:text-sm text-gray-600 mt-0.5">
            {t(
              'services.crossSell.subtitle',
              'Service providers across Israel who work with English speakers.',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 -m-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
          aria-label={t('services.crossSell.dismiss', 'Hide this suggestion')}
          data-testid={`services-cross-sell-dismiss-${variant}`}
        >
          <X size={16} />
        </button>
      </div>

      {/* One link per category rather than a single button: /services filters
          by a single category at a time, so three targeted entry points beat
          one that lands on an unfiltered list. */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.key}
              to={buildHref(link, locationSlug)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold bg-white border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/25 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white transition-colors"
              data-testid={`services-cross-sell-${link.key}`}
            >
              <Icon size={14} />
              {t(`services.crossSell.${link.key}`, link.key)}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MovingServicesCrossSell;
