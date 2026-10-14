import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * One rental-type pill in the top nav (icon stacked above label).
 * Three visual states managed locally so the parent stays declarative:
 *   - default: white icon + white label
 *   - hover: brand-gold icon + label
 *   - active (route matches): brand-gold + underline + heavier stroke
 * Scaling shrinks for the compact (scrolled) navbar.
 */
const NavCategoryItem = ({ type, Icon, img, label, active, scrolled, iconHidden = false, testidSuffix = '', to }) => {
  const [hover, setHover] = useState(false);
  const isGold = active || hover;
  // Solid brand gold reads fine over the hero-image backdrop (shadowed
  // for legibility below), but only hits ~3:1 against the scrolled navbar's
  // solid teal fill — short of WCAG AA's 4.5:1 for text. Swap to the paler,
  // AA-compliant gold once scrolled; unscrolled keeps the original brand gold.
  // With a picture the label stays white: the underline marks the current
  // section, and pale gold on the grey scrim was hard to read.
  const color = isGold && !img ? (scrolled ? 'var(--gold-text-on-dark)' : 'var(--gold)') : '#FFFFFF';

  // Default route falls back to the legacy /properties/<rental-type> path
  // for backwards compat (rental-type pills still using this component),
  // but a custom `to` lets the new Stays/Services pills target their
  // dedicated pages without polluting the rental-type routing convention.
  const href = to || `/properties/${type}`;

  return (
    <Link
      to={href}
      // The gold underline says "you are here" to people who can see it.
      // aria-current is what says it to everyone else - the desktop pill
      // row already sets it, and these two rows are the same navigation.
      aria-current={active ? 'page' : undefined}
      onClick={() => { setHover(false); window.scrollTo(0, 0); }}
      // Hover is for a mouse only. A tap on a phone fires mouseenter and
      // never the matching mouseleave, so the tapped item kept its hover
      // underline after moving on to another (Tzvi, 22 Sep 2026: tap
      // Businesses, then Stays, and the line stays under Businesses).
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={() => setHover(false)}
      // transition-opacity, not transition-all: animating a border whose
      // colour is var(--gold) got stuck, so after tapping Stays the line
      // stayed under Businesses until something else repainted it (Tzvi,
      // 22 Sep 2026; inline style right, computed colour still the old one).
      className={`${iconHidden ? 'flex-row gap-2 px-3 py-1' : 'flex-col px-3 pb-1'} flex items-center transition-opacity`}
      style={{
        borderBottom: active
          ? '2px solid var(--gold)'
          : hover
            ? '2px solid rgb(var(--gold-rgb) / 0.6)'
            : '2px solid transparent',
        opacity: active ? 1 : 0.95,
      }}
      data-testid={`nav-category-${type}${testidSuffix}`}
    >
      {!iconHidden && img && (
        <img
          src={img}
          alt=""
          width={40}
          height={40}
          className="mb-0.5 h-[34px] w-[34px] md:h-10 md:w-10 object-contain"
          style={{
            transform: hover ? 'scale(1.1)' : 'scale(1)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
            transition: 'transform 0.18s ease',
          }}
        />
      )}
      {!iconHidden && !img && (
        <Icon
          size={scrolled ? 18 : 22}
          color={color}
          strokeWidth={isGold ? 2.4 : 1.8}
          className="mb-1 transition-transform"
          style={{
            transform: hover ? 'scale(1.12)' : 'scale(1)',
            filter: scrolled ? 'none' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
            transition: 'transform 0.18s ease, color 0.18s ease',
          }}
        />
      )}
      <span
        className={`font-semibold tracking-wide whitespace-nowrap ${img ? 'text-[11px] md:text-[13px]' : ''}`}
        style={{
          color,
          // The picture row sits on the nav's scrim over any page, light
          // ones included, so its labels always carry a shadow.
          textShadow: img ? '0 1px 3px rgba(0,0,0,0.6)' : scrolled ? 'none' : '0 1px 3px rgba(0,0,0,0.5)',
          fontSize: img ? undefined : scrolled ? (iconHidden ? '13px' : '10px') : '12px',
          transition: 'color 0.18s ease',
        }}
      >
        {label}
      </span>
    </Link>
  );
};

export default NavCategoryItem;
