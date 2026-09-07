/**
 * Dashboard → Orders (docs/orders-and-delivery-spec.md, phase 1: O1 + O2).
 *
 * The Google Sheet a shop passes around, replaced by something faster to
 * type into. Everything here is built around one sentence from the spec:
 *
 *   "A purpose-built tool only wins if it is at least as fast to enter one
 *    order into as typing a row in Sheets, on day one, with zero setup."
 *
 * So: no catalogue, no menu, no configuration. The first order can be
 * entered ninety seconds after opening the tab. Three ways in, fastest
 * first — paste the customer's WhatsApp message and let the form fill
 * itself; type three letters of a returning customer's name; or a blank
 * form with big targets and a needed-by that defaults to something
 * sensible.
 *
 * Designed for 375px first. A baker enters an order one-handed, holding a
 * tray, on a phone. Everything the owner taps is at least 44px tall.
 *
 * The day board, the shared staff link and print (O3) are the next phase;
 * this list is deliberately just "today / this week / all open / done",
 * grouped by day, soonest first, with the status pills that double as
 * counters (the BookingsTab pattern).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Loader2, ClipboardPaste, Phone, MapPin, Store as StoreIcon, Bike, Pencil, X,
  ChevronDown, Undo2, Sparkles, ClipboardList, MessageCircle,
} from 'lucide-react';
import { phoneError } from '../../utils/phoneValidation';
import { buildWhatsAppLink } from '../../utils/whatsappLink';

const STATUS_ORDER = ['new', 'preparing', 'ready', 'done', 'cancelled', 'failed'];
const NEXT = { new: 'preparing', preparing: 'ready', ready: 'done' };
const BACK = { preparing: 'new', ready: 'preparing' };
const OPEN = new Set(['new', 'preparing', 'ready']);

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Next sensible slot: tomorrow at 10:00, skipping Shabbat. Not "now" —
 * the spec is explicit that food businesses live by this field and
 * "now" is never the answer. If today is Friday the default lands on
 * Sunday, which is what the customer meant.
 */
const defaultNeededBy = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 1);
  return { date: localDate(d), time: '10:00' };
};

const splitNeededBy = (s) => {
  if (!s) return { date: '', time: '' };
  const [date, time] = s.split('T');
  return { date, time: time || '' };
};
const joinNeededBy = (date, time) => (time ? `${date}T${time}` : date);

const EMPTY_FORM = () => ({
  customer_name: '',
  customer_phone: '',
  items: '',
  total: '',
  ...defaultNeededBy(),
  fulfilment: 'pickup',
  address: '',
  notes: '',
  source: 'manual',
});

const fromOrder = (o) => ({
  customer_name: o.customer_name || '',
  customer_phone: o.customer_phone || '',
  items: o.items || '',
  total: o.total == null ? '' : String(o.total),
  ...splitNeededBy(o.needed_by),
  fulfilment: o.fulfilment || 'pickup',
  address: o.address || '',
  notes: o.notes || '',
  source: o.source || 'manual',
});

