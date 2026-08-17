/**
 * "Share" — a button in the My Properties header, revealing the public
 * listings link on click.
 *
 * Third position in three commits, and the reasoning is worth keeping
 * because each move fixed the previous one's flaw:
 *
 *   1. Originally a full white panel ABOVE the tabs, always open, showing
 *      a raw /manager/<uuid>, rendered even with zero listings. The
 *      dashboard opened on a URL instead of on the user's properties.
 *   2. Moved to the bottom of My Properties (D6). Fixed the greeting, but
 *      Tzvi pointed out the obvious: a manager with forty listings has to
 *      scroll past all of them to reach a link they use constantly.
 *   3. Here — in the header row, on the same line as the heading. Visible
 *      without scrolling however many properties there are, taking one
 *      button of space rather than a block, and still absent entirely when
 *      there is nothing to share.
 *
 * The link itself stays behind a click. Someone pasting it somewhere needs
 * to see it; everyone else needs the header not to be a URL.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react';
import ShareLinkRow from './ShareLinkRow';

export default function ShareListingsPanel({ userId, propertyCount = 0 }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Nothing to share yet. A link to an empty public page is the one thing
  // that can only disappoint, so it does not exist until there is a
  // listing behind it.
  if (!userId || propertyCount < 1) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 ps-2.5 pe-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
        style={{
          borderColor: open ? 'var(--brand-primary)' : 'var(--brand-border)',
          background: open ? 'rgb(var(--brand-primary-rgb) / 0.06)' : '#fafaf5',
          color: 'var(--brand-primary)',
        }}
        data-testid="share-listings-toggle"
      >
        <Share2 size={13} aria-hidden="true" />
        {t('dashboard.shareButton', 'Share')}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('dashboard.sharePanelTitle', 'Your public listings page')}
          className="absolute z-30 mt-2 end-0 w-[min(360px,calc(100vw-2rem))] rounded-2xl border bg-white p-4 shadow-xl"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid="share-listings-panel"
        >
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>
            {t('dashboard.sharePanelTitle', 'Your public listings page')}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--brand-muted)' }}>
            {t('dashboard.sharePanelBody', 'One link showing everything you have listed — send it to anyone.')}
          </p>
          <div data-testid="share-listings-link">
            <ShareLinkRow
              userId={userId}
              label={t('dashboard.sharePanelLabel', 'Copy your link')}
              testidPrefix="owner-share-link"
            />
          </div>
        </div>
      )}
    </div>
  );
}
