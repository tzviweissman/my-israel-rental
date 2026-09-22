/**
 * "People looking for you": up to three open posts on the requests board
 * that this person's services or rentals could answer. Server side is
 * /marketplace/looking-for-me, the email digest's matching rule read from
 * the other side. Renders nothing at all when nothing matches: an empty
 * card saying "nobody wants you" helps no one.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Search, ArrowRight } from 'lucide-react';

import { localizedTitle } from '../../utils/gigLocale';
import formatDate from '../../utils/formatDate';
import { areaLabel } from '../../utils/areaNames';

export default function LookingForYou({ API, token, className = '' }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    axios.get(`${API}/marketplace/looking-for-me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (alive && Array.isArray(r.data)) setItems(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [API, token]);

  if (!items.length) return null;

  return (
    <section
      className={`rounded-xl border p-5 ${className}`}
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #fff)' }}
      data-testid="looking-for-you"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
          <Search size={16} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
          {t('lookingForYou.title', 'People looking for what you offer')}
        </h3>
        <Link to="/requests" className="text-xs font-semibold hover:underline inline-flex items-center gap-1 shrink-0" style={{ color: 'var(--brand-primary)' }}>
          {t('lookingForYou.board', 'See the board')} <ArrowRight size={12} className="rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>
        {t('lookingForYou.body', 'Open posts that match your listings. Reply in chat; nobody sees your number.')}
      </p>
      <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {items.map((r) => (
          <li key={r.id} className="py-2.5">
            <Link to={`/requests/${r.id}`} className="block group" data-testid="looking-for-you-item">
              <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--ink)' }}>
                {localizedTitle(r, i18n)}
              </span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                {[r.area && areaLabel(r.area, t), formatDate(r.created_at)].filter(Boolean).join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
