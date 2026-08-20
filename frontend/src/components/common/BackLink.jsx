import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

/**
 * "Back" control for pages people reach mid-flow and need to leave again.
 *
 * Written because the two value pages had no way back. Someone part-way
 * through signing up taps "See what business owners get" or "See how
 * hosting works", reads it, and is stranded: the page is a full-screen
 * pitch with no exit, so the only way back to the sign-up they abandoned
 * is the browser's own back button — which plenty of people on a phone
 * will not think to use, and which is invisible in an installed PWA.
 *
 * Going back through history rather than to a fixed URL is deliberate:
 * these pages are reached from the join page, the nav and the services
 * board, and each of those is the right place to return to. `fallback`
 * covers the case where there is nothing to go back TO — someone opening
 * the link straight from a search result or a shared message, where
 * navigate(-1) would take them off the site entirely.
 *
 * The arrow flips under RTL. A left-pointing arrow means "forward" in
 * Hebrew, so shipping it unflipped would point the wrong way on half the
 * site's pages.
 */
export default function BackLink({ fallback = '/', testId = 'back-link', className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // react-router gives the first entry in a session the key "default", so
  // this is how we know whether there is any history to step back into.
  const hasHistory = location.key !== 'default';

  return (
    <button
      type="button"
      onClick={() => (hasHistory ? navigate(-1) : navigate(fallback))}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[var(--brand-primary)] transition-colors ${className}`}
      data-testid={testId}
    >
      <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
      {t('common.back', 'Back')}
    </button>
  );
}
