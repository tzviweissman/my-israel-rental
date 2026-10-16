/**
 * Orders → who is waiting for sold-out products (backend restock.py).
 * Shown only when someone is: the most wanted first, so the business
 * knows what to make or reorder. They are emailed by themselves once
 * the product is on sale again.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Bell } from 'lucide-react';

export default function RestockWaiting({ API, auth, businessId }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    axios.get(`${API}/marketplace/businesses/${businessId}/restock-waits`, auth).then(({ data }) => setRows(data || [])).catch(() => setRows([]));
  }, [API, auth, businessId]);
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border bg-white p-3 mb-4 text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="restock-waiting">
      <p className="font-semibold inline-flex items-center gap-2"><Bell size={15} aria-hidden="true" /> {t('restockBiz.title', 'Waiting for sold-out products')}</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {rows.slice(0, 8).map((r) => (
          <li key={`${r.gig_id}:${r.product_id}`} className="px-2.5 py-1 rounded-full text-xs" style={{ background: '#F9FAFB' }} dir="auto">
            {r.name} · <b className="tabular-nums">{r.count}</b>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-1.5" style={{ color: 'var(--brand-muted)' }}>{t('restockBiz.hint', 'Put one back on sale and everyone waiting for it gets one email to order it.')}</p>
    </section>
  );
}
