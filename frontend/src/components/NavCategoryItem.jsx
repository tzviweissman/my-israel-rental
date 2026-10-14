import React from 'react';
import { Link } from 'react-router-dom';

/**
 * One section in the row under the logo bar (Stays, Businesses, Marketplace,
 * Restaurants), styled after Booking.com's header (Tzvi, 14 Oct 2026: the
 * 3D pictures tried first "don't fit with the rest of the site"):
 *   - laptop: line icon beside the label; the current section sits in a
 *     rounded outline, hover gets a faint fill.
 *   - phone: icon above the label, the current one underlined; once the
 *     page scrolls the icons fold away (`iconHidden`).
 * White on the nav's dark scrim at every width, with a shadow so it reads
 * over light pages too.
 */
const NavCategoryItem = ({ type, Icon, label, active, iconHidden = false, testidSuffix = '', to }) => {
  const href = to || `/properties/${type}`;
  return (
    <Link
      to={href}
      aria-current={active ? 'page' : undefined}
      onClick={() => window.scrollTo(0, 0)}
      className={[
        'flex items-center text-white transition-colors',
        iconHidden ? 'px-4 py-1' : 'flex-col gap-1 px-3 pb-1',
        'md:flex-row md:gap-2 md:rounded-full md:border-[1.5px]',
        iconHidden ? 'md:px-3 md:py-1.5' : 'md:px-4 md:py-2',
        active ? 'md:border-white/80 md:bg-white/15' : 'md:border-transparent md:hover:bg-white/10',
        // The phone keeps an underline for "you are here".
        active ? 'border-b-2 border-b-white md:border-b-[1.5px] md:border-b-white/80' : 'border-b-2 border-b-transparent',
      ].join(' ')}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
      title={iconHidden ? label : undefined}
      data-testid={`nav-category-${type}${testidSuffix}`}
    >
      {/* Once the page scrolls the row folds to its icons, so the sticky bar
          stays thin (Tzvi, 14 Oct 2026); the name stays for screen readers
          and as a hover tooltip. */}
      <Icon
          aria-hidden="true"
          strokeWidth={1.8}
          className="h-5 w-5 md:h-[18px] md:w-[18px]"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
      />
      <span className={iconHidden ? 'sr-only' : 'whitespace-nowrap text-[11px] font-semibold md:text-sm'}>{label}</span>
    </Link>
  );
};

export default NavCategoryItem;
