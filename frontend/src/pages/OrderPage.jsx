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
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Store as StoreIcon, Bike, Check, ExternalLink, ArrowLeft } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import { phoneError } from '../utils/phoneValidation';
import { pastCutoff } from '../components/dashboard/OrdersTab';

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
  const [fulfilment, setFulfilment] = useState('pickup');
  const [date, setDate] = useState('');
  const [windowKey, setWindowKey] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.whatsapp_number || user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
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

  // The next 14 days, minus days past their cutoff. The store's day is
  // Israel's; the browser's clock is close enough for a picker.
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

  const windowsForDay = useMemo(() => {
    if (!data || !date) return [];
    const dow = new Date(`${date}T00:00`).getDay();
    const list = fulfilment === 'delivery' ? data.settings.delivery_windows : data.settings.pickup_windows;
    return (list || []).filter((w) => w.weekday === dow);
  }, [data, date, fulfilment]);

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
  const products = data.products.filter((p) => p.in_stock);
  const lines = products.filter((p) => (qty[p.id] || 0) > 0).map((p) => ({ product: p, qty: qty[p.id] }));
  const subtotal = lines.reduce((s, l) => s + Number(l.product.price || 0) * l.qty, 0);
  const fee = fulfilment === 'delivery' ? Number(data.settings.delivery_fee || 0) : 0;
  const total = lines.length ? subtotal + fee : null;
  const minOrder = Number(data.settings.min_order || 0);
  const belowMin = fulfilment === 'delivery' && minOrder > 0 && subtotal < minOrder;
  const deliveryPossible = data.business.serves_nationwide || data.business.areas.length > 0;
  const phoneErr = phoneError(phone, t);
  const dayInfo = days.find((d) => d.key === date);
  const canSubmit = (lines.length > 0 || extra.trim()) && date && dayInfo && !dayInfo.closed
    && (windowsForDay.length === 0 || windowKey)
    && name.trim() && phone.trim() && !phoneErr
    && (fulfilment === 'pickup' || (address.trim() && (data.business.serves_nationwide || city) && !belowMin));

  const setQ = (id, n) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, n)) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const w = windowsForDay.find((x) => `${x.start}-${x.end}` === windowKey);
      const body = {
        lines: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        extra_items: extra.trim(), notes: notes.trim(), fulfilment, date,
        window: w ? { weekday: w.weekday, start: w.start, end: w.end } : null,
        city: fulfilment === 'delivery' ? (city || null) : null,
        address: fulfilment === 'delivery' ? address.trim() : null,
        customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim() || null,
      };
      const { data: res } = await axios.post(`${API}/marketplace/order-form/${gigId}/orders`, body, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
      setDone(res);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const fmtDay = (d) => new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
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
          {done.total != null && <p className="text-sm mt-4" style={{ color: 'var(--ink)' }}>{t('order.totalDue', 'Total: ₪{{n}}', { n: Number(done.total).toLocaleString() })}</p>}
          <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
            {t('order.payNote', 'Payment goes to the store directly, not through MyIsraelRental.')}
            {data.business.payment_note ? ` ${data.business.payment_note}` : ''}
          </p>
          {(data.business.payment_links || []).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {data.business.payment_links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 min-h-[36px] inline-flex items-center rounded-full border text-xs font-semibold" style={inputStyle}>{l.label || l.url}</a>)}
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

      <form onSubmit={submit} className="space-y-5">
        {/* 1. What */}
        <section className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>{t('order.what', 'What would you like?')}</h2>
          {products.length === 0 && <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('order.noProducts', 'This store has not listed products yet - write what you want below.')}</p>}
          <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {products.map((p) => (
              <li key={p.id} className="py-2 flex items-center gap-3" data-testid={`order-product-${p.id}`}>
                {p.image && <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--brand-muted)' }}>{p.currency === 'USD' ? '$' : '₪'}{Number(p.price).toLocaleString()}{p.description ? ` · ${p.description}` : ''}</div>
                </div>
                <div className="inline-flex items-center rounded-full border" style={{ borderColor: 'var(--brand-border)' }}>
                  <button type="button" onClick={() => setQ(p.id, (qty[p.id] || 0) - 1)} className="w-10 h-10 grid place-content-center rounded-full" aria-label={t('order.less', 'Less')} style={{ color: 'var(--ink)' }}><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }} data-testid={`order-qty-${p.id}`}>{qty[p.id] || 0}</span>
                  <button type="button" onClick={() => setQ(p.id, (qty[p.id] || 0) + 1)} className="w-10 h-10 grid place-content-center rounded-full" aria-label={t('order.more', 'More')} style={{ color: 'var(--ink)' }} data-testid={`order-add-${p.id}`}><Plus size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
          <input value={extra} onChange={(e) => setExtra(e.target.value)} dir="auto" placeholder={t('order.extraPh', 'Anything else? e.g. 1 gluten-free challah')} className={`${input} mt-2`} style={inputStyle} data-testid="order-extra" />
        </section>

        {/* 2. How */}
        <section className="rounded-2xl border bg-white p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }}>
          <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ background: 'var(--surface-muted)' }} role="radiogroup">
            {[['pickup', StoreIcon, t('orders.pickup', 'Pickup')], ['delivery', Bike, t('orders.delivery', 'Delivery')]].map(([v, Icon, lbl]) => (
              <button key={v} type="button" role="radio" aria-checked={fulfilment === v} disabled={v === 'delivery' && !deliveryPossible} onClick={() => setFulfilment(v)} className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-md text-sm font-semibold disabled:opacity-40" style={fulfilment === v ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--ink)' }} data-testid={`order-fulfilment-${v}`}>
                <Icon size={14} /> {lbl}{v === 'delivery' && fee > 0 ? ` · ₪${fee}` : ''}
              </button>
            ))}
          </div>
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
              {minOrder > 0 && (
                <p className="text-xs" style={{ color: belowMin ? 'var(--ink)' : 'var(--brand-muted)' }} data-testid="order-min">
                  {t('order.minOrder', 'Delivery from ₪{{n}}', { n: minOrder })}{belowMin ? ` · ${t('order.belowMin', 'add a little more, or choose pickup')}` : ''}
                </p>
              )}
            </div>
          )}

          <div>
            <span className={label} style={labelStyle}>{t('order.when', 'When?')}</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" data-testid="order-days">
              {days.map((d) => (
                <button key={d.key} type="button" role="radio" aria-checked={date === d.key} disabled={d.closed} onClick={() => setDate(d.key)} className="shrink-0 px-3 min-h-[44px] rounded-full text-xs font-semibold border disabled:opacity-35 disabled:line-through" style={date === d.key ? { background: 'var(--ink)', color: 'var(--action-ink)', borderColor: 'var(--ink)' } : inputStyle} data-testid={`order-day-${d.key}`} title={d.closed ? t('order.closed', 'Orders for this day have closed') : undefined}>
                  {fmtDay(d.date)}
                </button>
              ))}
            </div>
            {windowsForDay.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2" role="radiogroup" data-testid="order-windows">
                {windowsForDay.map((w) => {
                  const k = `${w.start}-${w.end}`;
                  return (
                    <button key={k} type="button" role="radio" aria-checked={windowKey === k} onClick={() => setWindowKey(k)} className="px-3 min-h-[40px] rounded-full text-xs font-semibold border tabular-nums" style={windowKey === k ? { background: 'var(--ink)', color: 'var(--action-ink)', borderColor: 'var(--ink)' } : inputStyle}>
                      {w.start}–{w.end}
                    </button>
                  );
                })}
              </div>
            )}
            {date && windowsForDay.length === 0 && <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{t('order.noWindows', 'The store will confirm the time with you.')}</p>}
          </div>
        </section>

        {/* 3. Who */}
        <section className="rounded-2xl border bg-white p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }}>
          <div>
            <label className={label} style={labelStyle} htmlFor="order-name">{t('order.name', 'Your name')}</label>
            <input id="order-name" value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={input} style={inputStyle} required data-testid="order-name" />
          </div>
          <div>
            <label className={label} style={labelStyle} htmlFor="order-phone">{t('order.phone', 'Mobile')}</label>
            <input id="order-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} style={{ ...inputStyle, borderColor: phoneErr ? 'var(--ink)' : 'var(--brand-border)' }} placeholder="050-123-4567" required data-testid="order-phone" />
            {phoneErr && <p className="text-[11px] mt-1" style={{ color: 'var(--ink)' }}>{phoneErr}</p>}
            {fulfilment === 'delivery' && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.phoneNotice', 'The delivery person will see your number to reach you.')}</p>}
          </div>
          <div>
            <label className={label} style={labelStyle} htmlFor="order-email">{t('order.email', 'Email')} · {t('orders.optional', 'optional')}</label>
            <input id="order-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} style={inputStyle} placeholder="name@example.com" data-testid="order-email" />
            <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('order.emailWhy', 'For the confirmation, and the delivery photo when it arrives.')}</p>
          </div>
          <div>
            <label className={label} style={labelStyle} htmlFor="order-notes">{t('orders.notes', 'Notes')} · {t('orders.optional', 'optional')}</label>
            <input id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" className={input} style={inputStyle} placeholder={t('orders.notesPh', '"No nuts", "leave with the neighbour"')} data-testid="order-notes" />
          </div>
          {!user && (
            <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {t('order.signInHint', 'Have an account?')} <Link to={`/auth/login?redirect=${encodeURIComponent(`/order/${gigId}`)}`} className="underline" style={{ color: 'var(--ink)' }}>{t('order.signIn', 'Sign in')}</Link> {t('order.signInWhy', 'to fill this in and keep your orders in one place.')}
            </p>
          )}
        </section>

        {/* 4. Total + send */}
        <div className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }}>
          {lines.length > 0 && (
            <ul className="text-sm mb-2" style={{ color: 'var(--ink)' }} data-testid="order-summary">
              {lines.map((l) => <li key={l.product.id} className="flex justify-between"><span dir="auto">{l.qty} × {l.product.name}</span><span className="tabular-nums">₪{(Number(l.product.price) * l.qty).toLocaleString()}</span></li>)}
              {fee > 0 && <li className="flex justify-between"><span>{t('order.deliveryFee', 'Delivery')}</span><span className="tabular-nums">₪{fee.toLocaleString()}</span></li>}
              <li className="flex justify-between font-bold border-t mt-1 pt-1" style={{ borderColor: 'var(--brand-border)' }}><span>{t('order.total', 'Total')}</span><span className="tabular-nums" data-testid="order-total">₪{Number(total).toLocaleString()}</span></li>
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
