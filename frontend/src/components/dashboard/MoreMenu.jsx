/**
 * A "More" button that opens a short list of actions, the way Shopify's
 * Orders page keeps its toolbar to a few buttons (Tzvi, 15 Oct 2026:
 * "shopify has all these"). Closes on a pick, a click outside, or Escape.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';

export default function MoreMenu({ items, testid = 'more-menu' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
              className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-full text-xs font-semibold border"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)', background: open ? 'var(--surface-muted)' : 'transparent' }}
              data-testid={testid}>
        <MoreHorizontal size={14} /> {t('common.more', 'More')}
      </button>
      {open && (
        <ul role="menu" className="absolute z-30 mt-1 start-0 min-w-[13rem] rounded-xl border bg-white p-1 shadow-lg"
            style={{ borderColor: 'var(--brand-border)' }} data-testid={`${testid}-list`}>
          {items.map(({ key, Icon, label, onClick, active }) => (
            <li key={key} role="none">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onClick(); }}
                      className="w-full flex items-center gap-2 px-3 min-h-[40px] rounded-lg text-sm text-start hover:bg-[var(--surface-muted,#f9fafb)]"
                      style={{ color: 'var(--ink)', fontWeight: active ? 700 : 500 }} data-testid={`${testid}-${key}`}>
                <Icon size={15} aria-hidden="true" /> {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
