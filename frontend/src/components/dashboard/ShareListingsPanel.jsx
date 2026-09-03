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
 *
 * Since 4 Sep 2026 the same panel serves a BUSINESS: pass `target`
 * ({ type: 'business', id }) and `longLink` (the page the link opens
 * before the short one exists). The backend has minted business short
 * links since the table was built and no screen ever asked it to - the
 * Businesses tab promised "their own page and QR code" in its subtitle
 * and offered neither. Tzvi: "theres no link to share or qr code".
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import axios from 'axios';
import ShareLinkRow from './ShareLinkRow';
import QrShareCard from '../common/QrShareCard';
import OnboardingTip from '../onboarding/OnboardingTip';
import ScanChart from '../common/ScanChart';
import ShareLinkButtons from '../common/ShareLinkButtons';

export default function ShareListingsPanel({
  userId, propertyCount = 0, API, token,
  target, longLink, title, body, filename = 'myisraelrental-listings-qr', testidPrefix = 'share', tour = 'share-panel',
}) {
  const { t } = useTranslation();
  const linkTarget = target || { type: 'manager', id: userId };
  const [open, setOpen] = useState(false);
  const [shortLink, setShortLink] = useState(null);
  const wrapRef = useRef(null);
  // The link doc lives in a ref as well as state: the fetch effect below
  // must know whether one exists WITHOUT depending on the state value —
  // depending on it would re-run the effect on its own setState and GET
  // in a loop for as long as the panel stayed open.
  const linkRef = useRef(null);

  // First open mints the short link (spec Q1: lazily — the backend
  // returns the same slug on every later call, so opening twice cannot
  // produce two codes). Every open after that re-reads it, because the
  // scan count on it moves in the real world between opens and a stale
  // number quietly becomes a wrong number (spec Q2: real numbers only).
  // If the call fails the panel still works: the long link never depends
  // on the short one, and the QR simply waits for the next open.
  useEffect(() => {
    if (!open || !API || !token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const existing = linkRef.current;
        const { data } = existing
          ? await axios.get(`${API}/short-links/${existing.slug}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : await axios.post(
              `${API}/short-links`,
              { target_type: linkTarget.type, target_id: linkTarget.id },
              { headers: { Authorization: `Bearer ${token}` } },
            );
        if (!cancelled) {
          linkRef.current = data;
          setShortLink(data);
        }
      } catch {
        /* long link still shown; QR appears next open if this recovers */
      }
    })();
    return () => { cancelled = true; };
  }, [open, API, token, linkTarget.type, linkTarget.id]);

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
  if (!target && (!userId || propertyCount < 1)) return null;
  const panelTitle = title || t('dashboard.sharePanelTitle', 'Your public listings page');
  const shortUrl = shortLink ? `${window.location.origin}${shortLink.path}` : undefined;

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
        data-testid={target ? `${testidPrefix}-toggle` : 'share-listings-toggle'}
        data-tour={tour}
      >
        {/* The label names the QR. "Share" alone tested badly for the
            obvious reason: nothing about it suggests a printable code
            exists behind it, so owners never opened the panel and never
            learned they had one. The QR icon carries it at a glance. */}
        <QrCode size={13} aria-hidden="true" />
        {t('dashboard.shareButton', 'Share & QR code')}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={panelTitle}
          className={target
            ? 'z-30 rounded-2xl border bg-white p-4 shadow-xl max-sm:fixed max-sm:inset-x-4 max-sm:top-24 max-sm:max-h-[calc(100vh-7rem)] max-sm:overflow-y-auto sm:absolute sm:mt-2 sm:start-0 sm:w-[min(360px,calc(100vw-2rem))]'
            : 'absolute z-30 mt-2 end-0 w-[min(360px,calc(100vw-2rem))] rounded-2xl border bg-white p-4 shadow-xl'}
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid={target ? `${testidPrefix}-panel` : 'share-listings-panel'}
        >
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>
            {panelTitle}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--brand-muted)' }}>
            {body || t('dashboard.sharePanelBody2', 'One link and a QR code for everything you have listed — send it in a message, or print the code for a flyer or a sign.')}
          </p>
          {/* T2 — a caption on the QR, the first time an owner opens this
              panel. Beside the feature, inside the flow: nothing is
              anchored or absolutely positioned, so there is no RTL
              placement to get wrong. */}
          <OnboardingTip id="tip.share" className="mb-3" />

          <div data-testid={target ? `${testidPrefix}-link` : 'share-listings-link'}>
            <ShareLinkRow
              userId={userId}
              link={shortUrl || longLink}
              label={t('dashboard.sharePanelLabel', 'Copy your link')}
              testidPrefix={target ? `${testidPrefix}-link` : 'owner-share-link'}
            />
          </div>

          {/* Q3/Q4 — the QR, encoding the SHORT link. Only rendered once
              the slug exists: encoding the 36-character UUID would defeat
              the reason short links were built. */}
          {shortLink && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--brand-border)' }}>
              <QrShareCard
                url={shortUrl}
                filename={filename}
                testidPrefix={target ? `${testidPrefix}-qr` : 'share-qr'}
              />
              {/* Q2 — a real number or an explicit "not yet". Never blank,
                  never rounded: this is the line that tells an owner
                  whether the sign in the stairwell is doing anything. */}
              <p
                className="mt-2 text-center text-xs font-semibold"
                style={{ color: 'var(--brand-primary)' }}
                data-testid={target ? `${testidPrefix}-scan-count` : 'share-scan-count'}
              >
                {shortLink.scan_count === 0
                  ? t('qr.scanned0', 'Not scanned yet')
                  : shortLink.scan_count === 1
                    ? t('qr.scanned1', 'Scanned once')
                    : t('qr.scannedN', 'Scanned {{n}} times', { n: shortLink.scan_count })}
              </p>
              <div className="mt-3">
                <ScanChart daily={shortLink.daily} testidPrefix={target ? `${testidPrefix}-qr` : 'share-qr'} />
              </div>
              <div className="mt-3">
                <ShareLinkButtons
                  url={shortUrl}
                  testidPrefix={target ? `${testidPrefix}-qr` : 'share-qr'}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
