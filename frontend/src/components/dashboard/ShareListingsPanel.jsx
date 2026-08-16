/**
 * "Share your listings" — collapsed by default, inside My Properties.
 *
 * This used to sit above the tabs, before any content, as an always-open
 * white panel showing a raw `localhost:3210/manager/<uuid>`. Three things
 * were wrong with that and all three are fixed here (spec D6):
 *
 *   • it was the first thing on the page, so the dashboard opened on a URL
 *     rather than on the user's own properties;
 *   • it rendered with zero listings, which is a link to an empty page —
 *     the one moment sharing it can only disappoint;
 *   • it displayed a uuid, which tells a person nothing and looks like
 *     something has leaked.
 *
 * Now it is a button that names what the link IS. The URL appears when
 * asked for, because someone who wants to paste it somewhere still needs
 * to see it.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, ChevronDown } from 'lucide-react';
import ShareLinkRow from './ShareLinkRow';

export default function ShareListingsPanel({ userId, propertyCount = 0 }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Nothing to share yet. Rendering nothing is the whole point — an empty
  // public page is worse than no link at all.
  if (!userId || propertyCount < 1) return null;

  return (
    <div
      className="mt-8 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: 'var(--brand-border)', background: '#fff' }}
      data-testid="share-listings-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 text-start"
        data-testid="share-listings-toggle"
      >
        <Link2 size={16} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-bold" style={{ color: 'var(--ink)' }}>
            {t('dashboard.sharePanelTitle', 'Your public listings page')}
          </span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
            {t('dashboard.sharePanelBody', 'One link showing everything you have listed — send it to anyone.')}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--brand-muted)' }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-4" data-testid="share-listings-link">
          <ShareLinkRow
            userId={userId}
            label={t('dashboard.sharePanelLabel', 'Copy your link')}
            testidPrefix="owner-share-link"
          />
        </div>
      )}
    </div>
  );
}
