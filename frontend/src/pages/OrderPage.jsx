/**
 * /order/:gigId — a customer orders from a store (Tzvi, 2026-09-08).
 *
 * Products with quantities from what the store lists, a free line for
 * anything else, pickup or delivery, a date the cutoffs allow and one of
 * the store's windows for that weekday, a city the store serves plus the
 * street, name and phone. Email optional: it is what the confirmation
 * and the delivery photo go to. No account needed; a signed-in visitor
 * gets the form pre-filled and the order in their My orders tab.
 *
 * No payment here, ever. The confirmation says how the store takes it.
 *
 * Every rule the server enforces is also applied here, so the customer
 * never meets a refusal they could not see coming: closed days are not
 * pickable, delivery is offered only for served cities and above the
 * minimum, the fee is shown before the button.
 */
import React, { useContext, useEffect, useMemo, useState } from 'react';
import ShabbatClosedBar from '../components/marketplace/ShabbatClosedBar';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { parseItems } from '../utils/storeBasket';
import BirthdayInput, { birthdayOrNull } from '../components/forms/BirthdayInput';
import RestockNotify from '../components/forms/RestockNotify';
import GoesWith from '../components/forms/GoesWith';

// One id per store listing in this browser, for the left-behind basket
// reminder (backend basket_reminders.py). A new one after each order.
const basketKey = (gigId) => `orderBasketId:${gigId}`;
function basketId(gigId, fresh = false) {
  try {
    let id = fresh ? null : window.localStorage.getItem(basketKey(gigId));
    if (!id) {
      id = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
      window.localStorage.setItem(basketKey(gigId), id);
    }
    return id;
  } catch { return null; }
}
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Store as StoreIcon, Bike, Check, ExternalLink, ArrowLeft } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import { phoneError } from '../utils/phoneValidation';
import { pastCutoff } from '../utils/orderCutoffs';
import { money } from '../utils/currency';
import DateField, { toISODate } from '../components/common/DateField';
import CustomFieldInputs from '../components/forms/CustomFieldInputs';
import DiscountCodeInput, { discountOn } from '../components/forms/DiscountCodeInput';
import NoticeBar from '../components/marketplace/NoticeBar';
import WhatsAppAboutThis, { whatsAppHref, orderMessage, reserveWhatsAppTab } from '../components/marketplace/WhatsAppAboutThis';

