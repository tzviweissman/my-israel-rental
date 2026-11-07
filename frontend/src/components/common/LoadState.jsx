/**
 * What a screen shows while it loads, when loading failed, and beside a send button that takes someone's details
 * (Tzvi, 7 Nov 2026, from "12 mistakes that make your app feel cheap": a bare spinner, a failure that reads as
 * "nothing here", and a form with no terms line all leave people unsure).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';

export function PageLoading({ words, className = 'py-24' }) {
  const { t } = useTranslation();
  return (
    <div className={`${className} text-center`} style={{ color: 'var(--brand-muted)' }} role="status" data-testid="page-loading">
      <Loader2 className="animate-spin inline" size={20} aria-hidden="true" />
      <p className="text-sm mt-2">{words || t('loadState.loading', 'Loading…')}</p>
    </div>
  );
}

/** A load that failed is not "nothing here": say so, and offer to try again. */
export function LoadFailed({ onRetry, className = 'py-16', testid = 'load-failed' }) {
  const { t } = useTranslation();
  return (
    <div className={`${className} text-center max-w-md mx-auto px-4`} role="alert" data-testid={testid}>
      <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('loadState.failedTitle', 'This did not load')}</p>
      <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>{t('loadState.failedBody', 'Check your connection and try again.')}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold"
                style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid={`${testid}-retry`}>
          <RefreshCw size={14} aria-hidden="true" /> {t('loadState.tryAgain', 'Try again')}
        </button>
      )}
    </div>
  );
}

/** The line under a send button on a form that takes a name, phone or email. */
export function FormConsent({ className = 'text-[11px] text-center mt-2' }) {
  const { t } = useTranslation();
  const link = { color: 'inherit', textDecoration: 'underline' };
  return (
    <p className={className} style={{ color: 'var(--brand-muted)' }} data-testid="form-consent">
      {t('loadState.consentStart', 'By sending, you agree to the ')}
      <Link to="/terms" target="_blank" style={link}>{t('loadState.terms', 'Terms')}</Link>
      {t('loadState.consentAnd', ' and the ')}
      <Link to="/privacy" target="_blank" style={link}>{t('loadState.privacy', 'Privacy policy')}</Link>
      {t('loadState.consentEnd', '.')}
    </p>
  );
}
