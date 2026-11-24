/**
 * Texts and emails for one business (Tzvi, 6 Nov 2026; emails 11 Nov). Three tabs since 23 Nov 2026 (Tzvi: "people
 * are having a hard time navigating and knowing what each does"):
 *   - Notification settings: accept orders automatically, and how the business hears of a new order (text, email, where to).
 *   - Customer messages: the business's own line, and every message its customers get, grouped by when it goes out
 *     (CustomerMessages.jsx), beside a phone preview of the one being edited (MessagePreview.jsx).
 *   - History: the last texts and emails, whether each arrived, and customers' replies.
 * One save bar for all three, shown only while something is changed, with "Undo all changes"; leaving the page with
 * changes unsaved asks first. The appointment reminder's switch and hours are saved through appointment_reminders.py.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, Loader2, RotateCcw, X } from 'lucide-react';
import CustomerMessages from './CustomerMessages';
import MessagePreview from './MessagePreview';

const TABS = ['alerts', 'messages', 'history'];

export default function TextNotificationsPanel({ API, token, businessId, onClose }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [loaded, setLoaded] = useState(null);
  const [on, setOn] = useState(false);
  const [different, setDifferent] = useState(false);
  const [number, setNumber] = useState('');
  const [note, setNote] = useState('');
  const [templates, setTemplates] = useState({});
  const [off, setOff] = useState([]);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [emailOn, setEmailOn] = useState(true);
  const [emailDifferent, setEmailDifferent] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [look, setLook] = useState({ on: false, logo: 'medium', accent: '#167AB8' });
  const [reminders, setReminders] = useState(null);
  const [recent, setRecent] = useState(null);
  const [recentEmails, setRecentEmails] = useState([]);
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('messages');
  const [openKey, setOpenKey] = useState('');
  const [msgLang, setMsgLang] = useState(i18n.language?.startsWith('he') ? 'he' : 'en');
  // What was last saved, to tell whether anything changed and to put it all back.
  const saved = useRef(null);

  const now = { on, different, number, note, templates, off, autoConfirm, emailOn, emailDifferent, emailTo, reminders, look };
  const apply = (s) => {
    setOn(s.on); setDifferent(s.different); setNumber(s.number); setNote(s.note); setTemplates(s.templates); setOff(s.off);
    setAutoConfirm(s.autoConfirm); setEmailOn(s.emailOn); setEmailDifferent(s.emailDifferent); setEmailTo(s.emailTo); setReminders(s.reminders); setLook(s.look);
  };
  const fromServer = (data, rem) => ({
    on: !!data.text_on, different: !!data.text_number, number: data.text_number || '', note: data.text_note || '',
    templates: data.text_templates || {}, off: data.text_off || [], autoConfirm: !!data.auto_confirm,
    emailOn: data.email_on !== false, emailDifferent: !!data.email_to, emailTo: data.email_to || '', reminders: rem,
    look: data.email_look || { on: false, logo: 'medium', accent: '#167AB8' },
  });

  useEffect(() => {
    const base = `${API}/marketplace/businesses/${businessId}`;
    Promise.all([
      axios.get(`${base}/orders/settings`, auth),
      axios.get(`${base}/appointment-reminders`, auth).then(({ data }) => data).catch(() => null),
    ]).then(([{ data }, rem]) => {
      const s = fromServer(data, rem);
      saved.current = JSON.stringify(s);
      apply(s);
      setLoaded(data);
    }).catch(() => setLoaded(false));
    // Whether each text arrived (Cellact's delivery reports, 7 Nov 2026), and customers' replies.
    axios.get(`${base}/orders/texts/recent`, auth).then(({ data }) => setRecent(data)).catch(() => setRecent(null));
    axios.get(`${base}/orders/emails/recent`, auth).then(({ data }) => setRecentEmails(data.emails || [])).catch(() => setRecentEmails([]));
    axios.get(`${base}/orders/texts/counts`, auth).then(({ data }) => setCounts(data.counts || {})).catch(() => setCounts({}));
  }, [API, auth, businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!loaded && saved.current !== null && JSON.stringify(now) !== saved.current;
  // Leaving with changes unsaved asks first (a reload, a closed tab, a link out of the site).
  useEffect(() => {
    if (!dirty) return undefined;
    const ask = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  if (loaded === false) return null;
  if (!loaded) return <div className="py-4 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 size={16} className="animate-spin inline" /></div>;

  const save = async () => {
    if (on && different && number.replace(/\D/g, '').length < 9) {
      setTab('alerts');
      toast.error(t('orderTexts.enterNumber', 'Please enter a mobile number with the leading 0 or a country code'));
      return;
    }
    if (emailOn && emailDifferent && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTo.trim())) {
      setTab('alerts');
      toast.error(t('orderTexts.enterEmail', 'Please enter an email address'));
      return;
    }
    setBusy(true);
    try {
      const base = `${API}/marketplace/businesses/${businessId}`;
      const { data } = await axios.put(`${base}/orders/texts`, {
        text_on: on, text_number: on && different ? number.trim() : null, text_note: note.trim() || null, text_templates: templates,
        auto_confirm: autoConfirm, text_off: off,
      }, auth);
      const { data: withEmails } = await axios.put(`${base}/orders/emails`, {
        email_on: emailOn, email_to: emailOn && emailDifferent ? emailTo.trim() : null, email_look: look,
      }, auth);
      let rem = reminders;
      if (reminders && JSON.stringify(reminders) !== JSON.stringify(JSON.parse(saved.current).reminders)) {
        rem = (await axios.put(`${base}/appointment-reminders`, reminders, auth)).data;
      }
      const s = fromServer({ ...withEmails, text_templates: data.text_templates, text_off: data.text_off }, rem);
      saved.current = JSON.stringify(s);
      apply(s);
      setLoaded(withEmails);
      toast.success(t('orderTexts.saved', 'Saved'));
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
  const muted = { color: 'var(--brand-muted)' };
  const Switch = ({ checked, onToggle, labelledBy, testid }) => (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} onClick={onToggle}
            className="shrink-0 -my-2.5 inline-flex min-h-[44px] min-w-[52px] items-center justify-center" data-testid={testid}>
      <span className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${checked ? 'justify-end' : 'justify-start'}`}
            style={{ background: checked ? 'var(--brand-primary)' : 'var(--brand-muted)' }}>
        <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
      </span>
    </button>
  );
  const historyCount = (recent?.texts?.length || 0) + (recent?.replies?.length || 0) + recentEmails.length;

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="text-notifications-panel">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{t('orderTexts.title', 'Texts and emails')}</h3>
        {onClose && <button type="button" onClick={onClose} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 rounded-full shrink-0" style={muted} aria-label={t('orders.close', 'Close')}><X size={18} /></button>}
      </div>

      {/* Three tabs, each saying what it holds, so a business knows where to look. */}
      <div role="tablist" aria-label={t('orderTexts.title', 'Texts and emails')} className="grid grid-cols-3 gap-1 rounded-xl p-1 mt-2 mb-1" style={{ background: '#F9FAFB' }} data-testid="texts-tabs">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`texts-tab-${k}`}
                  className="py-2 rounded-lg text-sm font-semibold min-h-[44px]"
                  style={tab === k ? { background: '#fff', color: 'var(--ink)', boxShadow: '0 1px 3px rgba(17,24,39,.12)' } : muted}>
            {t(`orderTexts.tab.${k}`)}{k === 'history' && historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
        ))}
      </div>
      <p className="text-[12px] mb-3" style={muted} data-testid="texts-tab-hint">{t(`orderTexts.tabHint.${tab}`)}</p>

      {tab === 'alerts' && (
        <div role="tabpanel" data-testid="texts-panel-alerts">
          <div>
            {/* Confirm each order, or take every one automatically (Tzvi, 7 Nov 2026). */}
            <div className="flex items-start gap-3 pb-3 mb-1 border-b" style={{ borderColor: 'var(--brand-border)' }}>
              <div className="flex-1 min-w-0">
                <p id="auto-confirm-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.auto', 'Accept orders automatically')}</p>
                <p className="text-[12px] mt-0.5" style={muted}>{autoConfirm
                  ? t('orderTexts.autoOnHint', 'On: every new order is confirmed the moment it arrives. The customer is told right away, and you get a heads-up to follow it.')
                  : t('orderTexts.autoOffHint', 'Off: you confirm or decline each new order yourself.')}</p>
              </div>
              <Switch checked={autoConfirm} onToggle={() => setAutoConfirm((v) => !v)} labelledBy="auto-confirm-label" testid="settings-auto-confirm" />
            </div>

            <div className="flex items-start gap-3 mt-3">
              <div className="flex-1 min-w-0">
                <p id="text-on-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.on', 'Text me new orders and bookings')}</p>
                <p className="text-[12px] mt-0.5" style={muted}>{on
                  ? t('orderTexts.onHint2', 'On: you get a text for each new order and booking, your customers get theirs by text, and they stay on the site after they order.')
                  : t('orderTexts.offHint2', 'Off: no texts to you or your customers, and after they order or book, customers are sent to your WhatsApp.')}</p>
              </div>
              <Switch checked={on} onToggle={() => setOn((v) => !v)} labelledBy="text-on-label" testid="settings-text-on" />
            </div>

            {on && (
              <fieldset className="mt-3" data-testid="settings-text-number">
                <legend className="text-[12px] mb-1" style={muted}>{t('orderTexts.body', 'Each new order is texted to this number, with a link to confirm or decline it.')}</legend>
                <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
                  <input type="radio" name="settings-text-number" checked={!different} onChange={() => setDifferent(false)} data-testid="settings-text-same" />
                  <span>{t('orderTexts.same', 'Same as my WhatsApp number')}{loaded.whatsapp_number && <span dir="ltr" className="ms-1" style={muted}>{loaded.whatsapp_number}</span>}</span>
                </label>
                {!different && !loaded.whatsapp_number && (
                  <p className="text-[12px] mb-1" role="status" style={{ color: 'var(--ink)' }} data-testid="settings-text-no-whatsapp">{t('orderTexts.noWhatsapp', 'This business has no WhatsApp number yet, so no texts can go out. Add one to your listing, or choose a different number.')}</p>
                )}
                <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
                  <input type="radio" name="settings-text-number" checked={different} onChange={() => setDifferent(true)} data-testid="settings-text-different" />
                  {t('orderTexts.different', 'A different number')}
                </label>
                {different && (
                  <input type="tel" dir="ltr" inputMode="tel" maxLength={30} value={number} onChange={(e) => setNumber(e.target.value)}
                         className="px-2 min-h-[40px] rounded-lg border bg-white w-full sm:w-64" style={{ ...fieldStyle, fontSize: 16 }}
                         placeholder="05X-XXX-XXXX" aria-label={t('orderTexts.numberLabel', 'Number for texts')} data-testid="settings-text-input" />
                )}
              </fieldset>
            )}

            {/* Emails: on unless switched off, to the sign-in address unless another is chosen. */}
            <div className="flex items-start gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }}>
              <div className="flex-1 min-w-0">
                <p id="email-on-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.emailOn', 'Email me new orders and bookings')}</p>
                <p className="text-[12px] mt-0.5" style={muted}>{emailOn
                  ? t('orderTexts.emailOnHint', 'On: each new order and booking is emailed to you, with a button to confirm or decline it.')
                  : t('orderTexts.emailOffHint', 'Off: no emails to you. Customers still get their own emails.')}</p>
              </div>
              <Switch checked={emailOn} onToggle={() => setEmailOn((v) => !v)} labelledBy="email-on-label" testid="settings-email-on" />
            </div>

            {emailOn && (
              <fieldset className="mt-3" data-testid="settings-email-to">
                <legend className="text-[12px] mb-1" style={muted}>{t('orderTexts.emailBody', 'Where your emails go')}</legend>
                <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
                  <input type="radio" name="settings-email-to" checked={!emailDifferent} onChange={() => setEmailDifferent(false)} data-testid="settings-email-same" />
                  <span>{t('orderTexts.emailSame', 'The email I sign in with')}{loaded.account_email && <span dir="ltr" className="ms-1" style={muted}>{loaded.account_email}</span>}</span>
                </label>
                <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
                  <input type="radio" name="settings-email-to" checked={emailDifferent} onChange={() => setEmailDifferent(true)} data-testid="settings-email-different" />
                  {t('orderTexts.emailDifferent', 'A different email')}
                </label>
                {emailDifferent && (
                  <input type="email" dir="ltr" inputMode="email" maxLength={200} value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                         className="px-2 min-h-[40px] rounded-lg border bg-white w-full sm:w-72" style={{ ...fieldStyle, fontSize: 16 }}
                         placeholder="orders@example.com" aria-label={t('orderTexts.emailLabel', 'Email for orders')} data-testid="settings-email-input" />
                )}
              </fieldset>
            )}
          </div>
          <MessagePreview loaded={loaded} templates={templates} note={note} fixedWho="owner" />
        </div>
      )}

      {tab === 'messages' && (
        <div role="tabpanel" data-testid="texts-panel-messages">
          {/* One own line for customers' texts and emails alike. */}
          <div className="mb-4" data-testid="settings-text-note">
            <label htmlFor="settings-text-note-input" className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.noteLabel', 'Your own line on texts and emails to customers')}</label>
            <p className="text-[12px] mt-0.5 mb-1" style={muted}>{t('orderTexts.noteHint', 'Added to texts and emails when an order or booking is confirmed, and to reminders. Optional.')}</p>
            <input id="settings-text-note-input" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)}
                   className="px-2 min-h-[40px] rounded-lg border bg-white w-full" style={{ ...fieldStyle, fontSize: 16 }} dir="auto"
                   placeholder={t('orderTexts.notePlaceholder', 'For example: Pickup at Farn 5, ring the bell')} data-testid="settings-text-note-input" />
            <p className="text-[11px] mt-1 text-end" style={muted}>{note.length}/80</p>
          </div>
          {/* Your email look (Tzvi, 23 Nov 2026, from Shopify's email templates): off unless turned on, so the emails
              of businesses already approved stay as they are. Shown on every customer email (order_emails.email_brand). */}
          <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="email-look">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p id="email-look-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.lookTitle', 'Your email look')}</p>
                <p className="text-[12px] mt-0.5" style={muted}>{look.on
                  ? t('orderTexts.lookOnHint', 'On: your logo and colour head every email your customers get, and the button takes your colour.')
                  : t('orderTexts.lookOffHint', 'Off: customer emails carry the MyIsraelRental header. Turn on to put your own logo and colour on them.')}</p>
              </div>
              <Switch checked={look.on} onToggle={() => setLook((l) => ({ ...l, on: !l.on }))} labelledBy="email-look-label" testid="email-look-on" />
            </div>
            {look.on && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('orderTexts.lookLogo', 'Logo size')}</p>
                  {loaded.logo_url ? (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('orderTexts.lookLogo', 'Logo size')}>
                      {['small', 'medium', 'large', 'none'].map((k) => (
                        <button key={k} type="button" onClick={() => setLook((l) => ({ ...l, logo: k }))} aria-pressed={look.logo === k} data-testid={`email-look-logo-${k}`}
                                className="px-3 min-h-[36px] rounded-full border text-[13px] font-semibold"
                                style={look.logo === k ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : fieldStyle}>
                          {t(`orderTexts.lookSize.${k}`)}
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-[12px]" style={muted}>{t('orderTexts.lookNoLogo', 'Add a logo in your business details to show it on your emails.')}</p>}
                </div>
                <label className="flex flex-wrap items-center gap-2 text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {t('orderTexts.lookColour', 'Your colour')}
                  <input type="color" value={look.accent} onChange={(e) => setLook((l) => ({ ...l, accent: e.target.value.toUpperCase() }))}
                         className="w-10 h-10 rounded-lg border p-0.5 bg-white cursor-pointer" style={{ borderColor: 'var(--brand-border)' }} data-testid="email-look-colour" />
                  <span dir="ltr" className="font-normal" style={muted}>{look.accent}</span>
                </label>
                <MessagePreview loaded={loaded} templates={templates} note={note} msgKey="order_confirmed" lang={msgLang} fixedWho="customer" look={look} initialHow="email" />
              </div>
            )}
          </div>
          {/* The phone preview sits in the open message, under its words: this panel is too narrow, even on a laptop,
              for a preview beside the list (it squeezed every message into a thin column, 23 Nov 2026). */}
          <CustomerMessages API={API} auth={auth} businessId={businessId} defaults={loaded.text_defaults} templates={templates} setTemplates={setTemplates}
                            off={off} setOff={setOff} reminders={reminders} setReminders={setReminders} counts={counts} textsOn={on}
                            businessName={loaded.business_name} businessNameHe={loaded.business_name_he} lang={msgLang} setLang={setMsgLang}
                            openKey={openKey} setOpenKey={setOpenKey} onTurnTextsOn={() => setOn(true)}
                            renderPreview={(k, editor) => <MessagePreview loaded={loaded} templates={templates} note={note} msgKey={k} lang={msgLang} fixedWho="customer" look={look} editor={editor} />} />
        </div>
      )}

      {tab === 'history' && (
        <div role="tabpanel" data-testid="texts-panel-history">
          {historyCount === 0 && <p className="text-sm py-6 text-center" style={muted}>{t('orderTexts.noHistory', 'Nothing sent yet. Texts and emails show here once they go out.')}</p>}
          {recent && (recent.texts.length > 0 || recent.replies.length > 0) && <RecentTexts recent={recent} />}
          {recentEmails.length > 0 && <RecentEmails emails={recentEmails} />}
        </div>
      )}

      {/* The save bar: only while something is changed, pinned to the bottom of the screen so it is always in reach. */}
      {dirty && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 px-4 py-3 border-t bg-white flex flex-wrap items-center justify-between gap-2"
             style={{ borderColor: 'var(--brand-border)', boxShadow: '0 -4px 12px rgba(17,24,39,.06)' }} data-testid="texts-save-bar">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.unsaved', 'You have changes that are not saved')}</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => apply(JSON.parse(saved.current))} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full text-sm font-semibold border" style={fieldStyle} data-testid="texts-undo-all">
              <RotateCcw size={14} /> {t('orderTexts.undoAll', 'Undo all changes')}
            </button>
            <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="settings-text-save">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('orders.saveSettings', 'Save')}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE = {
  delivered: { background: '#E6F4EA', color: '#2E7D4F' },
  failed: { background: '#FDECEA', color: '#B42318' },
  sent: { background: '#F3F4F6', color: 'var(--brand-muted)' },
};