// How far ahead a customer can order. The server sets no limit; this keeps
// the calendar to a sensible reach.
const ORDER_AHEAD_DAYS = 90;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function OrderPage() {
  const { gigId } = useParams();
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const lang = String(i18n.language || 'en').split('-')[0];

  const [data, setData] = useState(null);       // null loading, false not available
  const [qty, setQty] = useState({});           // product id -> qty
  const [extra, setExtra] = useState('');
  const [notes, setNotes] = useState('');
  // The store's own questions (backend custom_fields.py).
  const [answers, setAnswers] = useState({});
  const [code, setCode] = useState(null);         // a checked discount code
  const [fulfilment, setFulfilment] = useState('pickup');
  const [date, setDate] = useState('');
  const [windowKey, setWindowKey] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.whatsapp_number || user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [birthday, setBirthday] = useState('');
  // ?table=5 from a table's QR code (backend tables.py): an order for now,
  // served at the table, no phone or date asked.
  const tableParam = parseInt(params.get('table') || '', 10);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);       // {track_url, total}

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  useEffect(() => {
    axios.get(`${API}/marketplace/order-form/${gigId}`)
      .then(({ data: d }) => {
        setData(d);
        const add = params.get('add');
        if (add && d.products.some((p) => p.id === add)) setQty({ [add]: 1 });
        // From the storefront's basket: ?items=productId:qty,...
        const fromBasket = parseItems(params.get('items'), d.products.flatMap((p) => [p.id, ...(p.options || []).map((o) => `${p.id}::${o.id}`)]));
        if (Object.keys(fromBasket).length) setQty(fromBasket);
        if (d.business.areas.length === 1) setCity(d.business.areas[0].slug);
      })
      .catch(() => setData(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId]);

  useEffect(() => {
    if (user) {
      setName((n) => n || user.name || '');
      setPhone((p) => p || user.whatsapp_number || user.phone || '');
      setEmail((e) => e || user.email || '');
    }
  }, [user]);

  // The next 14 days, for explaining WHY a near day is closed (a cutoff
  // only ever bites in the coming week). The calendar itself reaches
  // ORDER_AHEAD_DAYS out: a row of 14 day buttons was the whole choice
  // until 22 Sep 2026 ("it only allows me to choose 2 weeks").
  const days = useMemo(() => {
    if (!data) return [];
    const out = [];
    const start = new Date(`${data.today}T00:00`);
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = iso(d);
      out.push({ key, dow: d.getDay(), closed: !!pastCutoff(key, data.settings.cutoffs), date: d });
    }
    return out;
  }, [data]);

  // Closed for Shabbat and holidays (backend shabbat.py). Each closure
  // arrives in Israel time with its offset; its first 16 characters are the
  // Israel clock, which is what a pickup time is, wherever the phone is.
  const closures = useMemo(() => (data?.business?.shabbat_closing?.closures || [])
    .map((c) => [String(c.start).slice(0, 16), String(c.end).slice(0, 16)]), [data]);
  const windowsForDay = useMemo(() => {
    if (!data || !date) return [];
    const dow = new Date(`${date}T00:00`).getDay();
    const list = fulfilment === 'delivery' ? data.settings.delivery_windows : data.settings.pickup_windows;
    // A window that touches a closure is not offered at all.
    return (list || []).filter((w) => w.weekday === dow
      && !closures.some(([a, b]) => a < `${date}T${w.end}` && `${date}T${w.start}` < b));
  }, [data, date, fulfilment, closures]);

  // The left-behind basket reminder (backend basket_reminders.py): saved a
  // moment after typing stops, once there is an email and something chosen.
  useEffect(() => {
    if (!data || done) return undefined;
    const chosen = Object.entries(qty).filter(([, n]) => n > 0).map(([key, n]) => ({ key, qty: n }));
    const mail = email.trim();
    if (!chosen.length || !EMAIL_OK.test(mail)) return undefined;
    const id = basketId(gigId);
    if (!id) return undefined;
    const h = setTimeout(() => {
      axios.post(`${API}/marketplace/order-form/${gigId}/basket`, {
        basket_id: id, email: mail, name: name.trim() || null, lines: chosen.slice(0, 60), lang: lang === 'he' ? 'he' : 'en',
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(h);
  }, [data, done, qty, email, name, gigId, lang]);

  useEffect(() => {
    // Keep the chosen window valid for the chosen day.
    if (!windowsForDay.some((w) => `${w.start}-${w.end}` === windowKey)) setWindowKey(windowsForDay[0] ? `${windowsForDay[0].start}-${windowsForDay[0].end}` : '');
  }, [windowsForDay, windowKey]);

  if (data === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="order-unavailable">
        <StoreIcon size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('order.unavailableTitle', 'This store is not taking orders right now')}</h1>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business.name_he) || data.business.name;
  const table = data.business.tables_on && tableParam > 0 ? tableParam : null;
  // Counted down to 0 is sold out too (backend restock.available).
  const onSale = (p) => p.in_stock && (p.stock === null || p.stock === undefined || p.stock > 0);
  const products = data.products.filter(onSale);
  const soldOut = data.products.filter((p) => !onSale(p));
  // One currency per store, the server refuses a mixed basket; the fee and
  // the minimum are in that currency too.
  const currency = (products[0] || data.products[0] || {}).currency || 'ILS';
  // One row per thing a customer can pick: the product, or each of its
  // sizes/flavours (backend ProductOption), keyed "product::option".
  const rowsOf = (p) => ((p.options || []).length
    ? p.options.filter((o) => o.in_stock !== false).map((o) => ({
      key: `${p.id}::${o.id}`, product: p, option: o, name: `${p.name} (${o.name})`,
      price: o.price === null || o.price === undefined ? p.price : o.price,
    }))
    : [{ key: p.id, product: p, option: null, name: p.name, price: p.price }]);
  const lines = products.flatMap(rowsOf).filter((r) => (qty[r.key] || 0) > 0).map((r) => ({ ...r, qty: qty[r.key] }));
  const subtotal = lines.reduce((s, l) => s + Number(l.price || 0) * l.qty, 0);
  // A counted product (backend stock.py) caps the quantity across its options.
  const maxFor = (p, key) => (p.stock === null || p.stock === undefined ? 99
    : Math.max(0, p.stock - rowsOf(p).filter((r) => r.key !== key).reduce((s, r) => s + (qty[r.key] || 0), 0)));
  // A code comes off the goods, never the delivery (backend discounts.py).
  const discount = lines.length ? discountOn(code, subtotal) : 0;
  // The same rule as backend orders.delivery_fee_for: free from free_over
  // (after the discount), else the city's own fee, else the store's.
  const freeOver = Number(data.settings.free_over || 0);
  const feeFor = (c) => {
    if (freeOver > 0 && subtotal - discount >= freeOver) return 0;
    const area = (data.settings.area_fees || {})[c];
    return Number(area === undefined || area === null ? data.settings.delivery_fee || 0 : area);
  };
  const fee = fulfilment === 'delivery' ? feeFor(city) : 0;
  const total = lines.length ? subtotal - discount + fee : null;
  const minOrder = Number(data.settings.min_order || 0);
  const belowMin = fulfilment === 'delivery' && minOrder > 0 && subtotal < minOrder;
  // Delivery only when the store has said it delivers (its own switch in
  // Orders settings) and there is somewhere to deliver to.
  const deliveryPossible = !!data.settings.delivery_on && (data.business.serves_nationwide || data.business.areas.length > 0);
  const phoneErr = phoneError(phone, t);
  // Days and times already at the store's order limits (orders._full).
  const full = data.full || { days: [], windows: [] };
  const windowFull = (day, w) => full.windows.includes(`${day}T${w.start}`);
  const closedNow = data.business.shabbat_closing?.closed_now || null;
  const closedAt = (day, hhmm) => closures.some(([a, b]) => a <= `${day}T${hhmm}` && `${day}T${hhmm}` < b);
  // A day is closed by its cutoff, by being full, or by Shabbat: every
  // window gone, or (a store without windows) closed through the working day.
  const shutDay = (key) => {
    const dow = new Date(`${key}T00:00`).getDay();
    const all = ((fulfilment === 'delivery' ? data.settings.delivery_windows : data.settings.pickup_windows) || []).filter((w) => w.weekday === dow);
    if (all.length) return all.every((w) => windowFull(key, w) || closures.some(([a, b]) => a < `${key}T${w.end}` && `${key}T${w.start}` < b));
    return closedAt(key, '09:00') && closedAt(key, '16:59');
  };
  const closedDay = (d) => { const k = toISODate(d); return !!pastCutoff(k, data.settings.cutoffs) || full.days.includes(k) || shutDay(k); };
  const lastDay = (() => { const d = new Date(`${data.today}T00:00`); d.setDate(d.getDate() + ORDER_AHEAD_DAYS); return toISODate(d); })();
  const chosenFull = !!date && windowsForDay.some((w) => `${w.start}-${w.end}` === windowKey && windowFull(date, w));
  const canSubmit = !closedNow && !chosenFull && (lines.length > 0 || extra.trim())
    && (table || (date && !pastCutoff(date, data.settings.cutoffs) && (windowsForDay.length === 0 || windowKey) && name.trim() && phone.trim()))
    && !(phone.trim() && phoneErr)
    && (data.custom_fields || []).every((f) => !f.required || (f.type === 'checkbox' ? answers[f.id] === true : String(answers[f.id] || '').trim()))
    && (table || fulfilment === 'pickup' || (address.trim() && (data.business.serves_nationwide || city) && !belowMin));

  const setQ = (id, n, max = 99) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, 99, n)) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    // Opened inside the tap, before the save, or the browser blocks it
    // (WhatsAppAboutThis.jsx). Only when the business has WhatsApp.
    const handoff = data.gig?.whatsapp ? reserveWhatsAppTab() : null;
    try {
      const w = windowsForDay.find((x) => `${x.start}-${x.end}` === windowKey);
      const body = {
        lines: lines.map((l) => ({ product_id: l.product.id, qty: l.qty, option_id: l.option ? l.option.id : null })),
        extra_items: extra.trim(), notes: notes.trim(), fulfilment: table ? 'pickup' : fulfilment, date: table ? data.today : date,
        window: !table && w ? { weekday: w.weekday, start: w.start, end: w.end } : null,
        table,
        city: !table && fulfilment === 'delivery' ? (city || null) : null,
        address: !table && fulfilment === 'delivery' ? address.trim() : null,
        customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim() || null,
        answers,
        discount_code: code ? code.code : null,
        birthday: data.business.birthday_on ? birthdayOrNull(birthday) : null,
        lang: lang === 'he' ? 'he' : 'en',
      };
      const { data: res } = await axios.post(`${API}/marketplace/order-form/${gigId}/orders`, body, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      // Then straight to WhatsApp with the order written in, exactly as the
      // site saved it (Tzvi, 22 Oct 2026). The order already exists here;
      // this is the conversation about it, and the business sees it even
      // if they never open their dashboard.
      let waText = '';
      if (handoff) {
        const link = `${window.location.origin}/orders/track/${res.track_token}`;
        try {
          const { data: tr } = await axios.get(`${API}/marketplace/orders/track/${encodeURIComponent(res.track_token)}`);
          waText = orderMessage(t, tr.items, link);
        } catch {
          waText = orderMessage(t, '', link);
        }
        handoff.go(whatsAppHref(gigId, 'order', waText));
      }
      setDone({ ...res, waText });
      window.scrollTo({ top: 0 });
      // Ordered: nothing to remind about, and the next basket is a new one.
      const bid = basketId(gigId);
      if (bid) axios.post(`${API}/marketplace/order-form/${gigId}/basket/${bid}/ordered`).catch(() => {});
      basketId(gigId, true);
    } catch (err) {
      if (handoff) handoff.close();
      const d = err?.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  // Why a struck-through day is struck through, said once per weekday: the
  // title tooltip never shows on a phone, which is where this form lives.
  const weekdayName = (wd) => new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long' }).format(new Date(2024, 0, 7 + wd));
  const closedWhy = (() => {
    const seen = new Set(); const out = [];
    days.filter((d) => d.closed).forEach((d) => {
      const c = pastCutoff(d.key, data.settings.cutoffs);
      if (!c || seen.has(d.dow)) return;
      seen.add(d.dow);
      out.push({ day: weekdayName(d.dow), closesDay: weekdayName(c.closes_day), time: c.closes_time || '00:00' });
    });
    return out;
  })();
  const input = 'w-full px-3 min-h-[44px] rounded-lg border text-base bg-white';
  const inputStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
  const label = 'block text-xs font-semibold mb-1';
  const labelStyle = { color: 'var(--brand-muted)' };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-10" data-testid="order-done">
        <PageMeta title={t('order.doneTitle', 'Order sent')} />
        <div className="rounded-2xl border bg-white p-5 text-center" style={{ borderColor: 'var(--brand-border)' }}>
          <span className="inline-grid place-content-center w-12 h-12 rounded-full mb-3" style={{ background: 'var(--status-open-bg)', color: 'var(--status-open)' }}><Check size={22} /></span>
          <h1 className="text-xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('order.doneTitle', 'Order sent')}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('order.doneBody', '{{name}} has your order. Follow it here:', { name: bizName })}</p>
          <a href={`/orders/track/${done.track_token}`} className="inline-flex items-center gap-1.5 mt-3 px-4 min-h-[44px] rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="order-track-link">
            {t('order.follow', 'Follow my order')} <ExternalLink size={14} />
          </a>
          {/* The same message again, for when the automatic one was
              blocked or they came back from WhatsApp without sending. */}
          {data.gig?.whatsapp && done.waText && (
            <WhatsAppAboutThis gigId={gigId} after="order" text={done.waText} testid="order-done-whatsapp"
              label={t('afterOrder.orderWhatsapp', 'Message them on WhatsApp about this order')} />
          )}
          {done.total != null && <p className="text-sm mt-4" style={{ color: 'var(--ink)' }}>{t('order.totalDue', 'Total: {{n}}', { n: money(done.total, done.currency || currency) })}</p>}
          <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
            {t('order.payNote', 'Payment goes to the store directly, not through MyIsraelRental.')}
            {data.business.payment_note ? ` ${data.business.payment_note}` : ''}
          </p>
          {(data.business.payment_links || []).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {data.business.payment_links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 min-h-[44px] inline-flex items-center rounded-full border text-xs font-semibold" style={inputStyle}>{l.label || l.url}</a>)}
            </div>
          )}
          {email.trim() && <p className="text-xs mt-3" style={{ color: 'var(--brand-muted)' }}>{t('order.emailSent', 'We emailed the details to {{email}}.', { email: email.trim() })}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6" data-testid="order-page">
      <PageMeta title={t('order.title', 'Order from {{name}}', { name: bizName })} />
      <Link to={`/businesses/${gigId}`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--brand-muted)' }}><ArrowLeft size={14} className="rtl:rotate-180" /> {bizName}</Link>
      <div className="flex items-center gap-3 mb-5">
        {data.business.logo_url && <img src={data.business.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />}
        <h1 className="text-xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('order.title', 'Order from {{name}}', { name: bizName })}</h1>
      </div>
      {table && (
        <p className="mb-4 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: 'var(--ink)', color: 'var(--action-ink)' }} data-testid="order-table">
          {t('tableOrder.banner', 'Table {{n}}: order here and it is brought to your table.', { n: table })}
        </p>
      )}

      <NoticeBar business={data.business} className="mb-4" />
      {closedNow && <ShabbatClosedBar closedNow={closedNow} className="mb-4" />}
      <form onSubmit={submit} className="space-y-5">
        {/* 1. What */}
        <section className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>{t('order.what', 'What would you like?')}</h2>
          {products.length === 0 && <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('order.noProducts', 'This store has not listed products yet - write what you want below.')}</p>}
          <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {products.map((p) => {
              const rows = rowsOf(p);
              const stepper = (r) => {
                const max = maxFor(p, r.key);
                return (
                  <div className="inline-flex items-center rounded-full border shrink-0" style={{ borderColor: 'var(--brand-border)' }}>
                    <button type="button" onClick={() => setQ(r.key, (qty[r.key] || 0) - 1, max)} className="w-11 h-11 grid place-content-center rounded-full" aria-label={t('order.less', 'Less')} style={{ color: 'var(--ink)' }}><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }} data-testid={`order-qty-${r.key}`}>{qty[r.key] || 0}</span>
                    <button type="button" disabled={(qty[r.key] || 0) >= max} onClick={() => setQ(r.key, (qty[r.key] || 0) + 1, max)} className="w-11 h-11 grid place-content-center rounded-full disabled:opacity-30" aria-label={t('order.more', 'More')} style={{ color: 'var(--ink)' }} data-testid={`order-add-${r.key}`}><Plus size={14} /></button>
                  </div>
                );
              };
              const few = p.stock !== null && p.stock !== undefined && p.stock <= 5;
              return (
                <li key={p.id} className="py-2" data-testid={`order-product-${p.id}`}>
                  <div className="flex items-center gap-3">
                    {p.image && <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{p.name}</div>
                      <div className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                        {rows[0].option ? '' : money(p.price, p.currency || currency)}{p.description ? `${rows[0].option ? '' : ' · '}${p.description}` : ''}
                        {few && <span data-testid={`order-left-${p.id}`}> · {t('order.left', '{{count}} left', { count: p.stock })}</span>}
                        {p.available_until && <span data-testid={`order-until-${p.id}`}> · {t('season.until', 'Order by {{d}}', { d: new Date(`${p.available_until}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }) })}</span>}
                      </div>
                    </div>
                    {!rows[0].option && stepper(rows[0])}
                  </div>
                  {rows[0].option && (
                    <ul className="mt-1 ps-3 space-y-1">
                      {rows.map((r) => (
                        <li key={r.key} className="flex items-center gap-3" data-testid={`order-option-${r.key}`}>
                          <span className="flex-1 min-w-0 text-sm" dir="auto" style={{ color: 'var(--ink)' }}>{r.option.name}</span>
                          <span className="text-xs tabular-nums" style={{ color: 'var(--brand-muted)' }}>{money(r.price, p.currency || currency)}</span>
                          {stepper(r)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <GoesWith gigId={gigId} products={products} qty={qty} onAdd={(key) => setQ(key, (qty[key] || 0) + 1)} currency={currency} />
          {/* Sold out right now, with "Tell me when it's back" (backend restock.py). */}
          {soldOut.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="order-sold-out">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }}>{t('restock.title', 'Sold out right now')}</p>
              <ul className="space-y-2">
                {soldOut.map((p) => (
                  <li key={p.id} className="flex items-start gap-3" data-testid={`order-soldout-${p.id}`}>
                    {p.image && <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 opacity-60" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm" dir="auto" style={{ color: 'var(--brand-muted)' }}>{p.name}</div>
                      <RestockNotify gigId={gigId} productId={p.id} initialEmail={email.trim()} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Items the list does not have. The store gets them with the
              items; "Notes" further down is for instructions. */}
          <label className={`${label} mt-3`} style={labelStyle} htmlFor="order-extra">{t('order.extraLabel', 'Something not on the list?')} · {t('orders.optional', 'optional')}</label>
          <input id="order-extra" value={extra} onChange={(e) => setExtra(e.target.value)} dir="auto" placeholder={t('order.extraPh', 'e.g. 1 gluten-free challah')} className={input} style={inputStyle} data-testid="order-extra" />
        </section>

        {/* 2. How (not for a table: it is now, at the table) */}
        {!table && (
        <section className="rounded-2xl border bg-white p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }}>
          {!deliveryPossible && (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ink)' }} data-testid="order-pickup-only">
              <StoreIcon size={14} aria-hidden="true" /> {t('order.pickupOnly', 'Pickup only')}
            </p>
          )}
          {deliveryPossible && (
          <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ background: 'var(--surface-muted)' }} role="radiogroup">
            {[['pickup', StoreIcon, t('orders.pickup', 'Pickup')], ['delivery', Bike, t('orders.delivery', 'Delivery')]].map(([v, Icon, lbl]) => (
              <button key={v} type="button" role="radio" aria-checked={fulfilment === v} onClick={() => setFulfilment(v)} className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-md text-sm font-semibold disabled:opacity-40" style={fulfilment === v ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--ink)' }} data-testid={`order-fulfilment-${v}`}>
                <Icon size={14} /> {lbl}{v === 'delivery' && fee > 0 ? ` · ${money(fee, currency)}` : ''}
              </button>
            ))}
          </div>
          )}
          {fulfilment === 'delivery' && (
            <div className="space-y-2">
              {!data.business.serves_nationwide && (
                <div>
                  <label className={label} style={labelStyle} htmlFor="order-city">{t('order.city', 'City')}</label>
                  <select id="order-city" value={city} onChange={(e) => setCity(e.target.value)} className={input} style={inputStyle} data-testid="order-city">
                    <option value="">{t('order.cityPick', 'Where the store delivers')}</option>
                    {data.business.areas.map((a) => <option key={a.slug} value={a.slug}>{(lang === 'he' && a.label_he) || a.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={label} style={labelStyle} htmlFor="order-address">{t('orders.address', 'Delivery address')}</label>
                <input id="order-address" value={address} onChange={(e) => setAddress(e.target.value)} dir="auto" className={input} style={inputStyle} placeholder={t('orders.addressPh', 'Street, number, city - floor or entrance if it matters')} data-testid="order-address" />
              </div>
              {freeOver > 0 && (
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="order-free-over">
                  {fee === 0 && subtotal - discount >= freeOver
                    ? t('order.freeDelivery', 'Free delivery on this order')
                    : t('order.freeOver', 'Free delivery from {{n}}', { n: money(freeOver, currency) })}
                </p>
              )}
              {minOrder > 0 && (
                <p className="text-xs" style={{ color: belowMin ? 'var(--ink)' : 'var(--brand-muted)' }} data-testid="order-min">
                  {t('order.minOrder', 'Delivery from {{n}}', { n: money(minOrder, currency) })}{belowMin ? ` · ${t('order.belowMin', 'add a little more, or choose pickup')}` : ''}
                </p>
              )}
            </div>
          )}

          <div>
            <span className={label} style={labelStyle}>{t('order.when', 'When?')}</span>
            <DateField
              value={date}
              onChange={setDate}
              min={data.today}
              max={lastDay}
              isDisabled={closedDay}
              clearable={false}
              placeholder={t('order.pickDay', 'Pick a day')}
              className={input}
              style={inputStyle}
              testid="order-date"
            />
            {closedWhy.length > 0 && (
              <p id="order-closed-why" className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }} data-testid="order-closed-why">
                {closedWhy.map((c) => t('order.closedWhy', '{{day}} orders close {{closesDay}} at {{time}}', c)).join('. ')}.
              </p>
            )}
            {windowsForDay.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2" role="radiogroup" data-testid="order-windows">
                {windowsForDay.map((w) => {
                  const k = `${w.start}-${w.end}`;
                  const isFull = windowFull(date, w);
                  return (
                    <button key={k} type="button" role="radio" aria-checked={windowKey === k} disabled={isFull} onClick={() => setWindowKey(k)} className="px-3 min-h-[44px] rounded-full text-xs font-semibold border tabular-nums disabled:opacity-50" style={windowKey === k && !isFull ? { background: 'var(--ink)', color: 'var(--action-ink)', borderColor: 'var(--ink)' } : inputStyle}>
                      {w.start}–{w.end}{isFull ? ` · ${t('orderLimits.full', 'Full')}` : ''}
                    </button>
                  );
                })}
              </div>
            )}
            {date && windowsForDay.length === 0 && <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{t('order.noWindows', 'The store will confirm the time with you.')}</p>}
            {data.business.shabbat_closing && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }} data-testid="order-shabbat-note">
                {t('shabbatClosing.formNote', 'Closed on Shabbat and holidays, so those times are not offered.')}
              </p>
            )}
          </div>
        </section>
        )}

        {/* 3. Who */}
        <section className="rounded-2xl border bg-white p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }}>
          <div>
            <label className={label} style={labelStyle} htmlFor="order-name">{t('order.name', 'Your name')}{table ? ` · ${t('orders.optional', 'optional')}` : ''}</label>
            <input id="order-name" value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={input} style={inputStyle} required={!table} data-testid="order-name" />
          </div>
          {!table && (
          <div>
            <label className={label} style={labelStyle} htmlFor="order-phone">{t('order.phone', 'Mobile')}</label>
            <input id="order-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} style={{ ...inputStyle, borderColor: phoneErr ? 'var(--ink)' : 'var(--brand-border)' }} placeholder="050-123-4567" required data-testid="order-phone" />
            {phoneErr && <p className="text-[11px] mt-1" style={{ color: 'var(--ink)' }}>{phoneErr}</p>}
            {fulfilment === 'delivery' && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.phoneNotice', 'The delivery person will see your number to reach you.')}</p>}
          </div>
          )}
          <div>
            <label className={label} style={labelStyle} htmlFor="order-email">{t('order.email', 'Email')} · {t('orders.optional', 'optional')}</label>
            <input id="order-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} style={inputStyle} placeholder="name@example.com" data-testid="order-email" />
            <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('order.emailWhy', 'For the confirmation, and the delivery photo when it arrives.')} {t('order.emailBasket', 'If you leave without ordering, we send one reminder of what you chose.')}</p>
          </div>
          {data.business.birthday_on && (
            <BirthdayInput value={birthday} onChange={setBirthday} businessName={bizName} testid="order-birthday" />
          )}
          <div>
            <label className={label} style={labelStyle} htmlFor="order-notes">{t('orders.notes', 'Notes')} · {t('orders.optional', 'optional')}</label>
            <input id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" className={input} style={inputStyle} placeholder={t('orders.notesPh', '"No nuts", "leave with the neighbour"')} data-testid="order-notes" />
          </div>
          <CustomFieldInputs fields={data.custom_fields} values={answers} onChange={setAnswers} testid="order-custom-fields" />
          {!user && (
            <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {t('order.signInHint', 'Have an account?')} <Link to={`/auth/login?redirect=${encodeURIComponent(`/order/${gigId}`)}`} className="underline" style={{ color: 'var(--ink)' }}>{t('order.signIn', 'Sign in')}</Link> {t('order.signInWhy', 'to fill this in and keep your orders in one place.')}
            </p>
          )}
        </section>

        {/* 4. Total + send */}
        <div className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }}>
          {lines.length > 0 && (
            <div className="mb-2">
              <DiscountCodeInput businessId={data.business.id} form="orders" amount={subtotal} phone={phone} applied={code} onApplied={setCode} initialCode={params.get('ref')} />
            </div>
          )}
          {lines.length > 0 && (
            <ul className="text-sm mb-2" style={{ color: 'var(--ink)' }} data-testid="order-summary">
              {lines.map((l) => <li key={l.key} className="flex justify-between"><span dir="auto">{l.qty} × {l.name}</span><span className="tabular-nums">{money(Number(l.price) * l.qty, currency)}</span></li>)}
              {discount > 0 && <li className="flex justify-between" style={{ color: '#1F5F3A' }} data-testid="order-discount"><span>{t('discounts.line', 'Discount {{code}}', { code: code.code })}</span><span className="tabular-nums">−{money(discount, currency)}</span></li>}
              {fee > 0 && <li className="flex justify-between"><span>{t('order.deliveryFee', 'Delivery')}</span><span className="tabular-nums">{money(fee, currency)}</span></li>}
              <li className="flex justify-between font-bold border-t mt-1 pt-1" style={{ borderColor: 'var(--brand-border)' }}><span>{t('order.total', 'Total')}</span><span className="tabular-nums" data-testid="order-total">{money(total, currency)}</span></li>
            </ul>
          )}
          <button type="submit" disabled={!canSubmit || busy} className="w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-full text-base font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="order-submit">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {t('order.submit', 'Send my order')}
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: 'var(--brand-muted)' }}>{t('order.payNote', 'Payment goes to the store directly, not through MyIsraelRental.')}</p>
        </div>
      </form>
    </div>
  );
}
