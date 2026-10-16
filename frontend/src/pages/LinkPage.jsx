/**
 * /link/:slug: a business's "link in bio" page for Instagram and TikTok
 * (Tzvi, 16 Oct 2026, from Linktree). Made entirely from what the
 * business page already has, so there is nothing to set up: the logo and
 * name, the main actions as big buttons (book, order, join, gift cards,
 * message, their payment links), and their first few services or products.
 * One screen on a phone, no site menu.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, CalendarCheck, ShoppingBag, Users, Gift, MessageCircle, CreditCard, ChevronRight } from 'lucide-react';
import { API } from '../lib/apiBase';
import { getGigCover } from '../utils/gigAvailability';
import { localizedTitle } from '../utils/gigLocale';
import { money } from '../utils/currency';
import { visitorHeaders } from '../utils/visitorId';

// A square for every tile, so a missing or broken photo leaves a calm grey
// square rather than a gap that throws the row out of line.
const Photo = ({ src }) => (
  <div className="w-full aspect-square" style={{ background: '#F3F4F6' }}>
    {src && <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
  </div>
);

export default function LinkPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [biz, setBiz] = useState(null);

  useEffect(() => { document.body.classList.add('orders-bare'); return () => document.body.classList.remove('orders-bare'); }, []);
  useEffect(() => {
    axios.get(`${API}/marketplace/business/${encodeURIComponent(slug)}`, { headers: visitorHeaders() })
      .then(({ data }) => setBiz(data)).catch(() => setBiz(false));
  }, [slug]);

  if (biz === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (biz === false) return <div className="max-w-md mx-auto px-4 py-24 text-center"><h1 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.badLink', 'This link no longer works')}</h1></div>;

  const name = (lang === 'he' && biz.name_he) || biz.name;
  const about = (lang === 'he' && biz.description_he) || biz.description;
  const page = `/business/${biz.slug || biz.id}`;
  const listings = (biz.listings || []).filter((g) => (g.status || 'published') === 'published');
  const store = listings.find((g) => g.gig_type === 'store');
  const booking = listings.find((g) => g.gig_type === 'appointment');
  const actions = [
    booking && { to: `/businesses/${booking.id}`, icon: CalendarCheck, label: t('linkPage.book', 'Book an appointment') },
    store && { to: `/order/${store.id}`, icon: ShoppingBag, label: t('linkPage.order', 'Order') },
    biz.has_memberships && { to: `/memberships/${biz.slug || biz.id}`, icon: Users, label: t('linkPage.join', 'Memberships') },
    biz.gift_cards_on && { to: `/gift-cards/${biz.slug || biz.id}`, icon: Gift, label: t('linkPage.gift', 'Gift cards') },
    { to: page, icon: MessageCircle, label: t('linkPage.page', 'Our page, and send us a message') },
  ].filter(Boolean);
  const items = listings.filter((g) => g.gig_type !== 'store').slice(0, 4);
  const products = (store?.products || []).filter((p) => p.in_stock !== false).slice(0, Math.max(0, 4 - items.length));

  return (
    <div className="min-h-screen" style={{ background: '#F9FAFB' }} data-testid="link-page">
      <main className="max-w-md mx-auto px-4 py-10 text-center">
        {biz.logo_url
          ? <img src={biz.logo_url} alt="" className="w-20 h-20 rounded-3xl object-cover mx-auto bg-white shadow-sm" />
          : <div className="w-20 h-20 rounded-3xl mx-auto grid place-content-center text-2xl font-bold bg-white shadow-sm" style={{ color: 'var(--ink)' }}>{(name || '?').slice(0, 1)}</div>}
        <h1 className="mt-4 text-2xl font-bold" dir="auto" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{name}</h1>
        {about && <p className="mt-2 text-sm leading-relaxed line-clamp-3" dir="auto" style={{ color: 'var(--brand-muted)' }}>{about}</p>}

        <ul className="mt-6 space-y-3">
          {actions.map((a, i) => (
            <li key={a.to}>
              <Link to={a.to} className="flex items-center justify-center gap-2 w-full min-h-[56px] rounded-2xl text-base font-semibold shadow-sm"
                    style={i === 0 ? { background: 'var(--action)', color: 'var(--action-ink)' } : { background: '#fff', color: 'var(--ink)', border: '1px solid var(--brand-border)' }}
                    data-testid="link-action">
                <a.icon size={18} aria-hidden="true" /> {a.label}
              </Link>
            </li>
          ))}
          {(biz.payment_links || []).map((p) => (
            <li key={p.url}>
              <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 w-full min-h-[52px] rounded-2xl text-sm font-semibold bg-white"
                 style={{ color: 'var(--ink)', border: '1px solid var(--brand-border)' }}>
                <CreditCard size={16} aria-hidden="true" /> {t('linkPage.pay', 'Pay with {{p}}', { p: p.label })}
              </a>
            </li>
          ))}
        </ul>

        {(items.length > 0 || products.length > 0) && (
          <section className="mt-8 text-start">
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('linkPage.popular', 'What we offer')}</h2>
            <div className="grid grid-cols-2 gap-3">
              {items.map((g) => (
                <Link key={g.id} to={`/businesses/${g.id}`} className="block rounded-2xl overflow-hidden bg-white border" style={{ borderColor: 'var(--brand-border)' }}>
                  <Photo src={getGigCover(g)} />
                  <span className="block px-2.5 pt-2 text-sm font-semibold line-clamp-2" dir="auto" style={{ color: 'var(--ink)' }}>{localizedTitle(g, i18n)}</span>
                  <span className="block px-2.5 pb-2.5 text-xs" style={{ color: 'var(--brand-muted)' }}>{g.cheapest_price ? t('linkPage.from', 'from {{p}}', { p: money(g.cheapest_price, 'ILS') }) : ' '}</span>
                </Link>
              ))}
              {products.map((p) => (
                <Link key={p.id || p.name} to={`/order/${store.id}${p.id ? `?add=${encodeURIComponent(p.id)}` : ''}`} className="block rounded-2xl overflow-hidden bg-white border" style={{ borderColor: 'var(--brand-border)' }}>
                  <Photo src={p.images?.[0] || p.image} />
                  <span className="block px-2.5 pt-2 text-sm font-semibold line-clamp-2" dir="auto" style={{ color: 'var(--ink)' }}>{p.name}</span>
                  <span className="block px-2.5 pb-2.5 text-xs" style={{ color: 'var(--brand-muted)' }}>{p.price ? money(p.price, p.currency || 'ILS') : ' '}</span>
                </Link>
              ))}
            </div>
            <Link to={page} className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold min-h-[44px]" style={{ color: 'var(--ink)' }}>
              {t('linkPage.all', 'See everything')} <ChevronRight size={15} className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </section>
        )}
        <p className="mt-10 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
          <Link to="/" className="underline">MyIsraelRental</Link>
        </p>
      </main>
    </div>
  );
}
