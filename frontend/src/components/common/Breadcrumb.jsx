/**
 * Breadcrumb — a lightweight "you came from" trail for detail pages.
 *
 * Reads `sessionStorage.previousPath` via the shared back-navigation
 * hook and renders a single-level trail: [origin label] › [current
 * page label]. Clicking the origin behaves exactly like the page's
 * existing "Back" button — same URL, same filter preservation — but
 * gives the visitor an inline visual confirmation that Back will
 * preserve their work.
 *
 * The trail is filter-aware:
 *   /stays?area=Jerusalem              → "Stays · Jerusalem"
 *   /properties/long-term?bedrooms=2   → "Long-term rentals · 2 bed"
 *   /services?category=home-repair     → "Services · Home repair"
 *   /services/jobs?category=cleaning   → "Jobs board · Cleaning"
 *   /manager/<id>?area=Jerusalem       → "Manager listings · Jerusalem"
 *
 * If `previousPath` is empty or doesn't match one of the whitelisted
 * origin prefixes, the whole breadcrumb collapses to null so we never
 * render a broken or misleading trail.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { readReturnPath } from '../../hooks/useBackNavigation';

// Human-readable overrides for URL slug values on the property/services
// filter keys. Everything else falls through to a titleized version of
// the raw slug ("home-repair" → "Home repair").
const RENTAL_TYPE_LABELS = {
  'long-term': 'Long-term rentals',
  'short-term': 'Short-term rentals',
  vacation: 'Vacation rentals',
  storage: 'Storage',
  sukkot: 'Sukkot rentals',
  pesach: 'Pesach rentals',
  all: 'All rentals',
};

const titleize = (raw) => {
  if (!raw) return '';
  return raw
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Turn a stored path into `{ label, to }`. `label` is the origin section
// name + optional filter chip. `to` is the full path+search we return
// to on click.
const parseOrigin = (path) => {
  if (!path) return null;
  let url;
  try {
    url = new URL(path, 'http://x'); // dummy base so URL() accepts a relative path
  } catch {
    return null;
  }
  const p = url.pathname;
  const q = url.searchParams;
  const chip = (key, transform = titleize) => {
    const raw = q.get(key);
    return raw ? transform(raw) : null;
  };

  // /properties/:type[?bedrooms=&area=&...]
  const propMatch = p.match(/^\/properties\/([^/]+)/);
  if (propMatch) {
    const type = propMatch[1];
    const base = RENTAL_TYPE_LABELS[type] || titleize(type);
    const areaChip = chip('area');
    const bedChip = q.get('min_bedrooms') ? `${q.get('min_bedrooms')}+ bed` : null;
    const suffix = areaChip || bedChip;
    return { label: suffix ? `${base} · ${suffix}` : base, to: path };
  }

  if (p === '/stays' || p === '/kosher-stays-in-israel') {
    const base = p === '/kosher-stays-in-israel' ? 'Kosher stays' : 'Stays';
    const suffix = chip('area');
    return { label: suffix ? `${base} · ${suffix}` : base, to: path };
  }

  if (p.startsWith('/manager/')) {
    const type = q.get('type');
    const area = chip('area');
    const suffix = area || (type ? (RENTAL_TYPE_LABELS[type] || titleize(type)) : null);
    return { label: suffix ? `Manager listings · ${suffix}` : 'Manager listings', to: path };
  }

  if (p === '/services') {
    const suffix = chip('category');
    return { label: suffix ? `Services · ${suffix}` : 'Services', to: path };
  }

  if (p.startsWith('/services/jobs')) {
    const suffix = chip('category');
    return { label: suffix ? `Jobs board · ${suffix}` : 'Jobs board', to: path };
  }

  return null;
};

const Breadcrumb = ({ current, testId = 'breadcrumb' }) => {
  const origin = parseOrigin(readReturnPath());
  if (!origin) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-gray-500 mb-3 truncate"
      data-testid={testId}
    >
      <Link
        to={origin.to}
        className="hover:text-[#1E6A6A] hover:underline underline-offset-2 truncate max-w-[220px] sm:max-w-none"
        data-testid={`${testId}-origin`}
      >
        {origin.label}
      </Link>
      <ChevronRight size={12} className="shrink-0 text-gray-400" aria-hidden />
      <span className="text-gray-700 truncate max-w-[200px] sm:max-w-[320px]" data-testid={`${testId}-current`}>
        {current}
      </span>
    </nav>
  );
};

export default Breadcrumb;
