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
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Loader2, ClipboardPaste, Store as StoreIcon, Bike, X, Sparkles, ClipboardList,
  LayoutList, Table2, Printer, Download, Upload, Link2, Copy, Check, RotateCcw, Pencil, MessageCircle,
} from 'lucide-react';
import { phoneError } from '../../utils/phoneValidation';
import OrderCard, { STATUS_ORDER, OPEN, NEXT, pillStyle } from './OrderCard';


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

/** The query for each range tab; also what Print and Export use, so
 * what you print is what you were looking at. */
const rangeParams = (range) => {
  const today = localDate(new Date());
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') {
    const end = new Date(); end.setDate(end.getDate() + 6);
    return { from: today, to: localDate(end) };
  }
  if (range === 'open') return { status: 'open' };
  return { status: 'done' };
};

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
  const navigate = useNavigate();
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
  // Cards are the board; the table is for the owner who wants the sheet
  // feel (spec O3). Remembered per browser.
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('orders.view') === 'table' ? 'table' : 'cards'; } catch { return 'cards'; }
  });
  const [panel, setPanel] = useState(null);           // 'staff' | 'import' | null

  useEffect(() => {
    try { localStorage.setItem('orders.view', view); } catch { /* private mode */ }
  }, [view]);

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
      const params = rangeParams(range);
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

  // Spec O9: the export is always one tap away, because owners keep the
  // sheet open out of fear and this is what lets them close it.
  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/marketplace/businesses/${bizId}/orders/export.csv`, {
        ...auth, params: rangeParams(range), responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const p = rangeParams(range);
      a.href = url;
      a.download = `orders-${p.from || range}-${p.to || ''}.csv`.replace(/-$/, '');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.exportFailed', 'Could not export'));
    }
  };

  const printOrders = () => {
    const p = rangeParams(range);
    const today = localDate(new Date());
    // The print page shows OPEN orders in a date window; "All open" and
    // "Done" have no window, so print the month ahead.
    const end = new Date(); end.setDate(end.getDate() + 30);
    const q = new URLSearchParams({ business: bizId, from: p.from || today, to: p.to || localDate(end) });
    // Same tab, not window.open: the session lives in sessionStorage,
    // which a new tab does not inherit, so a new tab lands on the login
    // page. The print page has a Back button.
    navigate(`/orders/print?${q.toString()}`);
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

      {/* Toolbar: view, staff link, print, export, import. Small and
          quiet - the black button on this screen is New order. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3" data-testid="orders-toolbar">
        <div className="inline-flex rounded-full border p-0.5 me-1" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orders.view', 'View')}>
          {[['cards', LayoutList, t('orders.viewCards', 'Cards')], ['table', Table2, t('orders.viewTable', 'Table')]].map(([v, Icon, lbl]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className="inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-full text-xs font-semibold"
              style={view === v ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }}
              data-testid={`orders-view-${v}`}
            >
              <Icon size={13} /> {lbl}
            </button>
          ))}
        </div>
        {[
          ['staff', Link2, t('orders.staffLink', 'Staff link'), () => setPanel(panel === 'staff' ? null : 'staff')],
          ['print', Printer, t('orders.print.button', 'Print'), printOrders],
          ['export', Download, t('orders.export', 'Export CSV'), exportCsv],
          ['import', Upload, t('orders.import', 'Import customers'), () => setPanel(panel === 'import' ? null : 'import')],
        ].map(([key, Icon, lbl, fn]) => (
          <button
            key={key}
            type="button"
            onClick={fn}
            aria-pressed={panel === key ? true : undefined}
            className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-full text-xs font-semibold border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)', background: panel === key ? 'var(--surface-muted)' : 'transparent' }}
            data-testid={`orders-tool-${key}`}
          >
            <Icon size={13} /> {lbl}
          </button>
        ))}
      </div>

      {panel === 'staff' && <StaffLinkPanel API={API} auth={auth} businessId={biz.id} onClose={() => setPanel(null)} />}
      {panel === 'import' && <ImportCustomersPanel API={API} auth={auth} businessId={biz.id} onClose={() => setPanel(null)} />}

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
      ) : view === 'table' ? (
        <OrdersTable
          orders={visible}
          busyId={busyId}
          onStatus={setStatus}
          onEdit={(o) => { setEntryOpen(false); setEditing(o); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          t={t}
        />
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

/**
 * The sheet feel (spec O3): one row per order, the columns the sheet
 * had, sortable by clicking a header. The next step is still one tap.
 */
function OrdersTable({ orders, busyId, onStatus, onEdit, t }) {
  const [sort, setSort] = useState({ key: 'needed_by', dir: 1 });
  const rows = useMemo(() => {
    const list = [...orders];
    const val = (o) => {
      if (sort.key === 'total') return o.total == null ? -1 : Number(o.total);
      if (sort.key === 'status') return STATUS_ORDER.indexOf(o.status);
      if (sort.key === 'customer_name') return (o.customer_name || '').toLowerCase();
      return o.needed_by || '';
    };
    list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
    return list;
  }, [orders, sort]);
  const th = (key, label, extra = '') => (
    <th className={`text-start font-semibold py-2 px-2 whitespace-nowrap ${extra}`} style={{ color: 'var(--brand-muted)' }}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))} className="inline-flex items-center gap-1 min-h-[32px]">
        {label}{sort.key === key && <span aria-hidden="true">{sort.dir === 1 ? '\u2191' : '\u2193'}</span>}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="orders-table">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--brand-border)' }}>
            {th('needed_by', t('orders.neededBy', 'Needed by'))}
            {th('customer_name', t('orders.name', 'Customer'))}
            <th className="text-start font-semibold py-2 px-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.items', 'Items')}</th>
            <th className="text-start font-semibold py-2 px-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.fulfilment', 'Pickup or delivery')}</th>
            {th('total', t('orders.total', 'Total (\u20aa)'), 'text-end')}
            {th('status', t('orders.statusCol', 'Status'))}
            <th className="py-2 px-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const next = NEXT[o.status];
            const nextLabel = next && {
              preparing: t('orders.action.start', 'Start'),
              ready: t('orders.action.ready', 'Ready'),
              done: o.fulfilment === 'delivery' ? t('orders.action.delivered', 'Delivered') : t('orders.action.collected', 'Collected'),
            }[next];
            const nb = o.needed_by || '';
            return (
              <tr key={o.id} className="border-b align-top" style={{ borderColor: 'var(--brand-border)', opacity: OPEN.has(o.status) ? 1 : 0.65 }} data-testid={`orders-row-${o.id}`}>
                <td className="py-2 px-2 whitespace-nowrap tabular-nums" style={{ color: 'var(--ink)' }}>
                  <div className="font-semibold">{nb.includes('T') ? nb.slice(11, 16) : '\u2014'}</div>
                  <div className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>{nb.slice(0, 10)}</div>
                </td>
                <td className="py-2 px-2" style={{ color: 'var(--ink)' }}>
                  <div className="font-semibold" dir="auto">{o.customer_name}</div>
                  {o.customer_phone && (
                    <a href={o.customer_phone_e164 ? `tel:+${o.customer_phone_e164}` : undefined} className="text-[11px]" dir="ltr" style={{ color: 'var(--brand-muted)' }}>{o.customer_phone}</a>
                  )}
                </td>
                <td className="py-2 px-2 whitespace-pre-line" dir="auto" style={{ color: 'var(--ink)' }}>
                  {o.items}
                  {o.notes && <div className="text-[11px] italic" style={{ color: 'var(--brand-muted)' }}>{o.notes}</div>}
                </td>
                <td className="py-2 px-2" style={{ color: 'var(--ink)' }}>
                  {o.fulfilment === 'delivery' ? t('orders.delivery', 'Delivery') : t('orders.pickup', 'Pickup')}
                  {o.address && <div className="text-[11px]" dir="auto" style={{ color: 'var(--brand-muted)' }}>{o.address}</div>}
                </td>
                <td className="py-2 px-2 text-end tabular-nums whitespace-nowrap" style={{ color: 'var(--ink)' }}>{o.total != null ? `\u20aa${Number(o.total).toLocaleString()}` : ''}</td>
                <td className="py-2 px-2 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={pillStyle(o.status, false)}>{t(`orders.status.${o.status}`, o.status)}</span>
                </td>
                <td className="py-2 px-2 whitespace-nowrap text-end">
                  {next && (
                    <button type="button" disabled={busyId === o.id} onClick={() => onStatus(o, next)} className="px-3 min-h-[32px] rounded-full text-xs font-semibold me-1 disabled:opacity-60" style={next === 'done' ? { background: 'var(--status-open-bg)', color: 'var(--status-open)' } : { background: 'var(--action)', color: 'var(--action-ink)' }}>
                      {busyId === o.id ? <Loader2 size={12} className="animate-spin inline" /> : nextLabel}
                    </button>
                  )}
                  {OPEN.has(o.status) && (
                    <button type="button" onClick={() => onEdit(o)} className="inline-flex items-center justify-center min-h-[32px] min-w-[32px] rounded-full" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.edit', 'Edit')}>
                      <Pencil size={13} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The shared staff link (spec O3). One per business; anyone holding it
 * sees the board and moves orders, with no login. The panel says so in
 * plain words, because "share" undersells what the link can do.
 */
function StaffLinkPanel({ API, auth, businessId, onClose }) {
  const { t } = useTranslation();
  const [token, setToken] = useState(undefined);   // undefined = loading
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/businesses/${businessId}/orders/staff-link`, auth)
      .then(({ data }) => alive && setToken(data.token || null))
      .catch(() => alive && setToken(null));
    return () => { alive = false; };
  }, [API, auth, businessId]);

  const url = token ? `${window.location.origin}/orders/staff/${token}` : '';

  const create = async (rotate) => {
    if (rotate) {
      // eslint-disable-next-line no-alert
      if (!window.confirm(t('orders.staff.confirmReset', 'Reset the link? Everyone with the old one loses access right away.'))) return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/orders/staff-link`, null, { ...auth, params: rotate ? { rotate: true } : {} });
      setToken(data.token);
      setCopied(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('orders.staff.confirmOff', 'Turn the link off? The board stops working for everyone who has it.'))) return;
    setBusy(true);
    try {
      await axios.delete(`${API}/marketplace/businesses/${businessId}/orders/staff-link`, auth);
      setToken(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('orders.staff.copyFailed', 'Could not copy - select the link and copy it by hand'));
    }
  };

  const btn = 'inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full text-xs font-semibold border disabled:opacity-60';
  const btnStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="staff-link-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{t('orders.staff.title', 'The board for your staff')}</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('orders.staff.body', 'One link for the counter. Anyone who has it sees the day\'s orders and can mark them started, ready and done - no login, no account. They cannot add or change orders.')}
          </p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full shrink-0" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.close', 'Close')}>
          <X size={18} />
        </button>
      </div>

      {token === undefined ? (
        <div className="py-4" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={16} /></div>
      ) : token ? (
        <div className="mt-3 space-y-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="w-full px-3 min-h-[44px] rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} dir="ltr" data-testid="staff-link-url" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={btn} style={{ background: 'var(--action)', color: 'var(--action-ink)', borderColor: 'transparent' }} data-testid="staff-link-copy">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t('orders.staff.copied', 'Copied') : t('orders.staff.copy', 'Copy link')}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(t('orders.staff.shareText', 'Orders board: {{url}}', { url }))}`} target="_blank" rel="noopener noreferrer" className={btn} style={btnStyle}>
              <MessageCircle size={13} /> {t('orders.staff.share', 'Send on WhatsApp')}
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer" className={btn} style={btnStyle}>
              <Link2 size={13} /> {t('orders.staff.open', 'Open')}
            </a>
            <button type="button" disabled={busy} onClick={() => create(true)} className={btn} style={btnStyle}>
              <RotateCcw size={13} /> {t('orders.staff.reset', 'Reset link')}
            </button>
            <button type="button" disabled={busy} onClick={revoke} className="px-3 min-h-[40px] text-xs font-semibold ms-auto" style={{ color: 'var(--brand-muted)' }}>
              {t('orders.staff.off', 'Turn off')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={() => create(false)} className={btn} style={{ background: 'var(--action)', color: 'var(--action-ink)', borderColor: 'transparent' }} data-testid="staff-link-create">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} {t('orders.staff.create', 'Create the link')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Import customers from the sheet (spec O9): paste it, or pick the
 * exported file. Name, phone and address are found by their headers in
 * either language; nothing else is read. Day one with forty names in
 * the autocomplete, not zero.
 */
function ImportCustomersPanel({ API, auth, businessId, onClose }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(f);
  };

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/customers/import`, { text }, auth);
      setResult(data);
      toast.success(t('orders.importDone', '{{n}} customers imported', { n: data.imported }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.importFailed', 'Could not import'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="import-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{t('orders.importTitle', 'Bring your customers over')}</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('orders.importBody', 'Paste your customer list from the sheet, or choose the file. We read the name, phone and address columns and nothing else. Names then fill in as you type.')}
          </p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full shrink-0" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.close', 'Close')}>
          <X size={18} />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        dir="auto"
        placeholder={t('orders.importPh', 'Name, Phone, Address\nRivka Levi, 052-9998877, Herzl 3')}
        className="w-full mt-3 px-3 py-2 rounded-lg border text-sm bg-white font-mono"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
        data-testid="import-text"
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button type="button" disabled={busy || !text.trim()} onClick={run} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="import-run">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('orders.importRun', 'Import')}
        </button>
        <label className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full text-sm font-semibold border cursor-pointer" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
          <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" onChange={onFile} className="sr-only" />
          {t('orders.importFile', 'Choose a file')}
        </label>
        {result && (
          <span className="text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="import-result">
            {t('orders.importResult', '{{n}} of {{rows}} rows imported', { n: result.imported, rows: result.rows })}
          </span>
        )}
      </div>
    </div>
  );
}