function when(at, lang) {
  try {
    return new Date(at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

/** The last texts, each with whether it reached the phone, and what customers replied. */
function RecentTexts({ recent }) {
  const { t, i18n } = useTranslation();
  const status = (r) => {
    if (r.status === 'delivered') return t('orderTexts.delivered', 'Delivered');
    if (r.status === 'failed') {
      return {
        unreachable: t('orderTexts.failUnreachable', 'Not delivered: the phone was off or the number is wrong'),
        blocked: t('orderTexts.failBlocked', 'Not delivered: this number does not take texts'),
        kosher: t('orderTexts.failKosher', 'Not delivered: a kosher phone that cannot get texts'),
        service: t('orderTexts.failService', 'Not delivered: a problem on our side, we are on it'),
      }[r.problem] || t('orderTexts.failed', 'Not delivered');
    }
    return r.reports ? t('orderTexts.waiting', 'Sent, waiting for the phone company') : t('orderTexts.sent', 'Sent');
  };
  return (
    <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="recent-texts">
      {recent.replies.length > 0 && (
        <>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>{t('orderTexts.replies', 'Customer replies')}</h4>
          <ul className="space-y-2 mb-4">
            {recent.replies.map((r, i) => (
              <li key={i} className="rounded-xl px-3 py-2 text-[13px]" style={{ background: 'rgba(36,175,235,.12)', color: 'var(--ink)' }} dir="auto">
                <span className="block text-[11px]" style={{ color: 'var(--brand-muted)' }}>
                  <span dir="ltr">…{r.from_end}</span>{r.label ? ` · ${r.label}` : ''} · {when(r.at, i18n.language)}
                </span>
                <span className="block" dir="auto">{r.content}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {recent.texts.length > 0 && (
        <>
          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>{t('orderTexts.recent', 'Recent texts')}</h4>
          <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {recent.texts.map((r, i) => (
              <li key={i} className="py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]" data-testid="recent-text">
                <span style={{ color: 'var(--ink)' }}>
                  {r.who === 'business' ? t('orderTexts.toYou', 'To you') : t('orderTexts.toCustomer', 'To a customer')}{' '}
                  <span dir="ltr" style={{ color: 'var(--brand-muted)' }}>…{r.to_end}</span>
                  {r.label ? <span style={{ color: 'var(--brand-muted)' }}> · {r.label}</span> : null}
                  <span style={{ color: 'var(--brand-muted)' }}> · {when(r.at, i18n.language)}</span>
                </span>
                <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={STATUS_STYLE[r.status] || STATUS_STYLE.sent}>{status(r)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** The last order and booking emails, each with the email service's report. */
function RecentEmails({ emails }) {
  const { t, i18n } = useTranslation();
  const label = {
    delivered: t('orderTexts.delivered', 'Delivered'),
    bounced: t('orderTexts.bounced', 'Not delivered: the address is wrong or the inbox is full'),
    spam: t('orderTexts.spam', 'Marked as spam by the reader'),
    sent: t('orderTexts.sent', 'Sent'),
  };
  const look = { delivered: 'delivered', bounced: 'failed', spam: 'failed' };
  return (
    <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="recent-emails">
      <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>{t('orderTexts.recentEmails', 'Recent emails')}</h4>
      <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {emails.map((r, i) => (
          <li key={i} className="py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]" data-testid="recent-email">
            <span style={{ color: 'var(--ink)' }}>
              {r.who === 'business' ? t('orderTexts.toYou', 'To you') : t('orderTexts.toCustomer', 'To a customer')}{' '}
              <span dir="ltr" style={{ color: 'var(--brand-muted)' }}>{r.to_end}</span>
              {r.label ? <span style={{ color: 'var(--brand-muted)' }}> · {r.label}</span> : null}
              <span style={{ color: 'var(--brand-muted)' }}> · {when(r.at, i18n.language)}</span>
            </span>
            <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={STATUS_STYLE[look[r.status] || 'sent']}>{label[r.status] || label.sent}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
