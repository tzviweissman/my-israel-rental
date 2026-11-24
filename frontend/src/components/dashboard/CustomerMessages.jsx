/**
 * The messages a business's customers get, grouped by when they go out (Tzvi, 23 Nov 2026: "people are having a
 * hard time navigating and knowing what each does"). Each one says when it is sent and how (text, email), whether
 * it is in our words or the business's own, whether it is off, and how many went in the last 30 days. Opened, it
 * edits the words with Undo and Redo, translates them from the other language, and sends a test to the business.
 *
 * From Shopify's Customer notifications ("Sent when…" under each message, grouped by stage), Calendly ("Immediately
 * after booking"), and Motion (the example beside the editor). Replaces TextTemplatesEditor. The words are saved
 * with the panel's Save; the link is still added by the server (order_texts.compose), so no edit can lose it.
 * What each "when" says is checked against the senders in backend routes/marketplace/order_texts.py,
 * order_emails.py and appointment_reminders.py: change one, change the other.
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Languages, Loader2, Mail, MessageSquare, Redo2, RotateCcw, Send, Undo2 } from 'lucide-react';

// Stage by stage, as a customer meets them. `email`: the same words also open the customer's email.
export const GROUPS = [
  ['orders', ['order_received', 'order_confirmed', 'order_declined']],
  ['bookings', ['request_received', 'booking_confirmed', 'booking_declined', 'reminder']],
  ['after', ['review']],
  ['replies', ['auto_reply']],
];
const EMAIL_TOO = new Set(['order_received', 'order_confirmed', 'order_declined', 'booking_confirmed', 'booking_declined']);
// The ones a business may switch off (order_texts.OPTIONAL); the reminder by its own switch.
const OPTIONAL = new Set(['order_received', 'request_received', 'review', 'auto_reply', 'reminder']);
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
const REMINDER_HOURS = [2, 3, 6, 12, 24, 48, 72];

function parts(text) {
  const gsm = GSM.test(text);
  return text.length <= (gsm ? 160 : 70) ? 1 : Math.ceil(text.length / (gsm ? 153 : 67));
}

export function fillSample(text, lang, businessName, businessNameHe) {
  const sample = {
    customer: lang === 'he' ? 'דנה' : 'Dana', business: (lang === 'he' && businessNameHe) || businessName || (lang === 'he' ? 'העסק שלך' : 'Your business'),
    order: '#1042', service: lang === 'he' ? 'תספורת' : 'Haircut', when: lang === 'he' ? 'מחר' : 'tomorrow', time: '14:00',
  };
  let s = text || '';
  Object.entries(sample).forEach(([p, v]) => { s = s.split(`{${p}}`).join(v); });
  return s.replace(/[ \t]{2,}/g, ' ').trim();
}

export default function CustomerMessages({
  API, auth, businessId, defaults, templates, setTemplates, off, setOff, reminders, setReminders, counts, textsOn,
  businessName, businessNameHe, lang, setLang, openKey, setOpenKey, onTurnTextsOn, renderPreview,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState('');
  // Undo and Redo, per message and language: a burst of typing is one step, as in a text editor.
  const hist = useRef({});
  const [, bump] = useState(0);
  if (!defaults) return null;

  const label = (k) => t(`orderTexts.tpl.${k}`, k);
  const own = (k, l = lang) => (templates[k] || {})[l];
  const value = (k, l = lang) => own(k, l) ?? defaults[k][l];
  const h = (k) => { const id = `${k}|${lang}`; hist.current[id] = hist.current[id] || { past: [], future: [], at: 0 }; return hist.current[id]; };
  const write = (k, v) => setTemplates((all) => ({ ...all, [k]: { ...(all[k] || {}), [lang]: v } }));
  const set = (k, v, { step = false } = {}) => {
    const s = h(k);
    if (step || Date.now() - s.at > 800) s.past.push(value(k));
    if (s.past.length > 50) s.past.shift();
    s.future = [];
    s.at = Date.now();
    write(k, v);
    bump((n) => n + 1);
  };
  const undo = (k) => { const s = h(k); if (!s.past.length) return; s.future.push(value(k)); write(k, s.past.pop()); s.at = 0; bump((n) => n + 1); };
  const redo = (k) => { const s = h(k); if (!s.future.length) return; s.past.push(value(k)); write(k, s.future.pop()); s.at = 0; bump((n) => n + 1); };
  const reset = (k) => {
    h(k).past.push(value(k));
    h(k).at = 0;
    setTemplates((all) => { const next = { ...(all[k] || {}) }; delete next[lang]; return { ...all, [k]: next }; });
    bump((n) => n + 1);
  };
  const insert = (k, piece) => {
    const el = document.getElementById(`tpl-${k}`);
    const v = value(k);
    const at = el ? el.selectionStart : v.length;
    set(k, `${v.slice(0, at)}{${piece}}${v.slice(at)}`, { step: true });
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + piece.length + 2; } }, 0);
  };
  const isOff = (k) => (k === 'reminder' ? reminders && !reminders.on : off.includes(k) || (k === 'auto_reply' && !value(k)));
  const toggle = (k) => {
    if (k === 'reminder') setReminders((r) => ({ ...r, on: !r.on }));
    else setOff((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  };
  const preview = (k) => {
    const s = fillSample(value(k), lang, businessName, businessNameHe);
    return s && !NO_LINK.has(k) ? `${s} ${SAMPLE_LINK}` : s;
  };
  const when = (k) => (k === 'reminder'
    ? t('orderTexts.when.reminder', '{{h}} hours before an appointment, and again 2 hours before', { h: reminders?.hours || 24 })
    : t(`orderTexts.when.${k}`));
  const other = lang === 'he' ? 'en' : 'he';

  const translate = async (k) => {
    setBusy(`tr-${k}`);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/orders/texts/translate`, { text: value(k, other), to: lang }, auth);
      set(k, data.text, { step: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orderTexts.translateFailed', 'The translation did not go through'));
    } finally { setBusy(''); }
  };
  const test = async (k, how) => {
    setBusy(`test-${k}-${how}`);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/orders/texts/test`, { key: k, lang, how, words: value(k) }, auth);
      toast.success(how === 'text'
        ? t('orderTexts.testSentText', 'Sent to your phone ending {{end}}', { end: data.sent_to })
        : t('orderTexts.testSentEmail', 'Sent to {{to}}', { to: data.sent_to }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orderTexts.testFailed', 'The test did not go out'));
    } finally { setBusy(''); }
  };

  const muted = { color: 'var(--brand-muted)' };
  const chip = (text, style) => <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={style}>{text}</span>;
  const iconBtn = 'inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-full border text-[12px] font-semibold disabled:opacity-40';
  const iconStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

  return (
    <div data-testid="text-templates">
      {!textsOn && (
        <div className="rounded-xl px-3 py-2.5 mb-3 text-[13px] flex flex-wrap items-center justify-between gap-2" style={{ background: '#FFF4E5', color: '#7A4100' }} role="status" data-testid="msgs-texts-off">
          <span>{t('orderTexts.textsOffNote', 'Texts to customers are off, because "Text me new orders and bookings" is off. Emails still go.')}</span>
          <button type="button" onClick={onTurnTextsOn} className="font-semibold underline min-h-[36px]">{t('orderTexts.turnTextsOn', 'Turn texts on')}</button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[12px]" style={muted}>{t('orderTexts.tplHint2', 'Tap a message to change its words. The link is added by itself.')}</p>
        <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orderTexts.tplLang', 'Language of the text')}>
          {['en', 'he'].map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} data-testid={`tpl-lang-${l}`}
                    className="px-3 min-h-[36px] rounded-full text-[13px] font-semibold"
                    style={lang === l ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}>
              {l === 'en' ? 'English' : 'עברית'}
            </button>
          ))}
        </div>
      </div>
      {GROUPS.map(([group, keys]) => {
        const shown = keys.filter((k) => defaults[k]);
        if (!shown.length) return null;
        return (
          <section key={group} className="mb-4" data-testid={`msgs-group-${group}`}>
            <h4 className="text-[12px] font-bold uppercase tracking-wide mb-1.5" style={muted}>{t(`orderTexts.group.${group}`)}</h4>
            <ul className="rounded-xl border divide-y" style={{ borderColor: 'var(--brand-border)' }}>
              {shown.map((k) => {
                const isOpen = openKey === k;
                const edited = own(k) !== undefined && own(k) !== defaults[k][lang];
                const offNow = isOff(k);
                const c = counts?.[k];
                const text = preview(k);
                const s = h(k);
                return (
                  <li key={k} data-testid={`tpl-${k}-row`}>
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <button type="button" onClick={() => setOpenKey(isOpen ? '' : k)} aria-expanded={isOpen} data-testid={`tpl-${k}-open`}
                              className="flex-1 min-w-0 text-start min-h-[44px]" style={{ color: 'var(--ink)' }}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{label(k)}</span>
                          {offNow ? chip(t('orderTexts.tplOff', 'Off'), { background: '#F3F4F6', color: 'var(--brand-muted)' })
                            : edited ? chip(t('orderTexts.tplEdited', 'Your words'), { background: 'rgba(36,175,235,.15)', color: 'var(--ink)' })
                              : chip(t('orderTexts.tplOurs', 'Our words'), { background: '#F9FAFB', color: 'var(--brand-muted)' })}
                        </span>
                        <span className="block text-[12px] mt-0.5" style={muted} data-testid={`tpl-${k}-when`}>
                          {when(k)} · {t('orderTexts.toCustomerShort', 'to your customer')}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px]" style={muted}>
                          <span className="inline-flex items-center gap-1"><MessageSquare size={12} aria-hidden="true" />{t('orderTexts.pv.text', 'Text')}</span>
                          {EMAIL_TOO.has(k) && <span className="inline-flex items-center gap-1"><Mail size={12} aria-hidden="true" />{t('orderTexts.pv.email', 'Email')}</span>}
                          {c && c.sent > 0 && (
                            <span data-testid={`tpl-${k}-count`}>
                              {t('orderTexts.countSent', 'Sent {{count}} times in 30 days', { count: c.sent })}
                              {c.failed > 0 && <span style={{ color: '#B42318' }}> · {t('orderTexts.countFailed', '{{n}} not delivered', { n: c.failed })}</span>}
                            </span>
                          )}
                        </span>
                      </button>
                      {OPTIONAL.has(k) && (
                        <button type="button" role="switch" aria-checked={!offNow} aria-label={t('orderTexts.sendThis', 'Send this message')}
                                onClick={() => toggle(k)} disabled={k === 'auto_reply' && !value(k)} data-testid={`tpl-${k}-switch`}
                                className="shrink-0 inline-flex min-h-[44px] min-w-[52px] items-center justify-center disabled:opacity-40">
                          <span className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${!offNow ? 'justify-end' : 'justify-start'}`}
                                style={{ background: !offNow ? 'var(--brand-primary)' : 'var(--brand-muted)' }}>
                            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                          </span>
                        </button>
                      )}
                      {!OPTIONAL.has(k) && <span className="shrink-0 text-[11px] mt-3" style={muted}>{t('orderTexts.always', 'Always sent')}</span>}
                      <button type="button" onClick={() => setOpenKey(isOpen ? '' : k)} aria-label={label(k)} className="shrink-0 min-h-[44px] min-w-[32px] inline-flex items-center justify-center" style={{ color: 'var(--ink)' }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="px-3 pb-3" data-testid={`tpl-${k}-editor`}>
                        {k === 'auto_reply' && <p className="text-[12px] mb-1" style={muted}>{t('orderTexts.tplAutoHint', 'Sent once a day to a customer who answers one of your texts. Works once replies are set up.')}</p>}
                        {k === 'order_received' && <p className="text-[12px] mb-1" style={muted}>{t('orderTexts.receivedNote', 'Off stops the text only: the customer still gets an email receipt of what they ordered.')}</p>}
                        {k === 'reminder' && reminders && (
                          <label className="flex flex-wrap items-center gap-2 mb-2 text-[13px]" style={{ color: 'var(--ink)' }}>
                            {t('orderTexts.reminderWhen', 'Send it')}
                            <select value={reminders.hours} onChange={(e) => setReminders((r) => ({ ...r, hours: Number(e.target.value) }))}
                                    className="min-h-[40px] rounded-lg border px-2 bg-white" style={{ borderColor: 'var(--brand-border)', fontSize: 16 }} data-testid="tpl-reminder-hours">
                              {REMINDER_HOURS.map((n) => <option key={n} value={n}>{t('orderTexts.hoursBefore', '{{n}} hours before', { n })}</option>)}
                            </select>
                            <span className="text-[12px]" style={muted}>{t('orderTexts.reminderAlso', 'plus one 2 hours before. An email reminder goes at the same time.')}</span>
                          </label>
                        )}
                        <textarea id={`tpl-${k}`} rows={3} maxLength={300} value={value(k)} onChange={(e) => set(k, e.target.value)} dir={lang === 'he' ? 'rtl' : 'ltr'}
                                  className="w-full px-2 py-2 rounded-lg border bg-white" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)', fontSize: 16 }}
                                  placeholder={k === 'auto_reply' ? t('orderTexts.tplAutoPlaceholder', 'For example: Thanks, we will get back to you within the hour.') : ''}
                                  aria-label={label(k)} data-testid={`tpl-${k}-input`} />
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <button type="button" onClick={() => undo(k)} disabled={!s.past.length} className={iconBtn} style={iconStyle} data-testid={`tpl-${k}-undo`}>
                            <Undo2 size={13} /> {t('orderTexts.undo', 'Undo')}
                          </button>
                          <button type="button" onClick={() => redo(k)} disabled={!s.future.length} className={iconBtn} style={iconStyle} data-testid={`tpl-${k}-redo`}>
                            <Redo2 size={13} /> {t('orderTexts.redo', 'Redo')}
                          </button>
                          <span className="mx-1 h-5 w-px" style={{ background: 'var(--brand-border)' }} aria-hidden="true" />
                          {PIECES[k].map((p) => (
                            <button key={p} type="button" onClick={() => insert(k, p)} className="px-2.5 min-h-[36px] rounded-full border text-[12px]" style={iconStyle}>
                              + {t(`orderTexts.piece.${p}`, p)}
                            </button>
                          ))}
                        </div>
                        {text && <div className="mt-1" data-testid={`tpl-${k}-preview`}>{renderPreview(k)}</div>}
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
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {value(k, other) && (
                            <button type="button" onClick={() => translate(k)} disabled={!!busy} className={iconBtn} style={iconStyle} data-testid={`tpl-${k}-translate`}>
                              {busy === `tr-${k}` ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                              {other === 'en' ? t('orderTexts.fromEnglish', 'Translate from English') : t('orderTexts.fromHebrew', 'Translate from Hebrew')}
                            </button>
                          )}
                          <button type="button" onClick={() => test(k, 'text')} disabled={!!busy || !value(k)} className={iconBtn} style={iconStyle} data-testid={`tpl-${k}-test-text`}>
                            {busy === `test-${k}-text` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t('orderTexts.testText', 'Text me a test')}
                          </button>
                          {EMAIL_TOO.has(k) && (
                            <button type="button" onClick={() => test(k, 'email')} disabled={!!busy || !value(k)} className={iconBtn} style={iconStyle} data-testid={`tpl-${k}-test-email`}>
                              {busy === `test-${k}-email` ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} {t('orderTexts.testEmail', 'Email me a test')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
