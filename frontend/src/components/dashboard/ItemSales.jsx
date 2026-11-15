/**
 * Dashboard → Sales summary → Each item (backend insights.py item_sales;
 * Tzvi, 13 Nov 2026: "track each item what sells the most and what sells
 * the least ... add their costs per item so they can see their margin").
 *
 * Every product the business sells, for the period chosen above: how many
 * sold, in how many orders, what it brought in. The owner types what one
 * costs them; the margin and the profit over the period follow. Items that
 * sell little or leave little get a plain question, never an action: the
 * site removes nothing by itself. Each price stays in its own currency.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { money, symbolFor } from '../../utils/currency';
import { Section } from './BusinessInsights';

const SHOWN = 8;

// The same arithmetic as item_sales in insights.py, so a cost typed in shows its effect at once.
function withCost(r, cost, d) {
  const margin = cost != null && r.price ? Math.round((r.price - cost) * 100) / 100 : null;
  const flags = r.listed && r.qty <= d.slow_max ? ['slow'] : [];
  if (margin != null && margin < 0) flags.push('loss');
  else if (margin != null && (100 * margin) / r.price < d.thin_pct) flags.push('thin');
  return {
    ...r, cost, margin, flags,
    margin_pct: margin != null ? Math.round((1000 * margin) / r.price) / 10 : null,
    profit: cost != null ? Math.round((r.revenue - r.qty * cost) * 100) / 100 : null,
  };
}

function hint(r, d, t) {
  const m = r.margin != null ? money(Math.abs(r.margin), r.currency) : null;
  const vars = { name: r.name, n: r.qty, d: d.days, m, p: r.margin_pct };
  if (r.flags.includes('loss')) return t('items.hintLoss', 'You lose {{m}} on each one. Raise the price, or stop selling it?', vars);
  if (r.flags.includes('slow')) {
    if (r.qty === 0) return t('items.hintNone', 'No sales in {{d}} days. Worth keeping?', vars);
    return m ? t('items.hintSlowMargin', 'Sold {{n}} in {{d}} days, {{m}} profit each. Worth keeping?', vars)
      : t('items.hintSlow', 'Sold {{n}} in {{d}} days. Worth keeping?', vars);
  }
  if (r.flags.includes('thin')) return t('items.hintThin', 'Only {{m}} profit each ({{p}}%). Worth a higher price?', vars);
  return null;
}

function CostInput({ r, onSave, t }) {
  const [v, setV] = useState(r.cost ?? '');
  const [state, setState] = useState('');
  useEffect(() => { setV(r.cost ?? ''); }, [r.cost]);
  const save = async () => {
    const s = String(v).trim();
    const cost = s === '' ? null : Number(s);
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) { setState('bad'); return; }
    if (cost === (r.cost ?? null)) return;
    setState('saving');
    try { await onSave(r, cost); setState('saved'); } catch { setState('failed'); }
  };
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold min-w-0" style={{ color: 'var(--brand-muted)' }}>
      {t('items.cost', 'What one costs you')}
      <span className="flex items-center gap-1">
        <span aria-hidden="true" style={{ color: 'var(--ink)' }}>{symbolFor(r.currency).trim()}</span>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={v} placeholder={t('items.costPlaceholder', 'Add')}
          onChange={(e) => { setV(e.target.value); setState(''); }} onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="w-24 px-2 rounded-lg border bg-white min-h-[44px] tabular-nums" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)', fontSize: 16 }}
          aria-label={t('items.costFor', 'What one {{name}} costs you', { name: r.name })} data-testid="item-cost" />
        <span className="text-[11px] font-normal" role="status" style={{ color: state === 'failed' || state === 'bad' ? 'var(--error-text)' : 'var(--brand-muted)' }}>
          {state === 'saving' ? '…' : state === 'saved' ? t('items.saved', 'Saved') : state === 'failed' ? t('items.saveFailed', 'Not saved, try again') : state === 'bad' ? t('items.bad', 'A number, please') : ''}
        </span>
      </span>
    </label>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: tone || 'var(--ink)' }}><bdi dir="ltr">{value}</bdi></p>
    </div>
  );
}

export default function ItemSales({ API, auth, businessId, params, periodKey, t, lang }) {
  const [d, setD] = useState(null);
  const [order, setOrder] = useState('best');
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setD(null);
    axios.get(`${API}/marketplace/businesses/${businessId}/items`, { ...auth, params })
      .then(({ data }) => alive && setD(data)).catch(() => alive && setD(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, businessId, auth, periodKey]);

  if (d === null) return <Section title={t('items.title', 'Each item: what sells, what it leaves you')} testid="item-sales"><Loader2 className="animate-spin" size={16} /></Section>;
  if (d === false || !d.items.length) return null;

  const save = async (r, cost) => {
    await axios.put(`${API}/marketplace/businesses/${businessId}/items/cost`, { gig_id: r.gig_id, product_id: r.product_id, cost }, auth);
    setD((x) => ({ ...x, items: x.items.map((it) => (it.gig_id === r.gig_id && it.product_id === r.product_id ? withCost(it, cost, x) : it)) }));
  };
  const rows = order === 'best' ? d.items
    : [...d.items].sort((a, b) => (b.listed - a.listed) || (a.qty - b.qty) || (a.revenue - b.revenue));
  const shown = all ? rows : rows.slice(0, SHOWN);
  const flagged = d.items.filter((r) => r.flags.length);
  const anyCost = d.items.some((r) => r.cost != null);
  // A business with two shops can sell two things of one name: say which shop.
  const shop = (r) => (new Set(d.items.map((x) => x.gig_id)).size > 1 ? ((lang === 'he' && r.store_he) || r.store) : '');

  return (
    <Section title={t('items.title', 'Each item: what sells, what it leaves you')} testid="item-sales">
      {flagged.length > 0 && (
        <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: 'var(--surface-muted)', border: '1px solid var(--brand-border)' }} data-testid="item-hints">
          <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('items.lookTitle', 'Worth a look')}</p>
          <ul className="space-y-1" style={{ color: 'var(--ink)' }}>
            {flagged.slice(0, 5).map((r) => <li key={r.gig_id + r.product_id}><b>{r.name}</b>{shop(r) ? ` (${shop(r)})` : ''}: {hint(r, d, t)}</li>)}
          </ul>
          <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>{t('items.lookNote', 'Only a suggestion. Nothing is ever removed for you.')}</p>
        </div>
      )}
      {!anyCost && <p className="text-sm mb-3" style={{ color: 'var(--ink)' }}>{t('items.addCosts', 'Type what each item costs you to see your margin and profit.')}</p>}

      <div className="inline-flex rounded-full border p-0.5 mb-3" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('items.order', 'Order')}>
        {['best', 'slow'].map((k) => (
          <button key={k} type="button" onClick={() => setOrder(k)} aria-pressed={order === k} className="px-3 min-h-[44px] rounded-full text-xs font-semibold"
            style={order === k ? { background: 'var(--ink)', color: 'var(--action-ink, #fff)' } : { color: 'var(--brand-muted)' }} data-testid={`items-order-${k}`}>
            {k === 'best' ? t('items.best', 'Best sellers first') : t('items.slow', 'Slowest first')}
          </button>
        ))}
      </div>

      <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {shown.map((r) => {
          const h = hint(r, d, t);
          return (
            <li key={r.gig_id + r.product_id} className="py-3 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_200px] md:items-center" data-testid="item-row">
              <div className="min-w-0">
                <p className="text-sm font-bold break-words" style={{ color: 'var(--ink)' }}>{r.name}</p>
                {shop(r) && <p className="text-xs break-words" style={{ color: 'var(--brand-muted)' }}>{shop(r)}</p>}
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {r.listed ? (r.price ? t('items.price', 'Price {{p}}', { p: money(r.price, r.currency) }) : t('items.noPrice', 'Price on request')) : t('items.unlisted', 'No longer listed')}
                </p>
                {h && <p className="text-xs mt-1 font-semibold" style={{ color: r.flags.includes('loss') ? 'var(--error-text)' : 'var(--waiting)' }}>{h}</p>}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <Stat label={t('items.sold', 'Sold')} value={r.qty} />
                <Stat label={t('items.orders', 'Orders')} value={r.orders} />
                <Stat label={t('items.sales', 'Sales')} value={money(r.revenue, r.currency)} />
                <Stat label={t('items.margin', 'Margin each')}
                  value={r.margin == null ? '-' : `${r.margin < 0 ? '-' : ''}${money(Math.abs(r.margin), r.currency)} (${r.margin_pct}%)`}
                  tone={r.margin != null && r.margin < 0 ? 'var(--error-text)' : undefined} />
                <Stat label={t('items.profit', 'Profit')} value={r.profit == null ? '-' : `${r.profit < 0 ? '-' : ''}${money(Math.abs(r.profit), r.currency)}`}
                  tone={r.profit != null && r.profit < 0 ? 'var(--error-text)' : undefined} />
              </div>
              {r.listed && r.price ? <CostInput r={r} onSave={save} t={t} /> : <span />}
            </li>
          );
        })}
      </ul>
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 px-4 min-h-[44px] rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="items-all">
          {all ? t('items.fewer', 'Show fewer') : t('items.all', 'Show all {{n}} items', { n: rows.length })}
        </button>
      )}
      <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>{t('items.note', 'Profit is the sales minus what you paid for the items sold. Delivery and other costs are not included.')}</p>
    </Section>
  );
}
