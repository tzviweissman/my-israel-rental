/**
 * /gift-cards/:slug: buy a gift card from a business, no account
 * (backend routes/marketplace/gift_cards.py). The form is GiftCardForm. The
 * card goes out once the business confirms the payment, which the page says
 * plainly before anyone sends. Links already shared still land here; the
 * business's own page opens the same form in place.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, Gift } from 'lucide-react';
import { API } from '../lib/apiBase';
import GiftCardForm from '../components/marketplace/GiftCardForm';

export default function GiftCardBuyPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/marketplace/gift-cards/${encodeURIComponent(slug)}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setData(false));
  }, [slug]);

  if (data === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 pb-24 text-center" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 48px)' }} data-testid="gift-none">
        <Gift size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('gift.none', 'Gift cards are not on sale here right now')}</h1>
      </div>
    );
  }
  const biz = data.business;
  const bizName = (lang === 'he' && biz.name_he) || biz.name;
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="gift-buy-page">
      <main className="max-w-xl mx-auto px-4 pb-16" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 28px)' }}>
        <div className="flex items-center gap-3 mb-2">
          {biz.logo_url && <img src={biz.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('gift.title', 'A gift card for {{name}}', { name: bizName })}</h1>
            {biz.slug && <Link to={`/business/${biz.slug}`} className="text-sm" style={{ color: 'var(--gold-text-on-light, #167AB8)' }}>{t('members.aboutBiz', 'About {{name}}', { name: bizName })}</Link>}
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>{t('gift.body', 'Choose an amount and who it is for. You pay the business directly; once they confirm, the card is emailed with its code. Valid for {{y}} years.', { y: data.valid_years })}</p>

        <GiftCardForm slug={slug} data={data} onDone={(r) => navigate(r.path)} />
      </main>
    </div>
  );
}
