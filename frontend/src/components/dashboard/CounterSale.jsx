/**
 * Record a walk-in sale at the counter (backend counter_sales.py).
 *
 * Built for a phone behind the counter: tap the products, pick how they
 * paid, record. The panel stays open for the next customer. The sale lands
 * on the orders board as done and paid, and counts in the sales summary,
 * stock and (only when a name or phone is given) the customer list.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Minus, Plus, Trash2, X } from 'lucide-react';
import { money } from '../../utils/currency';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';
const METHODS = ['cash', 'card', 'bit', 'other'];

export default function CounterSale({ API, auth, businessId, onSaved, onClose }) {
  const { t, i18n } = useTranslation();
  const he = (i18n.language || '').startsWith('he');
  const [stores, setStores] = useState(null);
  const [storeId, setStoreId] = useState('');
  const [cart, setCart] = useState([]); // {key, product_id?, option_id?, name, price, qty}
  const [choosing, setChoosing] = useState(null); // product with options being chosen
  const [other, setOther] = useState({ name: '', price: '' });
  const [method, setMethod] = useState('');
  const [customer, setCustomer] = useState({ open: false, name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const payRef = useRef(null);

  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/businesses/${businessId}/counter`, auth)
      .then(({ data }) => {
        if (!live) return;
        setStores(data.stores || []);
        setStoreId((data.stores || [])[0]?.id || '');
      })
      .catch(() => live && setStores([]));
    return () => { live = false; };
  }, [API, auth, businessId]);

  const store = (stores || []).find((s) => s.id === storeId);
  const currency = store?.products?.[0]?.currency || 'ILS';
  const total = useMemo(() => cart.reduce((a, l) => a + l.price * l.qty, 0), [cart]);

  const add = (line) => setCart((c) => {
    const i = c.findIndex((x) => x.key === line.key);
    if (i === -1) return [...c, { ...line, qty: 1 }];
    return c.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x));
  });
  const bump = (key, d) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const pick = (p, opt) => {
    add({
      key: `${p.id}::${opt?.id || ''}`, product_id: p.id, option_id: opt?.id || null,
      name: opt ? `${p.name} (${opt.name})` : p.name,
      price: Number(opt?.price ?? p.price) || 0,
    });
    setChoosing(null);
  };

  const addOther = () => {
    const price = Number(String(other.price).replace(',', '.'));
    if (!other.name.trim() || !(price >= 0) || other.price === '') return;
    add({ key: `other::${other.name.trim()}::${price}`, name: other.name.trim(), price });
    setOther({ name: '', price: '' });
  };

  const record = async () => {
    if (!cart.length || !method || saving) return;
    setSaving(true);
    try {
      await axios.post(`${API}/marketplace/businesses/${businessId}/counter-sales`, {
        gig_id: cart.some((l) => l.product_id) ? storeId : null,
        lines: cart.map((l) => (l.product_id
          ? { product_id: l.product_id, option_id: l.option_id, qty: l.qty }
          : { name: l.name, price: l.price, qty: l.qty })),
        method,
        customer_name: customer.name,
        customer_phone: customer.phone,
      }, auth);
      toast.success(t('counter.recorded', 'Sale recorded: {{total}}', { total: money(total, currency) }));
      setCart([]); setMethod(''); setCustomer({ open: false, name: '', phone: '' });
      onSaved?.();
      // Stock may have changed.
      axios.get(`${API}/marketplace/businesses/${businessId}/counter`, auth).then(({ data }) => setStores(data.stores || [])).catch(() => {});
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('counter.failed', 'The sale was not recorded. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const chip = (active) => (active
    ? { background: 'var(--ink)', color: '#FFFFFF', borderColor: 'var(--ink)' }
    : { background: '#FFFFFF', color: 'var(--ink)', borderColor: BORDER });

  return (
    <section className="mb-5 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: BORDER }} data-testid="counter-sale">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{t('counter.title', 'Sale at the counter')}</h3>
        <button type="button" onClick={onClose} className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full" aria-label={t('orders.close', 'Close')} style={{ color: MUTED }}>
          <X size={18} />
        </button>
      </div>

      {stores === null ? (
        <div className="py-6 text-center" style={{ color: MUTED }}><Loader2 className="animate-spin inline" size={18} /></div>
      ) : (
        <>
          {stores.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {stores.map((s) => (
                <button key={s.id} type="button" onClick={() => { setStoreId(s.id); setChoosing(null); }}
                  className="min-h-[36px] px-3 rounded-full border text-[13px] font-semibold" style={chip(s.id === storeId)}>
                  {(he && s.title_he) || s.title}
                </button>
              ))}
            </div>
          )}

          {store && store.products.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2" data-testid="counter-products">
              {store.products.map((p) => {
                const out = p.stock === 0 || p.in_stock === false;
                return (
                  <button key={p.id} type="button" disabled={out}
                    onClick={() => (p.options?.length ? setChoosing(choosing?.id === p.id ? null : p) : pick(p))}
                    className="text-start rounded-xl border p-3 min-h-[64px] disabled:opacity-40"
                    style={{ borderColor: choosing?.id === p.id ? 'var(--ink)' : BORDER }}>
                    <span dir="auto" className="block text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{p.name}</span>
                    <span className="block mt-0.5 text-[13px] tabular-nums" style={{ color: MUTED }}>
                      {p.price != null ? money(Number(p.price), p.currency) : ''}
                      {p.stock != null ? ` · ${t('counter.left', '{{n}} left', { n: p.stock })}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {choosing && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="counter-options">
              {choosing.options.filter((o) => o.in_stock !== false).map((o) => (
                <button key={o.id} type="button" onClick={() => pick(choosing, o)} className="min-h-[40px] px-3 rounded-full border text-[13px] font-semibold" style={chip(false)}>
                  {o.name}{o.price != null ? ` ${money(Number(o.price), choosing.currency)}` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Anything not on the list */}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[140px] text-[13px]" style={{ color: MUTED }}>
              {t('counter.otherItem', 'Another item')}
              <input dir="auto" value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 min-h-[40px] text-sm" style={{ borderColor: BORDER, color: 'var(--ink)' }} />
            </label>
            <label className="w-[110px] text-[13px]" style={{ color: MUTED }}>
              {t('counter.price', 'Price')}
              <input inputMode="decimal" value={other.price} onChange={(e) => setOther({ ...other, price: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 min-h-[40px] text-sm tabular-nums" style={{ borderColor: BORDER, color: 'var(--ink)' }} />
            </label>
            <button type="button" onClick={addOther} className="min-h-[40px] px-4 rounded-full border text-sm font-semibold inline-flex items-center gap-1" style={chip(false)}>
              <Plus size={14} /> {t('counter.add', 'Add')}
            </button>
          </div>

          {/* The sale */}
          {cart.length > 0 && (
            <ul className="mt-4 divide-y rounded-xl border" style={{ borderColor: BORDER }} data-testid="counter-cart">
              {cart.map((l) => (
                <li key={l.key} className="flex items-center gap-2 px-3 py-2">
                  <span dir="auto" className="flex-1 min-w-0 text-sm" style={{ color: 'var(--ink)' }}>{l.name}</span>
                  <button type="button" onClick={() => bump(l.key, -1)} className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border" style={{ borderColor: BORDER }} aria-label={t('counter.less', 'One less')}>
                    {l.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                  <button type="button" onClick={() => bump(l.key, 1)} className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border" style={{ borderColor: BORDER }} aria-label={t('counter.more', 'One more')}>
                    <Plus size={14} />
                  </button>
                  <span className="w-20 text-end text-sm tabular-nums" style={{ color: 'var(--ink)' }}>{money(l.price * l.qty, currency)}</span>
                </li>
              ))}
            </ul>
          )}

          <p ref={payRef} className="mt-4 text-sm font-semibold scroll-mt-24" style={{ color: 'var(--ink)' }}>{t('counter.paidBy', 'How did they pay?')}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('counter.paidBy', 'How did they pay?')}>
            {METHODS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                className="min-h-[44px] px-4 rounded-full border text-sm font-semibold" style={chip(method === m)}>
                {t(`orders.pay.${m}`, m)}
              </button>
            ))}
          </div>

          {customer.open ? (
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              <input dir="auto" placeholder={t('counter.customerName', 'Customer name (optional)')} value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="rounded-lg border px-3 min-h-[40px] text-sm" style={{ borderColor: BORDER, color: 'var(--ink)' }} />
              <input inputMode="tel" placeholder={t('counter.customerPhone', 'Phone (optional)')} value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="rounded-lg border px-3 min-h-[40px] text-sm" style={{ borderColor: BORDER, color: 'var(--ink)' }} />
            </div>
          ) : (
            <button type="button" onClick={() => setCustomer({ ...customer, open: true })} className="mt-3 text-[13px] underline underline-offset-4 min-h-[36px]" style={{ color: 'var(--gold)' }}>
              {t('counter.addCustomer', 'Add the customer (optional)')}
            </button>
          )}

          <button type="button" onClick={record} disabled={!cart.length || !method || saving}
            className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 min-h-[48px] rounded-full text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="counter-record">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t('counter.record', 'Record sale {{total}}', { total: money(total, currency) })}
          </button>
          {!method && cart.length > 0 && (
            <p className="mt-2 text-[13px]" style={{ color: MUTED }}>{t('counter.pickMethod', 'Choose how they paid to record the sale.')}</p>
          )}

          {/* On a phone the list is long: the total stays in reach and one
              tap goes to paying. Not shown on wider screens, where it all fits. */}
          {cart.length > 0 && (
            <div className="sm:hidden sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-full px-4 py-2 shadow-lg"
              style={{ background: 'var(--ink)', color: '#FFFFFF' }} data-testid="counter-bar">
              <span className="text-sm font-semibold tabular-nums">
                {t('counter.items', '{{count}} items', { count: cart.reduce((a, l) => a + l.qty, 0) })} · {money(total, currency)}
              </span>
              <button type="button" onClick={() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="min-h-[40px] px-4 rounded-full text-sm font-bold" style={{ background: '#FFFFFF', color: 'var(--ink)' }}>
                {t('counter.toPay', 'Pay')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
