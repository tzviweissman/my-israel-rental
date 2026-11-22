/**
 * "Free delivery with FREESHIP" across the top of a business's order page and store listing (Tzvi, 22 Nov 2026: the
 * announcement bar Shopify shops and the food sites in our inspo use). Only for a free-delivery code the business
 * ticked "Show it on my page", live today, and only when it delivers (backend discounts.py page_promo). Nothing else
 * shows while it loads or when there is none.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Truck } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { money } from '../../utils/currency';

export default function FreeDeliveryBar({ gigId, currency = 'ILS', className = '', onPromo }) {
  const { t, i18n } = useTranslation();
  const [promo, setPromo] = useState(null);
  useEffect(() => {
    if (!gigId) return;
    axios.get(`${API}/marketplace/gigs/${gigId}/promo`).then((r) => { setPromo(r.data.promo); if (onPromo) onPromo(r.data.promo); }).catch(() => setPromo(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId]);
  if (!promo) return null;
  const until = promo.ends_on
    ? new Date(`${promo.ends_on}T12:00:00`).toLocaleDateString(i18n.language?.startsWith('he') ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long' })
    : null;
  const terms = [
    promo.min_order ? t('freeBar.over', 'on orders over {{n}}', { n: money(promo.min_order, currency) }) : null,
    promo.first_order_only ? t('freeBar.first', 'on your first order') : null,
    until ? t('freeBar.until', 'until {{date}}', { date: until }) : null,
  ].filter(Boolean).join(', ');
  return (
    <p className={`flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm ${className}`}
       style={{ background: 'var(--accent-soft)', color: 'var(--ink)' }} data-testid="free-delivery-bar">
      <Truck size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
      <span className="min-w-0">{t('freeBar.text', 'Free delivery with code')} <b dir="ltr" className="tracking-wider">{promo.code}</b>{terms ? ` ${terms}` : ''}</span>
    </p>
  );
}
