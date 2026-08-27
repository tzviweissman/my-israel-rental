/**
 * T7 — the permanent home for help, in the dashboard header.
 *
 *   This is the single answer to "where do I go when I'm lost", and it must
 *   never move.
 *
 * So: not dismissible, not conditional on being new, not part of the
 * one-at-a-time slot that governs the tips and the inline offers. Those are
 * interruptions competing for attention; this is furniture, and furniture
 * you can rely on being in the same place is the entire point.
 *
 * Three entries, in the spec's order — the tour, the library, support.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HelpCircle, Compass, BookOpen, MessageCircle } from 'lucide-react';
import { useOnboarding } from './OnboardingProvider';
import { featureLibraryFor, SUPPORT_WHATSAPP } from './helpDestinations';

export default function HelpMenu() {
  const { t } = useTranslation();
  const ctx = useOnboarding();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click and on Escape. Both, because a menu that traps
  // you is worse than no menu.
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

  const href = featureLibraryFor(ctx?.state?.role);

  const itemClass = 'flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-start hover:bg-black/[0.03]';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold border"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: 'var(--surface)' }}
        data-testid="dashboard-help-button"
      >
        <HelpCircle size={16} aria-hidden="true" />
        <span>{t('help.help', 'Help')}</span>
      </button>

      {open && (
        <div
          role="menu"
          /* Logical `start`/`end`, never `left`/`right`, so the panel hangs
             from the correct edge of the button under `dir="rtl"`.

             The breakpoint switch is not cosmetic. The header is a row on
             a desktop, with this control at the END of it — so the panel
             hangs from its end edge and opens inward. At 375px the header
             stacks and the control sits at the START of its own row, and
             anchoring to the end there pushed a 256px panel clean off the
             screen: measured at x=-161 in English and overflowing to 540
             on a 375px viewport in Hebrew. Both directions, both broken,
             and a screenshot of the closed button shows none of it.

             The width is clamped too, so the panel cannot be wider than
             the screen it has to fit on. */
          className="absolute z-40 mt-2 start-0 sm:start-auto sm:end-0 w-[min(16rem,calc(100vw-2rem))] rounded-xl border overflow-hidden shadow-lg"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--brand-border)',
          }}
          data-testid="dashboard-help-menu"
        >
          <Link
            to={href}
            role="menuitem"
            className={itemClass}
            style={{ color: 'var(--ink)' }}
            onClick={() => setOpen(false)}
            data-testid="help-show-around"
          >
            <Compass size={15} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
            {/* Same key as every other entry point — one name everywhere. */}
            {t('help.showAround', 'Show me around')}
          </Link>

          <Link
            to={href}
            role="menuitem"
            className={itemClass}
            style={{ color: 'var(--ink)' }}
            onClick={() => setOpen(false)}
            data-testid="help-feature-library"
          >
            <BookOpen size={15} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
            {t('help.whatYouCanDo', 'What you can do here')}
          </Link>

          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemClass}
            style={{ color: 'var(--ink)' }}
            onClick={() => setOpen(false)}
            data-testid="help-support"
          >
            <MessageCircle size={15} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
            {t('help.messageUs', 'Message us')}
          </a>
        </div>
      )}
    </div>
  );
}
