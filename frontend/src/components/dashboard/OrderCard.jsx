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
  Loader2, Phone, MapPin, Store as StoreIcon, Bike, Pencil, ChevronDown, Undo2, MessageCircle, Camera, Repeat,
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

/**
 * `couriers`, `onAssign` and `onPayment` are the owner's: the staff board
 * passes none of them and so shows none of the controls. Assignment is
 * delivery-only; payment is any order (a pickup is paid at the counter).
 */
export default function OrderCard({ order: o, busy, onStatus, onEdit, onAssign, onPayment, onRepeat, couriers, t }) {
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
          <div className="text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{time || ''}</div>
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
            {o.standing_id && (
              <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--brand-muted)' }} title={t('orders.weeklyTitle', 'Repeats every week')} data-testid="order-weekly">
                <Repeat size={11} /> {t('orders.weekly', 'weekly')}
              </span>
            )}
            {o.total != null && (
              <span className="text-[12px] font-semibold ms-auto" style={{ color: 'var(--ink)' }}>₪{Number(o.total).toLocaleString()}</span>
            )}
          </div>
          {(o.courier || o.payment?.method || o.delivery?.delivered_at || o.delivery?.failed_at) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {o.courier && <span className="inline-flex items-center gap-1" data-testid="order-courier"><Bike size={11} /> {o.courier.name}</span>}
              {o.payment?.method && (
                <span style={{ color: 'var(--status-open)' }} data-testid="order-paid">
                  {t('orders.paidShort', 'paid')} · {t(`orders.pay.${o.payment.method}`, o.payment.method)}{o.payment.amount != null ? ` ₪${Number(o.payment.amount).toLocaleString()}` : ''}
                </span>
              )}
              {o.delivery?.delivered_at && (
                <span className="inline-flex items-center gap-1">
                  {t('orders.deliveredAt', 'delivered {{time}}', { time: String(o.delivery.delivered_at).slice(11, 16) })}
                  {o.delivery.photo_url && <a href={o.delivery.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline"><Camera size={11} /> {t('orders.photo', 'photo')}</a>}
                </span>
              )}
              {o.delivery?.failed_at && (
                <span>{t('orders.failedWhy', 'not delivered: {{reason}}', { reason: t(`orders.courier.reason.${o.delivery.failed_reason}`, o.delivery.failed_reason) })}</span>
              )}
            </div>
          )}
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
            style={{ background: 'var(--action)', color: 'var(--action-ink)' }}
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

      {more && !closed && (onAssign || onPayment) && (
        <div className="mt-2 pt-2 border-t space-y-2" style={{ borderColor: 'var(--brand-border)' }}>
          {onAssign && o.fulfilment === 'delivery' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }} htmlFor={`assign-${o.id}`}>{t('orders.assign', 'Courier')}</label>
              <select
                id={`assign-${o.id}`}
                value={o.courier?.id || ''}
                disabled={busy}
                onChange={(e) => onAssign(o, e.target.value || null)}
                className="px-2 min-h-[40px] rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                data-testid={`order-assign-${o.id}`}
              >
                <option value="">{t('orders.unassigned', 'Not assigned')}</option>
                {(couriers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {o.courier && (() => {
                const c = (couriers || []).find((x) => x.id === o.courier.id);
                if (!c?.phone_e164 || !c?.token) return null;
                const url = `${window.location.origin}/orders/courier/${c.token}`;
                const msg = t('orders.courierShareText', '{{name}}: delivery for {{customer}} ({{when}}). Your run sheet: {{url}}', {
                  name: c.name, customer: o.customer_name, when: (o.needed_by || '').replace('T', ' '), url,
                });
                return (
                  <a href={`https://wa.me/${c.phone_e164}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="order-send-runsheet">
                    <MessageCircle size={12} /> {t('orders.sendRunsheet', 'Send run sheet')}
                  </a>
                );
              })()}
              {(couriers || []).length === 0 && <span className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>{t('orders.noCouriersYet', 'Add a courier from the toolbar first')}</span>}
            </div>
          )}
          {onPayment && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{t('orders.paid', 'Paid')}</span>
              {[['cash', t('orders.pay.cash', 'Cash')], ['bit', t('orders.pay.bit', 'Bit')], ['', t('orders.pay.none', 'Not yet')]].map(([m, lbl]) => {
                const on = (o.payment?.method || '') === m;
                return (
                  <button key={m || 'none'} type="button" disabled={busy} onClick={() => onPayment(o, m || null)} aria-pressed={on} className="px-3 min-h-[36px] rounded-full text-xs font-semibold border" style={on ? { background: 'var(--ink)', color: 'var(--action-ink)', borderColor: 'var(--ink)' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`order-pay-${m || 'none'}-${o.id}`}>{lbl}</button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {more && !closed && (
        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--brand-border)' }}>
          {onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
              <Pencil size={12} /> {t('orders.edit', 'Edit')}
            </button>
          )}
          {onRepeat && !o.standing_id && (
            <button type="button" disabled={busy} onClick={() => onRepeat(o)} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="order-repeat">
              <Repeat size={12} /> {t('orders.repeatWeekly', 'Repeat every week')}
            </button>
          )}
          {o.track_token && o.customer_phone_e164 && (() => {
            const url = `${window.location.origin}/orders/track/${o.track_token}`;
            const msg = t('orders.trackShareText', 'Hi {{name}}, you can follow your order here: {{url}}', { name: o.customer_name, url });
            return (
              <a href={`https://wa.me/${o.customer_phone_e164}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="order-send-track">
                <MessageCircle size={12} /> {t('orders.sendTrack', 'Send status link')}
              </a>
            );
          })()}
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

