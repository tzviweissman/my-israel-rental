/**
 * One product's stock count and its sizes/flavours (backend shared.py
 * ProductItem.stock / options, stock.py). Folded behind one link so the
 * product row stays as short as it was for the many businesses that use
 * neither; opens by itself when the product already has either.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const box = 'px-3 py-2 rounded-lg border bg-white text-sm';
const boxStyle = { borderColor: 'var(--brand-border)' };

/** Tidy for saving: numbers as numbers, empty rows dropped. */
export function cleanExtras(o) {
  const stock = o.stock === '' || o.stock === null || o.stock === undefined ? null : Math.max(0, parseInt(o.stock, 10) || 0);
  const low = o.low_stock_at === '' || o.low_stock_at === null || o.low_stock_at === undefined ? null : Math.max(1, parseInt(o.low_stock_at, 10) || 1);
  const options = (o.options || [])
    .map((x) => {
      const p = x.price === '' || x.price === null || x.price === undefined ? null : parseFloat(x.price);
      return { ...(x.id ? { id: x.id } : {}), name: String(x.name || '').trim().slice(0, 40), price: Number.isFinite(p) ? p : null, in_stock: x.in_stock !== false };
    })
    .filter((x) => x.name);
  const goesWith = (o.goes_with || []).filter(Boolean).slice(0, 4);
  return { stock, low_stock_at: stock === null ? null : low, options, goes_with: goesWith };
}

export default function ProductExtras({ option: o, onChange, i, others = [] }) {
  const { t } = useTranslation();
  const has = (o.stock !== null && o.stock !== undefined && o.stock !== '') || (o.options || []).length > 0 || (o.goes_with || []).length > 0;
  const [open, setOpen] = useState(has);
  const opts = o.options || [];
  const setOpt = (k, patch) => onChange({ options: opts.map((x, j) => (j === k ? { ...x, ...patch } : x)) });

  return (
    <div className="text-sm" data-testid={`product-extras-${i}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
              className="inline-flex items-center gap-1 min-h-[44px] font-semibold text-gray-700" data-testid={`product-extras-toggle-${i}`}>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {t('editListing.extrasPairs', 'Stock count, sizes, and what goes with it')}
      </button>
      {open && (
        <div className="space-y-3 rounded-lg p-3" style={{ background: '#F9FAFB' }}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2">
              {t('editListing.stock', 'How many you have')}
              <input type="number" min="0" inputMode="numeric" value={o.stock ?? ''} className={`${box} w-24`} style={boxStyle}
                     onChange={(e) => onChange({ stock: e.target.value, ...(Number(e.target.value) > 0 ? { in_stock: true } : {}) })}
                     placeholder={t('editListing.stockPh', 'Not counted')} data-testid={`product-stock-${i}`} />
            </label>
            {o.stock !== null && o.stock !== undefined && o.stock !== '' && (
              <label className="inline-flex items-center gap-2">
                {t('editListing.lowAt', 'Email me when it falls to')}
                <input type="number" min="1" inputMode="numeric" value={o.low_stock_at ?? ''} className={`${box} w-20`} style={boxStyle}
                       onChange={(e) => onChange({ low_stock_at: e.target.value })} data-testid={`product-low-${i}`} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-600">{t('editListing.stockHelp', 'Orders on your page take from the count. At 0 it shows as sold out. Leave empty if you do not count.')}</p>

          <div>
            <p className="font-semibold text-gray-700">{t('editListing.choices', 'Sizes, flavours or colours')}</p>
            <p className="text-xs text-gray-600 mb-2">{t('editListing.choicesHelp', 'The customer picks one. Leave the price empty to use the product price.')}</p>
            <ul className="space-y-2">
              {opts.map((x, k) => (
                <li key={x.id || k} className="flex flex-wrap items-center gap-2">
                  <input value={x.name || ''} maxLength={40} onChange={(e) => setOpt(k, { name: e.target.value })} dir="auto"
                         placeholder={t('editListing.choicePh', 'e.g. Large')} className={`${box} flex-1 min-w-[8rem]`} style={boxStyle} data-testid={`product-choice-${i}-${k}`} />
                  <input type="number" min="0" value={x.price ?? ''} onChange={(e) => setOpt(k, { price: e.target.value })}
                         placeholder={t('editListing.choicePrice', 'Price')} className={`${box} w-24`} style={boxStyle} aria-label={t('editListing.choicePrice', 'Price')} />
                  <label className="inline-flex items-center gap-1 min-h-[44px]">
                    <input type="checkbox" checked={x.in_stock !== false} onChange={(e) => setOpt(k, { in_stock: e.target.checked })} /> {t('editListing.inStock', 'In stock')}
                  </label>
                  <button type="button" onClick={() => onChange({ options: opts.filter((_, j) => j !== k) })} className="grid place-content-center w-11 h-11 text-red-700"
                          aria-label={t('editListing.removeChoice', 'Remove this choice')}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {opts.length < 20 && (
              <button type="button" onClick={() => onChange({ options: [...opts, { name: '', price: '', in_stock: true }] })}
                      className="inline-flex items-center gap-1 min-h-[44px] font-semibold" style={{ color: 'var(--ink)' }} data-testid={`product-add-choice-${i}`}>
                <Plus size={14} /> {t('editListing.addChoice', 'Add a choice')}
              </button>
            )}
          </div>
          {/* "Add to your order" on the order form (backend pairings.py). */}
          {others.length > 0 && (
            <div data-testid={`product-goes-with-${i}`}>
              <p className="font-semibold text-gray-700">{t('editListing.goesWith', 'Goes well with')}</p>
              <p className="text-xs text-gray-600 mb-2">{t('editListing.goesWithHelp', 'Customers who choose this see up to two of these as "add to your order". Without a choice, it learns from what people order together.')}</p>
              <div className="flex flex-wrap gap-2">
                {others.map((x) => {
                  const on = (o.goes_with || []).includes(x.id);
                  const full = !on && (o.goes_with || []).length >= 4;
                  return (
                    <button key={x.id} type="button" disabled={full} aria-pressed={on}
                            onClick={() => onChange({ goes_with: on ? (o.goes_with || []).filter((y) => y !== x.id) : [...(o.goes_with || []), x.id] })}
                            className="px-3 min-h-[36px] rounded-full border text-xs font-semibold disabled:opacity-40" dir="auto"
                            style={on ? { background: 'var(--ink)', color: 'var(--action-ink)', borderColor: 'var(--ink)' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)', background: '#fff' }}>
                      {x.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
