import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * The end of a page (spec B7).
 *
 * The business page previously stopped dead after the last service — no
 * footer, no way further into the site. A visitor who arrived from a
 * flyer, read the page and was not ready to message had nowhere to go
 * but the back button.
 *
 * Deliberately small. This is the first footer the site has had, and a
 * sprawling one full of columns nobody clicks would be worse than none:
 * the job here is to end the page and offer the three places a reader
 * might actually want next.
 */
export default function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const links = [
    { to: '/stays', label: t('nav.stays', 'Stays') },
    { to: '/businesses', label: t('nav.services', 'Businesses') },
    { to: '/requests', label: t('nav.requests', 'Marketplace') },
    { to: '/faq', label: t('footer.faq', 'Frequently Asked Questions') },
  ];

  return (
    <footer
      className="border-t mt-16"
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)' }}
      data-testid="site-footer"
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--brand-primary)' }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
          © {year} MyIsraelRental
        </p>
      </div>
    </footer>
  );
}
