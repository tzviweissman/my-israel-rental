/**
 * NotFound — the catch-all for any URL no <Route> claims (typo'd links,
 * removed experiment routes like /v3, stale bookmarks).
 *
 * Before this existed, an unknown URL rendered the nav/footer shell with a
 * silently empty content area — which reads as "the site is broken", not
 * "that page doesn't exist". This page says the second thing and offers the
 * two ways forward that match the positioning: home first, rentals second.
 *
 * noindex on purpose: a 404 that gets indexed can outrank real pages for
 * their own keywords, and there is nothing here worth ranking.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Search } from 'lucide-react';
import PageMeta from '../components/PageMeta';

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16 text-center"
      style={{ background: 'var(--bg)' }}
      data-testid="not-found-page"
    >
      <PageMeta
        title={t('notFound.title', 'Page not found')}
        description={t('notFound.body', "The page you're looking for doesn't exist or may have moved. Check the address, or start again from one of these.")}
        noindex
      />
      <div className="max-w-lg">
        {/* 404 is the one display-gold accent on the page; --gold-lg is the
            large/display gold for light backgrounds. */}
        <p
          aria-hidden="true"
          className="mb-2"
          style={{
            fontFamily: 'var(--font-head)',
            fontWeight: 400,
            fontSize: 'clamp(64px, 14vw, 108px)',
            lineHeight: 1,
            color: 'var(--gold-lg)',
          }}
        >
          404
        </p>
        <h1
          className="mb-3"
          style={{
            fontFamily: 'var(--font-head)',
            fontWeight: 600,
            fontSize: 'clamp(26px, 4.5vw, 34px)',
            color: 'var(--ink)',
          }}
        >
          {t('notFound.title', 'Page not found')}
        </h1>
        <p className="mb-8 text-base" style={{ color: 'var(--brand-muted)' }}>
          {t('notFound.body', "The page you're looking for doesn't exist or may have moved. Check the address, or start again from one of these.")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn btn-primary">
            <Home size={16} />
            {t('notFound.goHome', 'Back to home')}
          </Link>
          <Link to="/stays" className="btn btn-ghost">
            <Search size={16} />
            {t('notFound.browseStays', 'Browse stays')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
