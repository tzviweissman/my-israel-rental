/**
 * The one-tap action on every storefront card (storefront phase 4). It
 * follows what the item is, with nothing for the owner to set:
 *
 *   service with booking slots   Book: the existing time picker and the
 *                                booking form, no account needed
 *   any other service            Message
 *   product (one in the listing) quantity + Add to order
 *   product listing (several)    Choose items: a sheet of the listing's
 *                                products, each with a quantity
 *
 * The basket goes out through the existing order form (/order/:gigId),
 * which needs no account and takes no payment. Nothing here shows a phone
 * or an email.
 */
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, MessageCircle, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { AuthContext } from '../../App';
import { BookingForm, AppointmentPicker, TierList } from '../../pages/GigDetail';
import FitImage from '../common/FitImage';
import { money } from '../../utils/currency';
import { orderHref } from '../../utils/storeBasket';

/** What the card's button does for this item. */
export function actionKind(gig) {
  if ((gig.gig_type || 'deliverable') === 'store') {
    return (gig.products || []).length === 1 ? 'product' : 'products';
  }
  const week = gig.weekly_availability || {};
  const hasSlots = Object.values(week).some((w) => (w || []).length);
  if (gig.gig_type === 'appointment' && gig.booking_mode === 'in_platform' && hasSlots && (gig.tiers || []).length) return 'book';
  return 'message';
}

export function QtyStepper({ value, onChange, t, testid, disabled = false }) {
  return (
    <div className="inline-flex items-center rounded-full border" style={{ borderColor: 'var(--brand-border)' }} data-testid={testid}>
      <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} aria-label={t('basket.less', 'One less')}
        className="w-9 h-9 inline-flex items-center justify-center disabled:opacity-40"><Minus size={14} /></button>
      <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" disabled={disabled || value >= 99} onClick={() => onChange(value + 1)} aria-label={t('basket.more', 'One more')}
        className="w-9 h-9 inline-flex items-center justify-center disabled:opacity-40"><Plus size={14} /></button>
    </div>
  );
}

/* A product's id, as the order form addresses it: products saved before
   ids existed go by position, `idx:N` (orders.py _products_for_order). */
const pid = (p, i) => p.id || `idx:${i}`;
const withIds = (gig) => (gig.products || []).map((p, i) => ({ ...p, id: pid(p, i) }));

const priceText = (p, t) => (p.price === null || p.price === undefined || p.price === ''
  ? t('services.askForQuote', 'Ask for a quote') : money(p.price, p.currency));

function Sheet({ title, onClose, children, testid }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} data-testid={testid}>
      <div className="bg-white w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }} dir="auto">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 -m-2" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Several products in one listing: pick quantities, then add them all. */
function ProductSheet({ gig, basket, title, onClose, t }) {
  const start = basket.items[gig.id] || {};
  const [qty, setQty] = useState(start);
  const products = withIds(gig);
  const save = () => {
    for (const p of products) basket.setQty(gig.id, p.id, qty[p.id] || 0);
    onClose();
  };
  return (
    <Sheet title={title} onClose={onClose} testid="product-sheet">
      <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {products.map((p) => {
          const out = p.in_stock === false;
          return (
            <li key={p.id} className="py-3 flex items-center gap-3" data-testid={`product-row-${p.id}`}>
              <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                <FitImage src={(p.images && p.images[0]) || p.image} name={p.name} className="absolute inset-0" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" dir="auto" style={{ color: 'var(--ink)' }}>{p.name}</p>
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{out ? t('basket.outOfStock', 'Out of stock') : priceText(p, t)}</p>
              </div>
              <QtyStepper value={qty[p.id] || 0} disabled={out} t={t} testid={`product-qty-${p.id}`}
                onChange={(n) => setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(99, n)) }))} />
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={save} className="mt-4 w-full min-h-[48px] rounded-full font-bold"
        style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="product-sheet-add">
        {t('basket.addToOrder', 'Add to order')}
      </button>
    </Sheet>
  );
}

/** Book: choose an option if there are several, then a time, then the
 *  booking form (signed in or not). */
function BookSheet({ gig, title, onClose, t }) {
  const { token } = useContext(AuthContext);
  const tiers = gig.tiers || [];
  const [tier, setTier] = useState(tiers.length === 1 ? tiers[0] : null);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState(false);
  if (form && tier && date && slot) {
    return <BookingForm gig={gig} tier={tier} token={token} slotDate={date} slot={slot} onClose={onClose} />;
  }
  return (
    <Sheet title={title} onClose={onClose} testid="book-sheet">
      {tiers.length > 1 && (
        <div className="space-y-2 mb-4">
          <TierList tiers={tiers} selected={tier} onSelect={(tt) => { setTier(tt); setSlot(null); }} isAppointment testidPrefix="book-sheet-tier" />
        </div>
      )}
      {tier && (
        <AppointmentPicker gig={gig} tier={tier} isWhatsApp={false} selectedDate={date} selectedSlot={slot}
          onSelectDate={(d) => { setDate(d); setSlot(null); }} onSelectSlot={setSlot} />
      )}
      <button type="button" disabled={!tier || !date || !slot} onClick={() => setForm(true)}
        className="mt-4 w-full min-h-[48px] rounded-full font-bold disabled:opacity-40"
        style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="book-sheet-continue">
        {t('basket.continue', 'Continue')}
      </button>
    </Sheet>
  );
}

