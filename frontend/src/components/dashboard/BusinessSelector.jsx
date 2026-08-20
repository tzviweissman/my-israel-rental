/**
 * Filter a listing tab down to one business (spec M7).
 *
 * Three states, and the first two matter as much as the third:
 *
 *   0 businesses — renders NOTHING. Someone who has never added one must
 *                  not be shown a control for a concept they do not have.
 *   1 business   — a static label, no dropdown. A menu with one option is
 *                  a decision nobody is being asked to make.
 *   2+           — "All businesses" first and selected by default, so
 *                  nothing is ever hidden by accident.
 *
 * It FILTERS; it never navigates. The choice lives in sessionStorage, so
 * moving between tabs keeps it and a new visit starts from "All" — a
 * filter that silently outlives the session is how someone concludes
 * their listings have vanished.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, ChevronDown, Check } from 'lucide-react';

const STORE_KEY = 'dashboard_business_filter';

export const ALL = '';

export function readStoredBusiness() {
  try { return sessionStorage.getItem(STORE_KEY) || ALL; } catch { return ALL; }
}

export default function BusinessSelector({ businesses = [], value, onChange, testid = 'business-selector' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!businesses.length) return null;

  const pick = (id) => {
    onChange(id);
    try { sessionStorage.setItem(STORE_KEY, id); } catch { /* private mode */ }
    setOpen(false);
  };

  if (businesses.length === 1) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: 'var(--brand-muted)' }}
        data-testid={`${testid}-single`}
      >
        <Store size={13} aria-hidden="true" />
        {businesses[0].name}
      </span>
    );
  }

  const current = businesses.find((b) => b.id === value);
  const label = current ? current.name : t('businesses.all', 'All businesses');

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-1.5 ps-2.5 pe-2 py-1.5 rounded-full text-xs font-semibold border"
        style={{
          borderColor: open ? 'var(--brand-primary)' : 'var(--brand-border)',
          color: 'var(--brand-primary)',
          background: '#fff',
        }}
        data-testid={testid}
      >
        <Store size={13} aria-hidden="true" />
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-2 start-0 min-w-[200px] rounded-xl border bg-white p-1 shadow-xl"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid={`${testid}-menu`}
        >
          {[{ id: ALL, name: t('businesses.all', 'All businesses') }, ...businesses].map((b) => {
            const selected = (b.id || ALL) === (value || ALL);
            return (
              <button
                key={b.id || 'all'}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => pick(b.id || ALL)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-start hover:bg-black/[0.04]"
                style={{ color: 'var(--ink)', fontWeight: selected ? 600 : 400 }}
                data-testid={`${testid}-option-${b.id || 'all'}`}
              >
                <span className="flex-1 truncate">{b.name}</span>
                <Check size={12} style={{ opacity: selected ? 1 : 0, color: 'var(--brand-primary)' }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
