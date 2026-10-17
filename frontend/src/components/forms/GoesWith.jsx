/**
 * "Add to your order" on the order form (backend pairings.py): up to two
 * products that go with what is already chosen, picked by the business or
 * learned from past orders. Never one already in the basket, never sold
 * out; one tap adds one (the first available choice, for a product with
 * sizes). Nothing shows until something is chosen.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Plus } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { money } from '../../utils/currency';

export default function GoesWith({ gigId, products, qty, onAdd, currency }) {
  const { t } = useTranslation();
  const [map, setMap] = useState({});
  useEffect(() => {
    axios.get(`${API}/marketplace/order-form/${gigId}/goes-with`).then(({ data }) => setMap(data || {})).catch(() => setMap({}));
  }, [gigId]);

  const picks = useMemo(() => {
    const chosen = new Set(Object.entries(qty).filter(([, n]) => n > 0).map(([k]) => k.split('::')[0]));
    if (!chosen.size) return [];
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    const out = [];
    for (const id of chosen) {
      const wanted = [...((byId[id] || {}).goes_with || []), ...(map[id] || [])];
      for (const w of wanted) {
        if (!chosen.has(w) && byId[w] && !out.includes(w)) out.push(w);
      }
    }
    return out.slice(0, 2).map((id) => byId[id]);
  }, [qty, products, map]);

  if (!picks.length) return null;
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="order-goes-with">
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--brand-muted)' }}>{t('goesWith.title', 'Goes well with your order')}</p>
      <div className={`grid gap-2 ${picks.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {picks.map((p) => {
          const opt = (p.options || []).find((o) => o.in_stock !== false);
          const key = opt ? `${p.id}::${opt.id}` : p.id;
          const price = opt && opt.price !== null && opt.price !== undefined ? opt.price : p.price;
          return (
            <button key={p.id} type="button" onClick={() => onAdd(key)} className="flex items-center gap-2 rounded-xl border p-2 text-start bg-white"
                    style={{ borderColor: 'var(--brand-border)' }} data-testid={`goes-with-${p.id}`}>
              {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" /> : null}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold line-clamp-2" dir="auto" style={{ color: 'var(--ink)' }}>{p.name}{opt ? ` (${opt.name})` : ''}</span>
                <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{money(price, p.currency || currency)}</span>
              </span>
              <span className="grid place-content-center w-8 h-8 rounded-full shrink-0" style={{ background: 'var(--ink)', color: 'var(--action-ink)' }} aria-label={t('goesWith.add', 'Add')}>
                <Plus size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
