import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';

/* Send an order taken by phone, WhatsApp or typed in to a supplier the store
   is connected with (Tzvi, 13 Oct 2026). The supplier gets it with the
   customer's delivery details; when it delivers the whole order, the
   customer's tracking link follows the supplier (backend dropship.py). */
export default function SendToSupplierDialog({ API, token, businessId, order, onClose, onSent }) {
  const { t, i18n } = useTranslation();
  const [partners, setPartners] = useState(null);
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState(order.items || '');
  const [whole, setWhole] = useState(true);
  const [busy, setBusy] = useState(false);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const he = (i18n.language || '').startsWith('he');

  useEffect(() => {
    axios.get(`${API}/marketplace/businesses/${businessId}/connections?status=accepted`, auth)
      .then(({ data }) => {
        const list = (data.connections || []).filter((c) => c.other).map((c) => ({
          id: c.other_business_id, name: (he && c.other.name_he) || c.other.name || '',
        }));
        setPartners(list);
        if (list.length === 1) setSupplier(list[0].id);
      })
      .catch(() => setPartners([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token, businessId]);

  const send = async () => {
    if (!supplier || !items.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/orders/${order.id}/send-to-supplier`,
        { supplier_business_id: supplier, items: items.trim(), whole: whole && items.trim() === (order.items || '').trim() }, auth);
      toast.success(t('supply.sent', 'Sent to your supplier'));
      onSent?.(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('supply.failed', 'Could not send. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgb(17 24 39 / 0.45)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="supply-title" className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="send-to-supplier">
        <div className="flex items-center justify-between">
          <h3 id="supply-title" className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('supply.title', 'Send to a supplier')}</h3>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -me-3" aria-label={t('common.close', 'Close')}><X size={18} /></button>
        </div>
        {partners && !partners.length ? (
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
            {t('suppliers.noPartners', 'Connect with a business first, in Network, to have it supply a product.')}{' '}
            <a href="/dashboard?tab=network" className="font-semibold underline" style={{ color: 'var(--brand-primary)' }}>{t('suppliers.openNetwork', 'Open Network')}</a>
          </p>
        ) : (
          <>
            <label className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {t('supply.who', 'Supplier')}
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border px-3 text-sm bg-white font-normal" style={{ borderColor: 'var(--brand-border)' }} data-testid="supply-who">
                <option value="">{t('supply.choose', 'Choose')}</option>
                {(partners || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {t('supply.what', 'What they supply')}
              <textarea value={items} onChange={(e) => setItems(e.target.value)} rows={3} dir="auto" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" style={{ borderColor: 'var(--brand-border)' }} data-testid="supply-items" />
            </label>
            {items.trim() === (order.items || '').trim() && (
              <label className="flex items-start gap-2 text-sm min-h-[44px]" style={{ color: 'var(--ink)' }}>
                <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} className="mt-1" />
                <span>{t('supply.whole', 'They deliver the whole order, so your customer’s tracking link follows them')}</span>
              </label>
            )}
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              {order.fulfilment === 'delivery'
                ? t('supply.deliveryNote', 'They get the customer’s name, phone and address, and deliver it.')
                : t('supply.pickupNote', 'This is a pickup order: they prepare it for you to collect.')}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>{t('common.cancel', 'Cancel')}</button>
              <button type="button" onClick={send} disabled={busy || !supplier || !items.trim()} className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold disabled:opacity-60" data-testid="supply-send">
                {busy ? t('supply.sending', 'Sending') : t('supply.send', 'Send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
