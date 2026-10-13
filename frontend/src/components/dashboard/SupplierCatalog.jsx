import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Check } from 'lucide-react';
import { money } from '../../utils/currency';

/* What a store's partners offer it (Tzvi, 13 Oct 2026: the supplier
   catalogue). Add a product in one step at your own price: name, photos and
   description come from the supplier, the supplier delivers each order, and
   its stock is your stock (backend dropship.py). */
export default function SupplierCatalog({ API, token, gig, onClose, onAdded }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [price, setPrice] = useState({});
  const [busy, setBusy] = useState(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const he = (i18n.language || '').startsWith('he');
  const key = (i) => `${i.gig_id}:${i.product_id}`;

  useEffect(() => {
    axios.get(`${API}/marketplace/businesses/${gig.business_id}/supplier-catalog`, auth)
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token, gig.business_id]);

  const add = async (i) => {
    const p = parseFloat(price[key(i)]);
    if (!(p >= 0)) { toast.error(t('catalog.needPrice', 'Enter your price')); return; }
    setBusy(key(i));
    try {
      await axios.post(`${API}/marketplace/gigs/${gig.id}/add-from-supplier`, { source_gig_id: i.gig_id, product_id: i.product_id, price: p }, auth);
      setItems(items.map((x) => (key(x) === key(i) ? { ...x, added: true } : x)));
      toast.success(t('catalog.added', 'Added to your store'));
      onAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('catalog.failed', 'Could not add it. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgb(17 24 39 / 0.45)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="catalog-title" className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()} data-testid="supplier-catalog">
        <div className="flex items-center justify-between gap-3">
          <h3 id="catalog-title" className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('catalog.title', 'Add from a supplier')}</h3>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -me-3" aria-label={t('common.close', 'Close')}><X size={18} /></button>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>
          {t('catalog.hint', 'Products your partners offer you. Set your price and add it: the supplier delivers each order to your customer, and when they run out it shows as sold out in your store too.')}
        </p>

        {items === null && <p className="text-sm mt-4" style={{ color: 'var(--brand-muted)' }}>{t('catalog.loading', 'Loading')}</p>}
        {items && !items.length && (
          <p className="text-sm mt-4" style={{ color: 'var(--brand-muted)' }} data-testid="catalog-empty">
            {t('catalog.empty', 'None of your partners offers products yet. A supplier offers them from its own listing, under "Offer to partner stores".')}{' '}
            <a href="/dashboard?tab=network" className="font-semibold underline" style={{ color: 'var(--brand-primary)' }}>{t('suppliers.openNetwork', 'Open Network')}</a>
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {(items || []).map((i) => (
            <li key={key(i)} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="catalog-item">
              {i.images[0]
                ? <img src={i.images[0]} alt="" width="72" height="72" className="w-[72px] h-[72px] rounded-lg object-cover shrink-0" loading="lazy" />
                : <div className="w-[72px] h-[72px] rounded-lg shrink-0" style={{ background: 'var(--surface-muted)' }} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{i.name}</p>
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {(he && i.supplier.name_he) || i.supplier.name}
                  {' · '}{t('catalog.youPay', { defaultValue: 'you pay {{price}}', price: money(i.wholesale_price, i.currency) })}
                  {!i.in_stock && <>{' · '}{t('catalog.soldOut', 'sold out now')}</>}
                </p>
                {i.description && <p className="text-xs mt-1 line-clamp-2" dir="auto" style={{ color: 'var(--brand-muted)' }}>{i.description}</p>}
                {i.added ? (
                  <p className="text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: 'var(--ink)' }}><Check size={14} aria-hidden="true" /> {t('catalog.inStore', 'In your store')}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <label className="sr-only" htmlFor={`cat-${key(i)}`}>{t('catalog.yourPrice', 'Your price')}</label>
                    <input id={`cat-${key(i)}`} type="number" min="0" step="0.5" inputMode="decimal"
                      placeholder={i.retail_price != null ? String(i.retail_price) : t('catalog.yourPrice', 'Your price')}
                      value={price[key(i)] ?? ''} onChange={(e) => setPrice({ ...price, [key(i)]: e.target.value })}
                      className="w-28 min-h-[44px] rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
                    <button type="button" onClick={() => add(i)} disabled={busy === key(i)} className="btn-primary min-h-[44px] px-4 rounded-full text-sm font-semibold disabled:opacity-60" data-testid="catalog-add">
                      {t('catalog.add', 'Add to my store')}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
