/**
 * Under an order: more from the same business, and a few other businesses on
 * MyIsraelRental that go with it (Tzvi, 12 Nov 2026: more people looking at the
 * site). Shown on the "Order sent" screen and the customer's order page, below
 * everything about the order itself, so it never pushes that aside.
 * Backed by GET /marketplace/orders/track/:token/explore (order_explore.py);
 * the other businesses' links carry ?src=orders so the visit is counted for them.
 * Shows nothing at all when there is nothing real to show.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { ArrowRight, Plus } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { money } from '../../utils/currency';

export default function KeepExploring({ token, businessName, currency = 'ILS' }) {
  const { t, i18n } = useTranslation();
  const he = (i18n.language || '').startsWith('he');
  const [d, setD] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/marketplace/orders/track/${encodeURIComponent(token)}/explore`)
      .then(({ data }) => setD(data)).catch(() => setD(null));
  }, [token]);

  if (!d || (!d.more?.length && !d.others?.length)) return null;
  const name = (x, k) => (he && x[`${k}_he`]) || x[k];
  const price = (p) => {
    if (p.price_kind === 'quote' || p.price == null) return t('priceKind.onRequest', 'Price on request');
    const m = money(p.price, p.currency || currency);
    return p.price_kind === 'from' ? t('priceKind.fromPrice', 'from {{price}}', { price: m }) : m;
  };

  return (
    <div className="mt-4 space-y-4" data-testid="keep-exploring">
      {d.more?.length > 0 && (
        <section className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="explore-more">
          <h2 className="text-base font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
            {t('explore.moreTitle', 'More from {{name}}', { name: businessName })}
          </h2>
          <ul className="mt-3 divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {d.more.map((p) => (
              <li key={p.href}>
                <a href={p.href} className="flex items-center gap-3 py-2 min-h-[56px]" aria-label={`${name(p, 'name')}: ${t('explore.addNext', 'Add to my next order')}`} data-testid="explore-more-item">
                  {p.image
                    ? <img src={p.image} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    : null}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--ink)' }} dir="auto">{name(p, 'name')}</span>
                    <span className="block text-xs tabular-nums" style={{ color: 'var(--brand-muted)' }}>{price(p)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 min-h-[44px] rounded-full border text-xs font-semibold shrink-0"
                        style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} title={t('explore.addNext', 'Add to my next order')}>
                    <Plus size={13} aria-hidden="true" /> {t('explore.add', 'Add')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.others?.length > 0 && (
        <section className="rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="explore-others">
          <h2 className="text-base font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
            {t('explore.othersTitle', 'Others on MyIsraelRental you might like')}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {d.others.map((g) => (
              <a key={g.href} href={g.href} className="block rounded-xl overflow-hidden border" style={{ borderColor: 'var(--brand-border)' }} data-testid="explore-other">
                <img src={g.photo} alt="" loading="lazy" className="w-full aspect-square object-cover block" />
                <span className="block px-2 py-1.5">
                  <span className="block text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--ink)' }} dir="auto">{name(g, 'title')}</span>
                  {g.area && <span className="block text-[11px] truncate" style={{ color: 'var(--brand-muted)' }} dir="auto">{g.area}</span>}
                </span>
              </a>
            ))}
          </div>
          <a href="/services?src=orders" className="mt-3 inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold" style={{ color: 'var(--gold-text-on-light, var(--gold))' }} data-testid="explore-all">
            {t('explore.seeAll', 'See everything on MyIsraelRental')} <ArrowRight size={14} className="rtl:rotate-180" aria-hidden="true" />
          </a>
        </section>
      )}
    </div>
  );
}
