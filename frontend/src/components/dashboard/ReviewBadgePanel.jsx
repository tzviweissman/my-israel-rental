/**
 * My businesses → "Rating badge for your website" (backend
 * routes/marketplace/rating_badge.py). The business's real stars and review
 * count as a picture for its own website or link-in-bio page, linking back
 * to its page here. Drawn live, so it updates as reviews come in; under
 * three reviews it shows the count only, never an average.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Code, Download, Star, X } from 'lucide-react';

const SITE = 'https://myisraelrental.com';

export default function ReviewBadgePanel({ API, business, pageUrl }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [lang, setLang] = useState(String(i18n.language || '').startsWith('he') ? 'he' : 'en');
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);
  const key = encodeURIComponent(business.slug || business.id);
  const path = `/marketplace/business/${key}/rating-badge.svg?lang=${lang}&theme=${theme}`;
  const alt = lang === 'he' ? `הביקורות על ${business.name} ב-MyIsraelRental` : `${business.name} reviews on MyIsraelRental`;
  const code = `<a href="${pageUrl}" target="_blank" rel="noopener"><img src="${SITE}/api${path}" alt="${alt.replace(/"/g, '&quot;')}" width="260" height="64"></a>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('ratingBadge.copied', 'Code copied. Paste it into your website.'));
    } catch {
      toast.error(code);
    }
  };
  // A picture for Instagram or a flyer: the same badge at three times the size.
  const download = async () => {
    try {
      const svg = await (await fetch(`${API}${path}`)).text();
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 780; c.height = 192;
      c.getContext('2d').drawImage(img, 0, 0, 780, 192);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `${(business.slug || 'business').toString().slice(0, 40)}-rating.png`;
      a.click();
    } catch {
      toast.error(t('ratingBadge.downloadFailed', 'Could not make the picture. Try again.'));
    }
  };

  const link = 'inline-flex items-center gap-1.5 min-h-[44px] text-[13px] font-semibold underline underline-offset-4';
  const chip = (on) => ({ borderColor: on ? 'var(--ink)' : 'var(--brand-border)', background: on ? 'var(--ink)' : '#fff', color: on ? '#fff' : 'var(--ink)' });

  const opener = (
      <button type="button" onClick={() => setOpen(true)} data-testid={`rating-badge-open-${business.id}`}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-semibold"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}>
        <Star size={13} /> {t('ratingBadge.open', 'Rating badge for your website')}
      </button>
  );
  if (!open) return opener;
  // A window over the page: the business card it opens from is too narrow to hold it.
  return (
    <>
    {opener}
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: 'rgba(17,24,39,.45)' }}
         onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
    <div role="dialog" aria-modal="true" aria-label={t('ratingBadge.title', 'Show your rating on your own website')}
         className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl max-h-[90vh] overflow-auto" data-testid={`rating-badge-${business.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('ratingBadge.title', 'Show your rating on your own website')}</p>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('ratingBadge.body', 'Your stars and number of reviews here, kept up to date by itself. Clicking it opens your page. With fewer than 3 reviews it shows how many you have, not stars.')}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="grid place-content-center w-11 h-11 shrink-0" aria-label={t('customers.close', 'Close')}><X size={16} /></button>
      </div>
      <div className="mt-2 rounded-lg p-3 inline-block" style={{ background: theme === 'dark' ? '#F3F4F6' : '#F9FAFB' }}>
        <img src={`${API}${path}`} alt={alt} width="260" height="64" className="block max-w-full h-auto" />
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {[['light', t('ratingBadge.light', 'Light')], ['dark', t('ratingBadge.dark', 'Dark')]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)}
                  className="px-3 min-h-[36px] rounded-full border text-xs font-semibold" style={chip(theme === k)}>{l}</button>
        ))}
        {[['he', 'עברית'], ['en', 'English']].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={lang === k} onClick={() => setLang(k)}
                  className="px-3 min-h-[36px] rounded-full border text-xs font-semibold" style={chip(lang === k)}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4">
        <button type="button" onClick={copy} className={link} style={{ color: 'var(--gold)' }} data-testid={`rating-badge-copy-${business.id}`}>
          <Code size={14} aria-hidden="true" /> {t('ratingBadge.copy', 'Copy the code for your website')}
        </button>
        <button type="button" onClick={download} className={link} style={{ color: 'var(--gold)' }}>
          <Download size={14} aria-hidden="true" /> {t('ratingBadge.download', 'Download the picture for Instagram or a flyer')}
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
        {t('ratingBadge.how', 'Wix, WordPress and most site builders have an "Embed code" or "HTML" box: paste the code there.')}
      </p>
    </div>
    </div>
    </>
  );
}