export default function OrdersTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => {
    try { return localStorage.getItem('orders.business') || ''; } catch { return ''; }
  });
  const [range, setRange] = useState('today');        // today | week | open | done
  const [statusFilter, setStatusFilter] = useState('');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState(null);       // order being edited, or null
  const [busyId, setBusyId] = useState(null);

  // ---- businesses -------------------------------------------------------
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/businesses`, auth)
      .then(({ data }) => {
        if (!alive) return;
        const active = (data || []).filter((b) => b.active);
        setBusinesses(active);
        if (!active.find((b) => b.id === bizId) && active[0]) setBizId(active[0].id);
      })
      .catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);

  useEffect(() => {
    try { if (bizId) localStorage.setItem('orders.business', bizId); } catch { /* private mode */ }
  }, [bizId]);

  // ---- orders ------------------------------------------------------------
  const load = useCallback(async () => {
    // Only for a business in THIS account's list. The remembered id can
    // belong to whoever was signed in last on this browser, and asking
    // for their orders is a 403 (and a wrong "could not load" toast)
    // until the list arrives and the id is corrected.
    if (!bizId || !businesses || !businesses.some((b) => b.id === bizId)) return;
    setLoading(true);
    try {
      const today = localDate(new Date());
      const params = {};
      if (range === 'today') { params.from = today; params.to = today; }
      else if (range === 'week') {
        const end = new Date(); end.setDate(end.getDate() + 6);
        params.from = today; params.to = localDate(end);
      } else if (range === 'open') { params.status = 'open'; }
      else if (range === 'done') { params.status = 'done'; }
      const { data } = await axios.get(`${API}/marketplace/businesses/${bizId}/orders`, { ...auth, params });
      setOrders(data.orders || []);
      setCounts(data.status_counts || {});
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.loadFailed', 'Could not load orders'));
    } finally {
      setLoading(false);
    }
  }, [API, auth, bizId, businesses, range, t]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (statusFilter ? orders.filter((o) => o.status === statusFilter) : orders),
    [orders, statusFilter],
  );

  // Grouped by day, in the order the server returned (soonest first).
  const groups = useMemo(() => {
    const map = new Map();
    for (const o of visible) {
      const day = (o.needed_by || '').slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(o);
    }
    return [...map.entries()];
  }, [visible]);

  const setStatus = async (order, status) => {
    setBusyId(order.id);
    try {
      const { data } = await axios.patch(`${API}/marketplace/orders/${order.id}/status`, { status }, auth);
      setOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      setCounts((c) => ({ ...c, [order.status]: Math.max(0, (c[order.status] || 0) - 1), [status]: (c[status] || 0) + 1 }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.saveFailed', 'Could not save'));
      if (err?.response?.status === 409) load();
    } finally {
      setBusyId(null);
    }
  };

  const onSaved = (order, wasEdit) => {
    setEntryOpen(false);
    setEditing(null);
    if (wasEdit) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    } else {
      // Reload rather than splice: the new order may fall outside the
      // range on screen, and the counters come from the server.
      load();
    }
    toast.success(wasEdit ? t('orders.updated', 'Order updated') : t('orders.saved', 'Order saved'));
  };

  const lang = String(i18n.language || 'en').split('-')[0];
  const dayLabel = (day) => {
    if (!day) return t('orders.noDate', 'No date');
    const today = localDate(new Date());
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    if (day === today) return t('orders.today', 'Today');
    if (day === localDate(tmr)) return t('orders.tomorrow', 'Tomorrow');
    const d = new Date(`${day}T00:00`);
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
  };

  if (businesses === null) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}>
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} data-testid="orders-no-business">
        <ClipboardList size={22} className="inline mb-2" />
        <p className="text-sm">{t('orders.needBusiness', 'Add a business first — orders belong to a business.')}</p>
      </div>
    );
  }

  const biz = businesses.find((b) => b.id === bizId) || businesses[0];
  const statusLabel = (s) => t(`orders.status.${s}`, s);

  return (
    <div data-testid="orders-tab">
      {/* Header: title, business picker (only when there is a choice), new-order button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('orders.title', 'Orders')}</h2>
        <div className="flex items-center gap-2">
          {businesses.length > 1 && (
            <select
              value={biz.id}
              onChange={(e) => setBizId(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
              aria-label={t('orders.pickBusiness', 'Business')}
              data-testid="orders-business-select"
            >
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {!entryOpen && !editing && (
            <button
              type="button"
              onClick={() => setEntryOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }}
              data-testid="orders-new"
            >
              <Plus size={15} /> {t('orders.new', 'New order')}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('orders.body', 'Type what the customer asked for, or paste their message. No setup, no catalogue.')}
      </p>

      {(entryOpen || editing) && (
        <OrderForm
          API={API}
          auth={auth}
          businessId={biz.id}
          initial={editing ? fromOrder(editing) : EMPTY_FORM()}
          orderId={editing?.id}
          onCancel={() => { setEntryOpen(false); setEditing(null); }}
          onSaved={onSaved}
        />
      )}

      {/* Range tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto" role="tablist" data-testid="orders-range">
        {[
          ['today', t('orders.rangeToday', 'Today')],
          ['week', t('orders.rangeWeek', 'This week')],
          ['open', t('orders.rangeOpen', 'All open')],
          ['done', t('orders.rangeDone', 'Done')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={range === key}
            onClick={() => { setRange(key); setStatusFilter(''); }}
            className="px-3 min-h-[40px] rounded-lg text-sm font-semibold whitespace-nowrap"
            style={range === key
              ? { background: 'var(--ink)', color: 'var(--action-ink)' }
              : { color: 'var(--brand-muted)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status pills = filters + counters */}
      {range !== 'done' && (
        <div className="flex flex-wrap gap-1.5 mb-4" data-testid="orders-status-pills">
          {STATUS_ORDER.filter((s) => range === 'open' ? OPEN.has(s) : true).map((s) => {
            const n = counts[s] || 0;
            if (!n && !['new', 'preparing', 'ready'].includes(s)) return null;
            const on = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(on ? '' : s)}
                className="inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-full text-xs font-semibold border"
                style={pillStyle(s, on)}
                aria-pressed={on}
              >
                {statusLabel(s)} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="py-10 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={18} /></div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} data-testid="orders-empty">
          <ClipboardList size={22} className="inline mb-2" />
          <p className="text-sm">
            {range === 'today'
              ? t('orders.emptyToday', 'Nothing due today.')
              : t('orders.empty', 'No orders here yet.')}
          </p>
          {!entryOpen && (
            <button type="button" onClick={() => setEntryOpen(true)} className="mt-3 text-sm font-semibold underline" style={{ color: 'var(--ink)' }}>
              {t('orders.enterFirst', 'Enter the first one')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, list]) => (
            <section key={day || 'none'} data-testid={`orders-day-${day}`}>
              <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-muted)' }}>
                {dayLabel(day)} <span className="font-normal">· {list.length}</span>
              </h3>
              <div className="space-y-2">
                {list.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    busy={busyId === o.id}
                    onStatus={(s) => setStatus(o, s)}
                    onEdit={() => { setEntryOpen(false); setEditing(o); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// Status colours. Green is the site's one functional colour and it means
// "ready to go out"; new is the accent wash; everything else is neutral
// so the board reads calm at 6am. Cancelled/failed are told by the word
// and a strikethrough, not by a red the theme does not have.
function pillStyle(status, on) {
  const base = { borderColor: 'var(--brand-border)', color: 'var(--ink)', background: 'var(--surface)' };
  if (status === 'new') Object.assign(base, { background: 'var(--accent-soft)', color: 'var(--accent-soft-ink)', borderColor: 'transparent' });
  if (status === 'ready') Object.assign(base, { background: 'var(--status-open-bg)', color: 'var(--status-open)', borderColor: 'transparent' });
  if (status === 'preparing') Object.assign(base, { background: 'var(--surface-muted)' });
  if (status === 'done' || status === 'cancelled' || status === 'failed') Object.assign(base, { color: 'var(--brand-muted)' });
  if (on) Object.assign(base, { outline: '2px solid var(--ink)', outlineOffset: 1 });
  return base;
}

function OrderCard({ order: o, busy, onStatus, onEdit, t }) {
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
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
            <Pencil size={12} /> {t('orders.edit', 'Edit')}
          </button>
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

/**
 * The entry form. Target from the spec: an order in under 20 seconds on
 * a phone. The paste box is first because it is the fastest way in; the
 * name field autocompletes returning customers; everything else is a
 * large target with a sensible default.
 */
function OrderForm({ API, auth, businessId, initial, orderId, onCancel, onSaved }) {
  const { t } = useTranslation();
  const [f, setF] = useState(initial);
  const [paste, setPaste] = useState('');
  const [pasteOpen, setPasteOpen] = useState(!orderId);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggest, setSuggest] = useState([]);
  const [showNotes, setShowNotes] = useState(Boolean(initial.notes));
  const nameRef = useRef(null);
  const debounce = useRef(null);

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  // Returning customers: three letters of a name, or the phone's digits.
  const lookup = (q) => {
    clearTimeout(debounce.current);
    if (!q || q.trim().length < 2) { setSuggest([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/marketplace/businesses/${businessId}/customers`, { ...auth, params: { q: q.trim(), limit: 6 } });
        setSuggest(data || []);
      } catch { setSuggest([]); }
    }, 180);
  };

  const pick = (c) => {
    setF((prev) => ({
      ...prev,
      customer_name: c.customer_name || prev.customer_name,
      customer_phone: c.customer_phone || prev.customer_phone,
      address: c.address || prev.address,
      fulfilment: c.address && !prev.address ? 'delivery' : prev.fulfilment,
      // "Same as last time" — only into an empty items box.
      items: prev.items || c.last_items || '',
    }));
    setSuggest([]);
  };

  const extract = async () => {
    const text = paste.trim();
    if (!text) return;
    setExtracting(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/orders/extract`, { text }, auth);
      const d = data.draft || {};
      setF((prev) => ({
        ...prev,
        customer_name: d.customer_name ?? prev.customer_name,
        customer_phone: d.customer_phone ?? prev.customer_phone,
        items: d.items ?? prev.items,
        total: d.total != null ? String(d.total) : prev.total,
        ...(d.needed_by ? splitNeededBy(d.needed_by) : {}),
        fulfilment: d.fulfilment ?? prev.fulfilment,
        address: d.address ?? prev.address,
        notes: d.notes ?? prev.notes,
        source: 'whatsapp_paste',
      }));
      if (d.notes) setShowNotes(true);
      setPasteOpen(false);
      toast.success(t('orders.extracted', 'Filled in — check it, then save'));
      nameRef.current?.focus();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.extractFailed', 'Could not read that message — fill the form by hand'));
    } finally {
      setExtracting(false);
    }
  };

  const phoneErr = phoneError(f.customer_phone, t);
  const needPhone = f.fulfilment === 'delivery';
  const canSave = f.customer_name.trim().length > 0
    && f.items.trim().length > 0
    && f.date
    && !phoneErr
    && (!needPhone || (f.customer_phone.trim() && f.address.trim()));

  const save = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    const body = {
      customer_name: f.customer_name.trim(),
      customer_phone: f.customer_phone.trim() || null,
      items: f.items.trim(),
      total: f.total === '' ? null : Number(f.total),
      needed_by: joinNeededBy(f.date, f.time),
      fulfilment: f.fulfilment,
      address: f.fulfilment === 'delivery' ? f.address.trim() : null,
      notes: f.notes.trim(),
    };
    try {
      let data;
      if (orderId) {
        ({ data } = await axios.patch(`${API}/marketplace/orders/${orderId}`, { ...body, clear_total: body.total == null }, auth));
      } else {
        ({ data } = await axios.post(`${API}/marketplace/businesses/${businessId}/orders`, { ...body, source: f.source }, auth));
      }
      onSaved(data, Boolean(orderId));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : t('orders.saveFailed', 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 min-h-[44px] rounded-lg border text-base bg-white';
  const inputStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
  const label = 'block text-xs font-semibold mb-1';
  const labelStyle = { color: 'var(--brand-muted)' };

  return (
    <form onSubmit={save} className="rounded-2xl border p-3 sm:p-4 mb-5 bg-white space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="order-form">
      <div className="flex items-center justify-between">
        <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{orderId ? t('orders.editTitle', 'Edit order') : t('orders.newTitle', 'New order')}</h3>
        <button type="button" onClick={onCancel} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.close', 'Close')}>
          <X size={18} />
        </button>
      </div>

      {/* 1. Paste the message */}
      {!orderId && (
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)' }} data-testid="order-paste">
          {pasteOpen ? (
            <>
              <label className={label} style={labelStyle} htmlFor="order-paste-text">
                <ClipboardPaste size={12} className="inline me-1" />
                {t('orders.pasteLabel', 'Paste the customer\'s WhatsApp message')}
              </label>
              <textarea
                id="order-paste-text"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={3}
                placeholder={t('orders.pastePh', '"Hi, can I get 2 challahs and a babka for Friday, deliver to Hapalmach 14, Idan 054-1234567"')}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={inputStyle}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={extract}
                  disabled={extracting || !paste.trim()}
                  className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }}
                  data-testid="order-extract"
                >
                  {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {t('orders.fillFromMessage', 'Fill the form')}
                </button>
                <button type="button" onClick={() => setPasteOpen(false)} className="text-sm min-h-[44px] px-2" style={{ color: 'var(--brand-muted)' }}>
                  {t('orders.typeInstead', 'Type it instead')}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setPasteOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold min-h-[32px]" style={{ color: 'var(--ink)' }}>
              <ClipboardPaste size={14} /> {t('orders.pasteOpen', 'Paste a message instead')}
            </button>
          )}
        </div>
      )}

      {/* 2. Who */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <label className={label} style={labelStyle} htmlFor="order-name">{t('orders.name', 'Customer')}</label>
          <input
            id="order-name"
            ref={nameRef}
            value={f.customer_name}
            onChange={(e) => { set('customer_name')(e); lookup(e.target.value); }}
            onBlur={() => setTimeout(() => setSuggest([]), 150)}
            className={input}
            style={inputStyle}
            autoComplete="off"
            dir="auto"
            placeholder={t('orders.namePh', 'Name')}
            required
            data-testid="order-name"
          />
          {suggest.length > 0 && (
            <ul className="absolute z-20 start-0 end-0 mt-1 rounded-xl border bg-white overflow-hidden" style={{ borderColor: 'var(--brand-border)', boxShadow: 'var(--shadow-md)' }} data-testid="order-suggest">
              {suggest.map((c, i) => (
                <li key={i}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} className="w-full text-start px-3 py-2 min-h-[44px] text-sm hover:bg-[var(--surface-muted)]">
                    <span className="font-semibold" style={{ color: 'var(--ink)' }}>{c.customer_name}</span>
                    {c.customer_phone && <span className="ms-2 text-xs" style={{ color: 'var(--brand-muted)' }}>{c.customer_phone}</span>}
                    <span className="block text-[11px] truncate" style={{ color: 'var(--brand-muted)' }}>
                      {t('orders.orderedBefore', '{{n}} order(s)', { n: c.orders })}{c.last_items ? ` · ${c.last_items.split('\n')[0]}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className={label} style={labelStyle} htmlFor="order-phone">
            {t('orders.phone', 'Phone')}{needPhone ? '' : ` · ${t('orders.optional', 'optional')}`}
          </label>
          <input
            id="order-phone"
            type="tel"
            inputMode="tel"
            value={f.customer_phone}
            onChange={set('customer_phone')}
            className={input}
            style={{ ...inputStyle, borderColor: phoneErr ? 'var(--ink)' : 'var(--brand-border)' }}
            placeholder="050-123-4567"
            data-testid="order-phone"
          />
          {phoneErr && <p className="text-[11px] mt-1" style={{ color: 'var(--ink)' }}>{phoneErr}</p>}
        </div>
      </div>

      {/* 3. What */}
      <div>
        <label className={label} style={labelStyle} htmlFor="order-items">{t('orders.items', 'Items')}</label>
        <textarea
          id="order-items"
          value={f.items}
          onChange={set('items')}
          rows={2}
          dir="auto"
          className="w-full px-3 py-2 rounded-lg border text-base bg-white"
          style={inputStyle}
          placeholder={t('orders.itemsPh', '2 challahs, 1 chocolate babka')}
          required
          data-testid="order-items"
        />
      </div>

      {/* 4. When + how */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={label} style={labelStyle} htmlFor="order-date">{t('orders.neededBy', 'Needed by')}</label>
          <input id="order-date" type="date" value={f.date} onChange={set('date')} className={input} style={inputStyle} required data-testid="order-date" />
        </div>
        <div>
          <label className={label} style={labelStyle} htmlFor="order-time">{t('orders.time', 'Time')}</label>
          <input id="order-time" type="time" value={f.time} onChange={set('time')} className={input} style={inputStyle} data-testid="order-time" />
        </div>
        <div className="col-span-2">
          <span className={label} style={labelStyle}>{t('orders.fulfilment', 'Pickup or delivery')}</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ background: 'var(--surface-muted)' }} role="radiogroup">
            {[['pickup', StoreIcon, t('orders.pickup', 'Pickup')], ['delivery', Bike, t('orders.delivery', 'Delivery')]].map(([v, Icon, lbl]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={f.fulfilment === v}
                onClick={() => setF((p) => ({ ...p, fulfilment: v }))}
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-md text-sm font-semibold"
                style={f.fulfilment === v ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--ink)' }}
                data-testid={`order-fulfilment-${v}`}
              >
                <Icon size={14} /> {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {f.fulfilment === 'delivery' && (
        <div>
          <label className={label} style={labelStyle} htmlFor="order-address">{t('orders.address', 'Delivery address')}</label>
          <input
            id="order-address"
            dir="auto"
            value={f.address}
            onChange={set('address')}
            className={input}
            style={inputStyle}
            placeholder={t('orders.addressPh', 'Street, number, city — floor or entrance if it matters')}
            required
            data-testid="order-address"
          />
        </div>
      )}

      {/* 5. Money + notes, both optional and quiet */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} style={labelStyle} htmlFor="order-total">{t('orders.total', 'Total (₪)')} · {t('orders.optional', 'optional')}</label>
          <input id="order-total" type="number" inputMode="decimal" min="0" step="0.5" value={f.total} onChange={set('total')} className={input} style={inputStyle} placeholder="0" data-testid="order-total" />
        </div>
        <div className="flex items-end">
          {!showNotes && (
            <button type="button" onClick={() => setShowNotes(true)} className="text-sm font-semibold min-h-[44px]" style={{ color: 'var(--ink)' }}>
              + {t('orders.addNote', 'Add a note')}
            </button>
          )}
        </div>
      </div>
      {showNotes && (
        <div>
          <label className={label} style={labelStyle} htmlFor="order-notes">{t('orders.notes', 'Notes')}</label>
          <input id="order-notes" dir="auto" value={f.notes} onChange={set('notes')} className={input} style={inputStyle} placeholder={t('orders.notesPh', '"No nuts", "leave with the neighbour"')} data-testid="order-notes" />
        </div>
      )}

      <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
        {t('orders.moneyNote', 'The total is your own record. Payment happens between you and the customer — MyIsraelRental never handles it.')}
      </p>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSave || saving}
          className="px-5 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--action)', color: 'var(--action-ink)' }}
          data-testid="order-save"
        >
          {saving ? <Loader2 size={14} className="animate-spin inline" /> : (orderId ? t('orders.saveChanges', 'Save changes') : t('orders.save', 'Save order'))}
        </button>
        <button type="button" onClick={onCancel} className="px-3 min-h-[48px] text-sm font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {t('orders.cancel', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
