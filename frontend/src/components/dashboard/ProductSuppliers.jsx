import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';

/* "Supplied by" for each product of a store (Tzvi, 13 Oct 2026: drop
   shipping like Shopify). A product supplied by a connected partner goes to
   that partner as its own order when a customer orders it, and the partner
   delivers it (backend routes/marketplace/dropship.py). Only accepted
   partners can be chosen; the choice is saved at once, apart from the rest
   of the listing, and never shows on the public page.

   Products saved before they had ids cannot be pointed at yet: they are
   left out until the listing is next saved. */
export default function ProductSuppliers({ gig, API, token }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const he = (i18n.language || '').startsWith('he');

  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/gigs/${gig.id}/suppliers`, auth)
      .then(({ data: d }) => { if (live) setData(d); })
      .catch(() => { if (live) setData(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token, gig.id]);

  if (!data) return null;
  const products = (gig.products || []).filter((p) => p.id);
  if (!products.length) return null;

  const choose = async (productId, supplierId) => {
    setSaving(productId);
    try {
      const { data: d } = await axios.put(`${API}/marketplace/gigs/${gig.id}/suppliers`,
        { suppliers: { [productId]: supplierId || null } }, auth);
      setData({ ...data, suppliers: d.suppliers });
      toast.success(t('suppliers.saved', 'Saved'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('suppliers.failed', 'Could not save. Please try again.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="edit-listing-suppliers">
      <div className="flex items-start gap-2">
        <Truck size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('suppliers.title', 'Supplied by a partner')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
            {t('suppliers.hint', 'When a customer orders a product a partner supplies, the partner gets the order with the delivery details and delivers it. Your customer follows it on their tracking link and never sees the supplier.')}
          </p>
        </div>
      </div>

      {!data.partners.length ? (
        <p className="text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="suppliers-none">
          {t('suppliers.noPartners', 'Connect with a business first, in Network, to have it supply a product.')}{' '}
          <a href="/dashboard?tab=network" className="font-semibold underline" style={{ color: 'var(--brand-primary)' }}>
            {t('suppliers.openNetwork', 'Open Network')}
          </a>
        </p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={`sup-${p.id}`} className="text-sm min-w-0 flex-1 truncate" style={{ color: 'var(--ink)' }}>{p.name}</label>
              <select
                id={`sup-${p.id}`}
                value={data.suppliers[p.id] || ''}
                onChange={(e) => choose(p.id, e.target.value)}
                disabled={saving === p.id}
                className="min-h-[44px] rounded-lg border px-3 text-sm bg-white max-w-[60%]"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                data-testid={`supplier-${p.id}`}
              >
                <option value="">{t('suppliers.ourselves', 'We supply it ourselves')}</option>
                {data.partners.map((b) => (
                  <option key={b.id} value={b.id}>{(he && b.name_he) || b.name}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
