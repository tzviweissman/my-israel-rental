/**
 * The business's own words for each text its customers get (Tzvi, 7 Nov 2026:
 * "customize texts like we can with WhatsApp"). Our wording shows until they
 * change it; the link is added after the words by the server
 * (order_texts.compose), so no edit can lose it. Saved with the panel's Save.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

const ORDER = ['order_received', 'order_confirmed', 'order_declined', 'booking_confirmed', 'booking_declined',
  'request_received', 'reminder', 'review', 'auto_reply'];
const PIECES = {
  order_received: ['customer', 'business', 'order'],
  order_confirmed: ['customer', 'business', 'order'],
  order_declined: ['customer', 'business', 'order'],
  booking_confirmed: ['customer', 'business', 'service'],
  booking_declined: ['customer', 'business', 'service'],
  request_received: ['business', 'service'],
  reminder: ['customer', 'business', 'service', 'when', 'time'],
  review: ['customer', 'business', 'order'],
  auto_reply: ['business'],
};
const NO_LINK = new Set(['order_declined', 'auto_reply']);
const SAMPLE_LINK = 'https://myisraelrental.com/orders/track/a1B2c3D4e5F6g7H8i9J0kL';
// The plain SMS alphabet: a text in it is 160 letters a part, anything else (Hebrew, ₪, emoji) 70.
const GSM = /^[A-Za-z0-9 \n\r@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;

function parts(text) {
  const gsm = GSM.test(text);
  const one = gsm ? 160 : 70;
  const many = gsm ? 153 : 67;
  return text.length <= one ? 1 : Math.ceil(text.length / many);
}

export default function TextTemplatesEditor({ defaults, templates, setTemplates, businessName, businessNameHe }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState('');
  const [lang, setLang] = useState(i18n.language?.startsWith('he') ? 'he' : 'en');
  if (!defaults) return null;

  const sample = {
    customer: lang === 'he' ? 'דנה' : 'Dana', business: (lang === 'he' && businessNameHe) || businessName || (lang === 'he' ? 'העסק שלך' : 'Your business'),
    order: '#1042', service: lang === 'he' ? 'תספורת' : 'Haircut', when: lang === 'he' ? 'מחר' : 'tomorrow', time: '14:00',
  };
  const label = (k) => t(`orderTexts.tpl.${k}`, k);
  const pieceLabel = (p) => t(`orderTexts.piece.${p}`, p);
  const own = (k, l = lang) => (templates[k] || {})[l];
  const value = (k) => own(k) ?? defaults[k][lang];
  const set = (k, v) => setTemplates((all) => ({ ...all, [k]: { ...(all[k] || {}), [lang]: v } }));
  const reset = (k) => setTemplates((all) => {
    const next = { ...(all[k] || {}) };
    delete next[lang];
    return { ...all, [k]: next };
  });
  const insert = (k, piece) => {
    const el = document.getElementById(`tpl-${k}`);
    const v = value(k);
    const at = el ? el.selectionStart : v.length;
    set(k, `${v.slice(0, at)}{${piece}}${v.slice(at)}`);
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + piece.length + 2; } }, 0);
  };
  const preview = (k) => {
    let s = value(k);
    Object.entries(sample).forEach(([p, v]) => { s = s.split(`{${p}}`).join(v); });
    s = s.replace(/[ \t]{2,}/g, ' ').trim();
    return s && !NO_LINK.has(k) ? `${s} ${SAMPLE_LINK}` : s;
  };
  const muted = { color: 'var(--brand-muted)' };

  return (
    <div className="mt-4" data-testid="text-templates">
      <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.tplTitle', 'Your texts to customers')}</h4>
      <p className="text-[12px] mt-0.5 mb-2" style={muted}>{t('orderTexts.tplHint', 'Change the words of any text. The link is added by itself.')}</p>
      <div className="inline-flex rounded-full border p-0.5 mb-2" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orderTexts.tplLang', 'Language of the text')}>
        {['en', 'he'].map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} data-testid={`tpl-lang-${l}`}
                  className="px-3 min-h-[36px] rounded-full text-[13px] font-semibold"
                  style={lang === l ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}>
            {l === 'en' ? 'English' : 'עברית'}
          </button>
        ))}
      </div>
      <ul className="rounded-xl border divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {ORDER.filter((k) => defaults[k]).map((k) => {
          const isOpen = open === k;
          const edited = own(k) !== undefined && own(k) !== defaults[k][lang];
          const text = preview(k);
          return (
            <li key={k} data-testid={`tpl-${k}-row`}>
              <button type="button" onClick={() => setOpen(isOpen ? '' : k)} aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-2 px-3 min-h-[48px] text-start text-sm" style={{ color: 'var(--ink)' }}>
                <span className="font-medium">{label(k)}
                  {edited && <span className="ms-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(36,175,235,.15)', color: 'var(--ink)' }}>{t('orderTexts.tplEdited', 'Your words')}</span>}
                  {k === 'auto_reply' && !value(k) && <span className="ms-2 text-[11px]" style={muted}>{t('orderTexts.tplOff', 'Off')}</span>}
                </span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3">
                  {k === 'auto_reply' && <p className="text-[12px] mb-1" style={muted}>{t('orderTexts.tplAutoHint', 'Sent once a day to a customer who answers one of your texts. Works once replies are set up.')}</p>}
                  <textarea id={`tpl-${k}`} rows={3} maxLength={300} value={value(k)} onChange={(e) => set(k, e.target.value)} dir={lang === 'he' ? 'rtl' : 'ltr'}
                            className="w-full px-2 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                            placeholder={k === 'auto_reply' ? t('orderTexts.tplAutoPlaceholder', 'For example: Thanks, we will get back to you within the hour.') : ''}
                            aria-label={label(k)} data-testid={`tpl-${k}-input`} />
                  <div className="flex flex-wrap gap-1.5 mt-1" aria-label={t('orderTexts.tplInsert', 'Add to the text')}>
                    {PIECES[k].map((p) => (
                      <button key={p} type="button" onClick={() => insert(k, p)} className="px-2.5 min-h-[32px] rounded-full border text-[12px]"
                              style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>+ {pieceLabel(p)}</button>
                    ))}
                  </div>
                  {text && (
                    <div className="mt-2 rounded-xl px-3 py-2 text-[13px] break-words" style={{ background: '#F9FAFB', color: 'var(--ink)' }} dir={lang === 'he' ? 'rtl' : 'ltr'} data-testid={`tpl-${k}-preview`}>
                      <span className="block text-[11px] font-semibold mb-0.5" style={muted}>{t('orderTexts.preview', 'What your customer gets')}</span>
                      {text}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
                    <span className="text-[11px]" style={{ color: text && parts(text) > 1 ? '#B42318' : 'var(--brand-muted)' }}>
                      {text ? t('orderTexts.tplParts', '{{n}} characters, counts as {{p}} text(s)', { n: text.length, p: parts(text) }) : ''}
                    </span>
                    {own(k) !== undefined && (
                      <button type="button" onClick={() => reset(k)} className="inline-flex items-center gap-1 min-h-[36px] text-[12px] font-semibold" style={{ color: 'var(--brand-primary)' }} data-testid={`tpl-${k}-reset`}>
                        <RotateCcw size={12} /> {t('orderTexts.tplReset', 'Use our wording')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