export default function CardAction({ gig, basket, t, title, onMessage }) {
  const kind = actionKind(gig);
  const [open, setOpen] = useState(false);
  const btn = 'min-h-[40px] px-3 sm:px-4 rounded-full text-[13px] sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap';
  const solid = { background: 'var(--action)', color: 'var(--action-ink)' };
  const quiet = { border: '1px solid var(--brand-border)', color: 'var(--ink)', background: 'var(--surface)' };

  if (kind === 'product') {
    const p = withIds(gig)[0];
    const inBasket = (basket.items[gig.id] || {})[p.id] || 0;
    const out = p.in_stock === false;
    return (
      <div className="flex items-center justify-between gap-2" data-testid={`card-action-${gig.id}`} data-kind="product">
        <QtyStepper value={inBasket} disabled={out} t={t} testid={`card-qty-${gig.id}`} onChange={(n) => basket.setQty(gig.id, p.id, n)} />
        {inBasket === 0 && (
          <button type="button" disabled={out} onClick={() => basket.add(gig.id, p.id, 1)} className={`${btn} disabled:opacity-40`} style={solid} data-testid={`card-add-${gig.id}`}>
            <ShoppingBag size={14} aria-hidden="true" /> {out ? t('basket.outOfStock', 'Out of stock') : t('basket.addToOrder', 'Add to order')}
          </button>
        )}
      </div>
    );
  }
  if (kind === 'products') {
    const n = Object.values(basket.items[gig.id] || {}).reduce((a, b) => a + b, 0);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={`${btn} w-full`} style={n ? quiet : solid} data-testid={`card-choose-${gig.id}`} data-kind="products">
          <ShoppingBag size={14} aria-hidden="true" />
          {n ? t('basket.chosenN', { count: n, defaultValue: '{{count}} in your order · change' }) : t('basket.choose', 'Choose items')}
        </button>
        {open && <ProductSheet gig={gig} basket={basket} title={title} t={t} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (kind === 'book') {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={`${btn} w-full`} style={solid} data-testid={`card-book-${gig.id}`} data-kind="book">
          <CalendarCheck size={14} aria-hidden="true" /> {t('basket.book', 'Book')}
        </button>
        {open && <BookSheet gig={gig} title={title} t={t} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <button type="button" onClick={() => onMessage(gig)} className={`${btn} w-full`} style={quiet} data-testid={`card-message-${gig.id}`} data-kind="message">
      <MessageCircle size={14} aria-hidden="true" /> {t('basket.message', 'Message')}
    </button>
  );
}

/** The basket: count, total and Send order. One button per listing when a
 *  store has products in more than one listing, since each is one order. */
export function BasketBar({ business, basket, t, className = '', inline = false }) {
  const navigate = useNavigate();
  const listings = business.listings || [];
  const groups = Object.entries(basket.items).map(([gigId, group]) => {
    const gig = listings.find((g) => g.id === gigId);
    if (!gig) return null;
    const products = withIds(gig);
    const lines = Object.entries(group).map(([id, q]) => ({ p: products.find((x) => x.id === id), q })).filter((l) => l.p);
    if (!lines.length) return null;
    const priced = lines.every((l) => l.p.price !== null && l.p.price !== undefined && l.p.price !== '');
    const currency = lines[0].p.currency || 'ILS';
    const total = priced ? lines.reduce((s, l) => s + Number(l.p.price) * l.q, 0) : null;
    return { gig, group, n: lines.reduce((s, l) => s + l.q, 0), total, currency };
  }).filter(Boolean);
  if (!groups.length) return null;
  const send = (g) => navigate(orderHref(g.gig.id, g.group));
  return (
    <div className={inline ? `mb-2 ${className}` : `fixed z-40 bottom-5 end-5 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border bg-white p-4 shadow-xl ${className}`}
      style={{ borderColor: 'var(--brand-border)' }} data-testid={inline ? 'basket-bar-inline' : 'basket-bar'}>
      {groups.map((g) => (
        <div key={g.gig.id} className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0 text-sm" style={{ color: 'var(--ink)' }}>
            <p className="font-semibold">
              {t('basket.items', { count: g.n, defaultValue: '{{count}} items' })}
              {g.total !== null && <span> · {money(g.total, g.currency)}</span>}
            </p>
            {groups.length > 1 && <p className="text-xs truncate" style={{ color: 'var(--brand-muted)' }} dir="auto">{g.gig.title}</p>}
          </div>
          <button type="button" onClick={() => send(g)} className="min-h-[44px] px-5 rounded-full text-sm font-bold shrink-0"
            style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid={`basket-send-${g.gig.id}`}>
            {t('basket.send', 'Send order')}
          </button>
        </div>
      ))}
      <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('basket.noPayment', 'No account and no payment here. The business confirms with you.')}</p>
    </div>
  );
}
