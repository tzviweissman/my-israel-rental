/**
 * The user's own last few searches, offered under a free-text field.
 *
 * A blank search box is a dead end unless you already know exactly what to
 * type — and on a board where the useful queries look like
 * "3BR Ramat Eshkol" or "mover Jerusalem", most people do not. The cheapest
 * honest help is the thing they typed last time.
 *
 * Honest is the constraint. There is no "popular searches" list here and no
 * examples: every row is something this person actually searched for on
 * this device (see utils/recentSearches). With no history the component
 * renders `null` — not an empty panel, not a placeholder — because a panel
 * that appears with nothing in it still covers the page and still costs a
 * dismissal.
 *
 * It is ignorable by construction: anchored below the field, never modal,
 * never covering the input, dismissed by Escape, a click outside, or just
 * carrying on typing. Arrow keys walk it and Enter picks, so it is usable
 * without a mouse but never in the way of one.
 *
 * The area picker has its own version of this (search/WherePicker) because
 * it also offers areas with live listing counts. This one is for fields
 * where the only truthful suggestion is history.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { getRecentSearches, clearRecentSearches } from '../../utils/recentSearches';

export default function RecentSearchesPanel({
  scope,
  open,
  onPick,
  onDismiss,
  // Bumped by the caller after it records a search, so the list refreshes
  // without this component polling localStorage on every render.
  refreshKey = 0,
  testid = 'recent-searches',
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(-1);
  const [cleared, setCleared] = useState(false);

  const rows = useMemo(
    () => (cleared ? [] : getRecentSearches(scope)),
    [scope, refreshKey, cleared],
  );

  useEffect(() => { setActive(-1); }, [open]);
  useEffect(() => { setCleared(false); }, [refreshKey]);

  useEffect(() => {
    if (!open || !rows.length) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { onDismiss?.(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => {
          const next = i + step;
          // -1 is the field itself, and it stays in the cycle so ArrowUp
          // from the first row returns you to what you were typing.
          if (next >= rows.length) return -1;
          if (next < -1) return rows.length - 1;
          return next;
        });
        return;
      }
      if (e.key === 'Enter' && active >= 0 && rows[active]) {
        // Stop it as well as prevent it. The field this panel sits under
        // has its own Enter handler that runs the CURRENT text, and the
        // current text is empty — that is why the panel is showing. Left
        // alone, picking a suggestion with the keyboard ran an empty
        // search a beat later and looked like the pick had been ignored.
        e.preventDefault();
        e.stopPropagation();
        onPick?.(rows[active].value);
      }
    };
    // Capture phase: React attaches its handlers at the app root, which is
    // below document, so a bubble-phase listener here would fire AFTER the
    // input's — too late to stop it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, rows, active, onPick, onDismiss]);

  if (!open || !rows.length) return null;

  return (
    <div
      role="listbox"
      aria-label={t('search.recentSearches', 'Recent searches')}
      className="absolute z-40 start-0 end-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border py-2"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid={testid}
    >
      <div className="flex items-center justify-between px-4 pb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
          {t('search.recentSearches', 'Recent searches')}
        </p>
        <button
          type="button"
          // Their history, their call. A suggestion list you cannot switch
          // off stops feeling like help.
          onMouseDown={(e) => { e.preventDefault(); clearRecentSearches(scope); setCleared(true); }}
          className="text-[11px] underline"
          style={{ color: 'var(--brand-muted)' }}
          data-testid={`${testid}-clear`}
        >
          {t('search.clearRecent', 'Clear')}
        </button>
      </div>
      {rows.map((r, i) => (
        <button
          key={r.value}
          type="button"
          role="option"
          aria-selected={active === i}
          // mousedown, not click: the field's blur would close this panel
          // before a click ever landed.
          onMouseDown={(e) => { e.preventDefault(); onPick?.(r.value); }}
          className={`w-full text-start px-4 py-2 flex items-center gap-3 ${
            active === i ? 'bg-gray-100' : 'hover:bg-gray-50'
          }`}
          data-testid={`${testid}-row-${i}`}
        >
          <Clock size={14} style={{ color: 'var(--brand-muted)' }} className="shrink-0" aria-hidden="true" />
          <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{r.label}</span>
        </button>
      ))}
    </div>
  );
}
