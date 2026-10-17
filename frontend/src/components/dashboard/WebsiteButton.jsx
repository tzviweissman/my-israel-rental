/**
 * Business details → "A button for your own website" (Tzvi, 17 Oct 2026,
 * from Calendly's and Booksy's booking buttons). The business copies a few
 * lines of plain HTML into their Wix, WordPress or other site; the button
 * opens their order form, booking page or business page ON MyIsraelRental,
 * in a new tab, so their own visitors become our visitors. Plain HTML, no
 * script and no frame: it works in any site builder's "embed HTML" box,
 * and the customer always lands on our site, never a copy of it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, Code } from 'lucide-react';

const SITE = 'https://myisraelrental.com';
const LABELS = {
  order: { en: 'Order online', he: 'הזמנה אונליין' },
  book: { en: 'Book a time', he: 'קביעת תור' },
  page: { en: 'See us on MyIsraelRental', he: 'לדף העסק שלנו' },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function buttonHtml(href, label, lang) {
  const dir = lang === 'he' ? ' dir="rtl"' : '';
  return `<div${dir} style="font-family:Arial,Helvetica,sans-serif;display:inline-block;text-align:center">`
    + `<a href="${esc(href)}" target="_blank" rel="noopener" style="display:inline-block;background:#000;color:#fff;padding:12px 26px;border-radius:999px;font-size:16px;font-weight:600;text-decoration:none">${esc(label)}</a>`
    + `<div style="font-size:11px;color:#666;margin-top:6px">${lang === 'he' ? 'דרך' : 'via'} <a href="${SITE}" target="_blank" rel="noopener" style="color:#666">MyIsraelRental</a></div>`
    + '</div>';
}

export default function WebsiteButton({ business, API }) {
  const { t, i18n } = useTranslation();
  const [listings, setListings] = useState(null);
  const [kind, setKind] = useState('page');
  const [lang, setLang] = useState(i18n.language?.startsWith('he') ? 'he' : 'en');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!business?.slug) return;
    axios.get(`${API}/marketplace/business/${encodeURIComponent(business.slug)}`).then(({ data }) => {
      const ls = (data.listings || []).filter((g) => (g.status || 'published') === 'published');
      setListings(ls);
      if (ls.some((g) => g.gig_type === 'store')) setKind('order');
      else if (ls.some((g) => g.gig_type === 'appointment')) setKind('book');
    }).catch(() => setListings([]));
  }, [API, business?.slug]);

  const store = useMemo(() => (listings || []).find((g) => g.gig_type === 'store'), [listings]);
  const appt = useMemo(() => (listings || []).find((g) => g.gig_type === 'appointment'), [listings]);
  if (!business?.slug || listings === null) return null;

  const href = kind === 'order' && store ? `${SITE}/order/${store.id}?from=site`
    : kind === 'book' && appt ? `${SITE}/businesses/${appt.id}?from=site`
      : `${SITE}/business/${business.slug}?from=site`;
  const html = buttonHtml(href, LABELS[kind][lang], lang);
  const kinds = [store && 'order', appt && 'book', 'page'].filter(Boolean);
  const chip = (on) => (on ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' });

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="website-button">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-2 text-start text-sm font-semibold min-h-[40px]" style={{ color: 'var(--ink)' }}>
        <Code size={15} aria-hidden="true" /> {t('siteButton.title', 'A button for your own website')}
      </button>
      {open && (
        <div className="mt-2 space-y-3 text-sm">
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('siteButton.body', 'Have a website on Wix, WordPress or anywhere else? Paste this into an "embed HTML" box there. The button opens your page on MyIsraelRental in a new tab.')}</p>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-full border p-1" style={{ borderColor: 'var(--brand-border)' }} role="group">
              {kinds.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className="px-3 min-h-[34px] rounded-full text-xs font-semibold" style={chip(kind === k)} data-testid={`site-button-${k}`}>
                  {k === 'order' ? t('siteButton.order', 'Order') : k === 'book' ? t('siteButton.book', 'Booking') : t('siteButton.page', 'My page')}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-full border p-1" style={{ borderColor: 'var(--brand-border)' }} role="group">
              {[['en', 'English'], ['he', 'עברית']].map(([l, name]) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className="px-3 min-h-[34px] rounded-full text-xs font-semibold" style={chip(lang === l)}>{name}</button>
              ))}
            </div>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ background: '#F9FAFB' }}>
            <p className="text-[11px] mb-2" style={{ color: 'var(--brand-muted)' }}>{t('siteButton.preview', 'How it looks')}</p>
            {/* The exact HTML they will paste, so the preview cannot drift from it. */}
            <div dangerouslySetInnerHTML={{ __html: html }} data-testid="site-button-preview" />
          </div>
          <textarea readOnly value={html} rows={4} dir="ltr" onFocus={(e) => e.target.select()} className="w-full px-3 py-2 rounded-lg border text-xs bg-white font-mono"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="site-button-code" />
          <button type="button" onClick={() => navigator.clipboard?.writeText(html).then(() => toast.success(t('discounts.copied', 'Copied')))}
                  className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="site-button-copy">
            <Copy size={14} /> {t('siteButton.copy', 'Copy the code')}
          </button>
        </div>
      )}
    </div>
  );
}
