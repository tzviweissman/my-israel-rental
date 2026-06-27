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
const NavCategoryItem = ({ type, Icon, label, active, scrolled, testidSuffix = '', to }) => {
  const [hover, setHover] = useState(false);
  const isGold = active || hover;
  const color = isGold ? '#D4AF37' : '#FFFFFF';

  // Default route falls back to the legacy /properties/<rental-type> path
  // for backwards compat (rental-type pills still using this component),
  // but a custom `to` lets the new Stays/Services pills target their
  // dedicated pages without polluting the rental-type routing convention.
  const href = to || `/properties/${type}`;

  return (
    <Link
      to={href}
      onClick={() => window.scrollTo(0, 0)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col items-center px-3 pb-1 transition-all"
      style={{
        borderBottom: active
          ? '2px solid #D4AF37'
          : hover
            ? '2px solid rgba(212,175,55,0.6)'
            : '2px solid transparent',
        opacity: active ? 1 : 0.95,
      }}
      data-testid={`nav-category-${type}${testidSuffix}`}
    >
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
      <span
        className="font-semibold tracking-wide whitespace-nowrap"
        style={{
          color,
          textShadow: scrolled ? 'none' : '0 1px 3px rgba(0,0,0,0.5)',
          fontSize: scrolled ? '10px' : '12px',
          transition: 'color 0.18s ease',
        }}
      >
        {label}
      </span>
    </Link>
  );
};

export default NavCategoryItem;
