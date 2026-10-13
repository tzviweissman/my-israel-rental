import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';

/* A supplier offers its products to connected partner stores at a
   wholesale price (Tzvi, 13 Oct 2026: the supplier catalogue). Partners add
   them to their own store in one step and sell at their own price; this
   business delivers. Saved per product, apart from the listing, and never
   shown on the public page (backend dropship.py). */
export default function WholesaleOffers({ gig, API, token }) {
  const { t } = useTranslation();
  const [offers, setOffers] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/gigs/${gig.id}/wholesale`, auth)
      .then(({ data }) => { if (live) { setOffers(data.offers || {}); setDraft(Object.fromEntries(Object.entries(data.offers || {}).map(([k, v]) => [k, String(v)]))); } })
      .catch(() => { if (live) setOffers(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token, gig.id]);

  if (!offers) return null;
  const products = (gig.products || []).filter((p) => p.id);
  if (!products.length) return null;

  const save = async (pid, on) => {
    const raw = draft[pid];
    const price = on ? parseFloat(raw) : null;
    if (on && !(price >= 0)) { toast.error(t('wholesale.needPrice', 'Enter the price you charge partners')); return; }
    setSaving(pid);
    try {
      const { data } = await axios.put(`${API}/marketplace/gigs/${gig.id}/wholesale`, { offers: { [pid]: price } }, auth);
      setOffers(data.offers || {});
      toast.success(on ? t('wholesale.on', 'Offered to your partners') : t('wholesale.off', 'No longer offered'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('suppliers.failed', 'Could not save. Please try again.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-wholesale">
      <div className="flex items-start gap-2">
        <Tags size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('wholesale.title', 'Offer to partner stores')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
            {t('wholesale.hint', 'Businesses you are connected with can add these products to their own store and sell them at their price. You get the order and deliver it, and they pay you this price. Only your partners see it.')}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {products.map((p) => {
          const on = offers[p.id] != null;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="text-sm min-w-0 flex-1 truncate" style={{ color: 'var(--ink)' }}>{p.name}</span>
              <label className="sr-only" htmlFor={`ws-${p.id}`}>{t('wholesale.priceFor', { defaultValue: 'Partner price for {{name}}', name: p.name })}</label>
              <input id={`ws-${p.id}`} type="number" min="0" step="0.5" inputMode="decimal" value={draft[p.id] ?? ''}
                placeholder={t('wholesale.pricePh', 'Partner price')}
                onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value })}
                className="w-28 min-h-[44px] rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--brand-border)' }} data-testid={`wholesale-price-${p.id}`} />
              <button type="button" disabled={saving === p.id} onClick={() => save(p.id, true)}
                className="min-h-[44px] px-3 rounded-full border text-xs font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`wholesale-save-${p.id}`}>
                {on ? t('wholesale.update', 'Update') : t('wholesale.offer', 'Offer')}
              </button>
              {on && (
                <button type="button" disabled={saving === p.id} onClick={() => save(p.id, false)}
                  className="min-h-[44px] px-3 text-xs font-semibold underline" style={{ color: 'var(--brand-muted)' }}>
                  {t('wholesale.stop', 'Stop offering')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
