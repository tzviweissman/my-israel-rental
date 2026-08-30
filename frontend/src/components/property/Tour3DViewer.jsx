/**
 * The renter's side: a photos / 3D-tour toggle above the gallery.
 *
 * WHAT EACH STATE SHOWS, which is the whole spec of this component:
 *
 *   ready       the toggle appears, and the tour renders in an iframe
 *               beside the photos.
 *   processing  a quiet "3D tour coming soon" strip, no toggle. It is a
 *               promise the listing can keep within the hour, and it is
 *               worth making — but it must not look like a control that
 *               is broken, so there is nothing to click.
 *   failed      NOTHING. Renters never learn a reconstruction failed.
 *               They cannot act on it, and a listing advertising its own
 *               broken feature is worse than one that never mentioned it.
 *               The owner sees it on their dashboard instead.
 *
 * THE IFRAME IS SANDBOXED AND THE URL IS CHECKED. The embed URL arrives
 * from a third-party reconstruction service, and it is being dropped into
 * a page where our visitors are signed in. `sandbox` withholds
 * same-origin and top-level navigation, so a compromised or hijacked
 * embed host cannot read our storage or redirect the tab out from under
 * the renter. `isSafeEmbed` additionally refuses anything that is not
 * plain https — `javascript:` and `data:` URLs in an iframe src execute
 * in this page's context, and the URL is not ours.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Images, Clock } from 'lucide-react';
// Pure and separately tested — see utils/embedSafety.js for why it lives
// outside this file.
import { isSafeEmbed } from '../../utils/embedSafety';

export default function Tour3DViewer({ tour, children }) {
  const { t } = useTranslation();
  const [showing, setShowing] = useState('photos');

  const status = tour?.status;
  const embed = tour?.tour_embed_url;
  const canShow = status === 'ready' && isSafeEmbed(embed);

  if (status === 'processing') {
    return (
      <>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-3"
          style={{ background: 'var(--bg)', color: 'var(--brand-muted)' }}
          data-testid="tour3d-soon"
        >
          <Clock size={15} aria-hidden="true" />
          {t('tour3d.soon', '3D tour coming soon')}
        </div>
        {children}
      </>
    );
  }

  if (!canShow) {
    // Covers `failed`, no tour, and a `ready` tour whose URL did not pass
    // the check — all of which look identical to a renter: a normal
    // listing with photos.
    return children;
  }

  const Tab = ({ value, Icon, label, testid }) => {
    const active = showing === value;
    return (
      <button
        type="button"
        onClick={() => setShowing(value)}
        aria-pressed={active}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        style={{
          background: active ? 'var(--brand-primary)' : 'var(--surface)',
          color: active ? '#fff' : 'var(--brand-muted)',
          border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--brand-border)'}`,
        }}
        data-testid={testid}
      >
        <Icon size={15} aria-hidden="true" />
        {label}
      </button>
    );
  };

  return (
    <div data-testid="tour3d-viewer" data-showing={showing}>
      <div className="flex items-center gap-2 mb-3">
        <Tab
          value="photos"
          Icon={Images}
          label={t('tour3d.tabPhotos', 'Photos')}
          testid="tour3d-tab-photos"
        />
        <Tab
          value="tour"
          Icon={Box}
          label={t('tour3d.tabTour', '3D tour')}
          testid="tour3d-tab-tour"
        />
      </div>

      {/* The photos stay MOUNTED behind the tour rather than being
          unmounted and rebuilt. Toggling back otherwise resets the
          carousel to the first image and drops the renter's place — and
          re-decodes every photo they had already loaded. */}
      <div hidden={showing !== 'photos'}>{children}</div>

      {showing === 'tour' && (
        <div
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: 'var(--brand-border)', background: 'var(--bg)' }}
        >
          <iframe
            src={embed}
            title={t('tour3d.frameTitle', '3D tour of this property')}
            loading="lazy"
            // No allow-same-origin: the embed must not reach our storage
            // or cookies. No allow-top-navigation: it must not be able to
            // move the renter off the listing.
            sandbox="allow-scripts allow-pointer-lock allow-fullscreen"
            allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
            className="w-full border-0 block"
            style={{ height: 'min(75vw, 67vh, 620px)' }}
            data-testid="tour3d-frame"
          />
        </div>
      )}
    </div>
  );
}
