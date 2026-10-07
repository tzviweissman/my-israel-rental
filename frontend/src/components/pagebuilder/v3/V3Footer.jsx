/**
 * The site's footer on a v3 page: one line (rules, part 2: "shrink
 * MyIsraelRental to a thin top bar and a one-line footer"). The "List your
 * business, free" band above it stays, by Tzvi's ruling (25 Sep, 5 Oct).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Rules, part 4: the footer says when the hero is a film we made. */
export default function V3Footer({ filmMadeWith = null }) {
  const { t } = useTranslation();
  const links = [
    { to: '/businesses', label: t('nav.services', 'Businesses') },
    { to: '/stays', label: t('nav.stays', 'Stays') },
    { to: '/faq', label: t('footer.faq', 'Frequently Asked Questions') },
  ];
  return (
    <footer className="pv3-footer" data-testid="pv3-footer">
      <span>{t('pageV3.listedOn', 'Listed on MyIsraelRental')}</span>
      {links.map(({ to, label }) => (
        <Link key={to} to={to}>{label}</Link>
      ))}
      {filmMadeWith && (
        <span data-testid="pv3-film-credit">
          {filmMadeWith === 'ai' ? t('pageV3.filmAi', 'Film made with AI') : t('pageV3.film3d', 'Film rendered in 3D')}
        </span>
      )}
      <span dir="ltr">© {new Date().getFullYear()}</span>
    </footer>
  );
}
