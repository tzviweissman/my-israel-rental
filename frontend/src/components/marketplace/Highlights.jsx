/**
 * "What you get" chips on an item card and the item page (storefront
 * phase 3). The server sends only highlights that fit the item
 * (backend/utils/highlights.py, the one list); labels are in en.js / he.js
 * under `highlights.<id>`. Nothing chosen: nothing drawn.
 */
import React from 'react';
import {
  Zap, Wrench, FileText, CalendarDays, Moon, MapPin, Video,
  Hand, Truck, Store, Gift, PenLine, BadgeCheck, Leaf, WheatOff,
} from 'lucide-react';

export const HIGHLIGHT_ICONS = {
  Zap, Wrench, FileText, CalendarDays, Moon, MapPin, Video, Hand, Truck, Store, Gift, PenLine, BadgeCheck, Leaf, WheatOff,
};

export function HighlightChip({ id, icon, t, size = 'sm', selected = null, onClick = null, testid }) {
  const Icon = HIGHLIGHT_ICONS[icon];
  const label = t(`highlights.${id}`);
  const cls = size === 'xs'
    ? 'gap-1 px-2 py-0.5 text-[11px] whitespace-nowrap'
    : 'gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap';
  const style = selected === null
    ? { background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--brand-border)' }
    : selected
      ? { background: 'var(--ink)', color: 'var(--surface)', border: '1px solid var(--ink)' }
      : { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--brand-border)' };
  const inner = <>{Icon && <Icon size={size === 'xs' ? 11 : 13} aria-hidden="true" />}<span>{label}</span></>;
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={!!selected} className={`inline-flex items-center rounded-full font-semibold min-h-[36px] ${cls}`} style={style} data-testid={testid}>{inner}</button>
    : <span className={`inline-flex items-center rounded-full font-medium ${cls}`} style={style} data-testid={testid}>{inner}</span>;
}

export default function Highlights({ items, t, size = 'sm', className = '', testid = 'highlights' }) {
  const list = (items || []).filter((h) => h && typeof h === 'object' && h.id && HIGHLIGHT_ICONS[h.icon]);
  if (!list.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label={t('highlights.label', 'What you get')} data-testid={testid}>
      {list.map((h) => <li key={h.id}><HighlightChip id={h.id} icon={h.icon} t={t} size={size} /></li>)}
    </ul>
  );
}
