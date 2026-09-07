/**
 * One order, as a card. Shared by the owner's Orders tab and the staff
 * board (/orders/staff/:token), which is why it lives in its own file:
 * the counter and the owner must see exactly the same thing.
 *
 * Designed for 375px first, one-handed: every tap target is at least
 * 44px, the next step is one black button, everything rarer is behind
 * the chevron.
 */
import React, { useState } from 'react';
import {
  Loader2, Phone, MapPin, Store as StoreIcon, Bike, Pencil, ChevronDown, Undo2, MessageCircle,
} from 'lucide-react';
import { buildWhatsAppLink } from '../../utils/whatsappLink';

export const STATUS_ORDER = ['new', 'preparing', 'ready', 'done', 'cancelled', 'failed'];
export const NEXT = { new: 'preparing', preparing: 'ready', ready: 'done' };
export const BACK = { preparing: 'new', ready: 'preparing' };
export const OPEN = new Set(['new', 'preparing', 'ready']);

// Status colours. Green is the site's one functional colour and it means
// "ready to go out"; new is the accent wash; everything else is neutral
// so the board reads calm at 6am. Cancelled/failed are told by the word
// and a strikethrough, not by a red the theme does not have.
export function pillStyle(status, on) {
  const base = { borderColor: 'var(--brand-border)', color: 'var(--ink)', background: 'var(--surface)' };
  if (status === 'new') Object.assign(base, { background: 'var(--accent-soft)', color: 'var(--accent-soft-ink)', borderColor: 'transparent' });
  if (status === 'ready') Object.assign(base, { background: 'var(--status-open-bg)', color: 'var(--status-open)', borderColor: 'transparent' });
  if (status === 'preparing') Object.assign(base, { background: 'var(--surface-muted)' });
  if (status === 'done' || status === 'cancelled' || status === 'failed') Object.assign(base, { color: 'var(--brand-muted)' });
  if (on) Object.assign(base, { outline: '2px solid var(--ink)', outlineOffset: 1 });
  return base;
}

export default function OrderCard({ order: o, busy, onStatus, onEdit, t }) {
  const [more, setMore] = useState(false);
  const time = (o.needed_by || '').includes('T') ? o.needed_by.slice(11, 16) : '';
  const closed = !OPEN.has(o.status);
  const next = NEXT[o.status];
  const back = BACK[o.status];
  const wa = o.customer_phone_e164 ? buildWhatsAppLink(o.customer_phone_e164) : null;
  const nextLabel = {
    preparing: t('orders.action.start', 'Start'),
    ready: t('orders.action.ready', 'Ready'),
    done: o.fulfilment === 'delivery' ? t('orders.action.delivered', 'Delivered') : t('orders.action.collected', 'Collected'),
  }[next];

  return (
    <article
      className="rounded-2xl border bg-white p-3"
      style={{ borderColor: 'var(--brand-border)', opacity: closed ? 0.7 : 1 }}
      data-testid={`order-card-${o.id}`}
      data-status={o.status}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-14 text-center">
          <div className="text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{time || '—'}</div>
          <div className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>{time ? '' : t('orders.anyTime', 'any time')}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* dir="auto" on every free-text field: a Hebrew board full of
                English item names (or the reverse) must not read "rolls 6". */}
            <span dir="auto" className="font-semibold truncate" style={{ color: 'var(--ink)', textDecoration: o.status === 'cancelled' ? 'line-through' : 'none' }}>
              {o.customer_name}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={pillStyle(o.status, false)}>
              {t(`orders.status.${o.status}`, o.status)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {o.fulfilment === 'delivery' ? <Bike size={12} /> : <StoreIcon size={12} />}
              {o.fulfilment === 'delivery' ? t('orders.delivery', 'Delivery') : t('orders.pickup', 'Pickup')}
            </span>
            {o.total != null && (
              <span className="text-[12px] font-semibold ms-auto" style={{ color: 'var(--ink)' }}>₪{Number(o.total).toLocaleString()}</span>
            )}
          </div>
          <p dir="auto" className="text-sm mt-1 whitespace-pre-line" style={{ color: 'var(--ink)' }}>{o.items}</p>
          {o.fulfilment === 'delivery' && o.address && (
            <p className="text-xs mt-1 inline-flex items-start gap-1" style={{ color: 'var(--brand-muted)' }}>
              <MapPin size={12} className="mt-0.5 shrink-0" /> <span dir="auto">{o.address}</span>
            </p>
          )}
          {o.notes && (
            <p dir="auto" className="text-xs mt-1 italic" style={{ color: 'var(--brand-muted)' }}>{o.notes}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {!closed && next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus(next)}
            className="px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
            style={next === 'done'
              ? { background: 'var(--status-open-bg)', color: 'var(--status-open)' }
              : { background: 'var(--action)', color: 'var(--action-ink)' }}
            data-testid={`order-next-${o.id}`}
          >
            {busy ? <Loader2 size={14} className="animate-spin inline" /> : nextLabel}
          </button>
        )}
        {o.customer_phone_e164 && (
          <a
            href={`tel:+${o.customer_phone_e164}`}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
            aria-label={t('orders.call', 'Call {{name}}', { name: o.customer_name })}
            title={o.customer_phone}
          >
            <Phone size={16} />
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
            aria-label={t('orders.whatsapp', 'WhatsApp {{name}}', { name: o.customer_name })}
          >
            <MessageCircle size={16} />
          </a>
        )}
        {!closed && (
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full ms-auto"
            style={{ color: 'var(--brand-muted)' }}
            aria-expanded={more}
            aria-label={t('orders.more', 'More')}
          >
            <ChevronDown size={16} style={{ transform: more ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}
      </div>

      {more && !closed && (
        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--brand-border)' }}>
          {onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
              <Pencil size={12} /> {t('orders.edit', 'Edit')}
            </button>
          )}
          {back && (
            <button type="button" disabled={busy} onClick={() => onStatus(back)} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
              <Undo2 size={12} /> {t('orders.action.back', 'Back to {{status}}', { status: t(`orders.status.${back}`, back) })}
            </button>
          )}
          {o.status === 'ready' && o.fulfilment === 'delivery' && (
            <button type="button" disabled={busy} onClick={() => onStatus('failed')} className="px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
              {t('orders.action.failed', 'Delivery failed')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              // eslint-disable-next-line no-alert
              if (window.confirm(t('orders.confirmCancel', 'Cancel this order for {{name}}?', { name: o.customer_name }))) onStatus('cancelled');
            }}
            className="px-3 min-h-[40px] rounded-full text-xs font-semibold ms-auto"
            style={{ color: 'var(--brand-muted)' }}
          >
            {t('orders.action.cancel', 'Cancel order')}
          </button>
        </div>
      )}
    </article>
  );
}

