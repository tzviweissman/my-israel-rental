/**
 * Text notifications for one business, its own section on the business card
 * (Tzvi, 6 Nov 2026), apart from hours and fees. On, the business hears about
 * new orders and bookings by text and its customers stay on the site after
 * ordering; off, they are sent on to its WhatsApp.
 *
 * Emails (Tzvi, 11 Nov 2026, "like we have for automated texts"): the
 * business's own emails can be switched off and sent to another address;
 * customers always get theirs, in the same wording and own line as the texts
 * (backend routes/marketplace/order_emails.py).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, Loader2, X } from 'lucide-react';
import TextTemplatesEditor from './TextTemplatesEditor';

export default function TextNotificationsPanel({ API, token, businessId, onClose }) {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [loaded, setLoaded] = useState(null);
  const [on, setOn] = useState(false);
  const [different, setDifferent] = useState(false);
  const [number, setNumber] = useState('');
  const [note, setNote] = useState('');
  const [templates, setTemplates] = useState({});
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [recent, setRecent] = useState(null);
  const [emailOn, setEmailOn] = useState(true);
  const [emailDifferent, setEmailDifferent] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [recentEmails, setRecentEmails] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/marketplace/businesses/${businessId}/orders/settings`, auth).then(({ data }) => {
      setOn(!!data.text_on);
      setDifferent(!!data.text_number);
      setNumber(data.text_number || '');
      setNote(data.text_note || '');
      setTemplates(data.text_templates || {});
      setAutoConfirm(!!data.auto_confirm);
      setEmailOn(data.email_on !== false);
      setEmailDifferent(!!data.email_to);
      setEmailTo(data.email_to || '');
      setLoaded(data);
    }).catch(() => setLoaded(false));
    // Whether each text arrived (Cellact's delivery reports, 7 Nov 2026), and customers' replies.
    axios.get(`${API}/marketplace/businesses/${businessId}/orders/texts/recent`, auth)
      .then(({ data }) => setRecent(data)).catch(() => setRecent(null));
    axios.get(`${API}/marketplace/businesses/${businessId}/orders/emails/recent`, auth)
      .then(({ data }) => setRecentEmails(data.emails || [])).catch(() => setRecentEmails([]));
  }, [API, auth, businessId]);

  if (loaded === false) return null;
  if (!loaded) return <div className="py-4 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 size={16} className="animate-spin inline" /></div>;

  const save = async () => {
    if (on && different && number.replace(/\D/g, '').length < 9) {
      toast.error(t('orderTexts.enterNumber', 'Please enter a mobile number with the leading 0 or a country code'));
      return;
    }
    if (emailOn && emailDifferent && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTo.trim())) {
      toast.error(t('orderTexts.enterEmail', 'Please enter an email address'));
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.put(`${API}/marketplace/businesses/${businessId}/orders/texts`, {
        text_on: on, text_number: on && different ? number.trim() : null, text_note: note.trim() || null, text_templates: templates, auto_confirm: autoConfirm,
      }, auth);
      const { data: withEmails } = await axios.put(`${API}/marketplace/businesses/${businessId}/orders/emails`, {
        email_on: emailOn, email_to: emailOn && emailDifferent ? emailTo.trim() : null,
      }, auth);
      setTemplates(data.text_templates || {});
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

  return (
    <div className="rounded-2xl border p-4 mb-4 bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="text-notifications-panel">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{t('orderTexts.title', 'Texts and emails')}</h3>
        {onClose && <button type="button" onClick={onClose} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 rounded-full shrink-0" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.close', 'Close')}><X size={18} /></button>}
      </div>

      {/* Confirm each order, or take every one automatically (Tzvi, 7 Nov 2026). */}
      <div className="flex items-start gap-3 mt-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--brand-border)' }}>
        <div className="flex-1 min-w-0">
          <p id="auto-confirm-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.auto', 'Accept orders automatically')}</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>{autoConfirm
            ? t('orderTexts.autoOnHint', 'On: every new order is confirmed the moment it arrives. The customer is told right away, and you get a heads-up to follow it.')
            : t('orderTexts.autoOffHint', 'Off: you confirm or decline each new order yourself.')}</p>
        </div>
        <button type="button" role="switch" aria-checked={autoConfirm} aria-labelledby="auto-confirm-label" onClick={() => setAutoConfirm((v) => !v)}
                className="shrink-0 -my-2.5 inline-flex min-h-[44px] min-w-[52px] items-center justify-center" data-testid="settings-auto-confirm">
          <span className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${autoConfirm ? 'justify-end' : 'justify-start'}`}
            style={{ background: autoConfirm ? 'var(--brand-primary)' : 'var(--brand-muted)' }}>
            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        </button>
      </div>

      <div className="flex items-start gap-3 mt-3">
        <div className="flex-1 min-w-0">
          <p id="text-on-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.on', 'Text me new orders and bookings')}</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>{on
            ? t('orderTexts.onHint', 'On: customers stay on the site after they order or book, and are not sent to WhatsApp.')
            : t('orderTexts.offHint', 'Off: after they order or book, customers are sent to your WhatsApp.')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="text-on-label"
          onClick={() => setOn((v) => !v)}
          className="shrink-0 -my-2.5 inline-flex min-h-[44px] min-w-[52px] items-center justify-center"
          data-testid="settings-text-on"
        >
          <span className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${on ? 'justify-end' : 'justify-start'}`}
            style={{ background: on ? 'var(--brand-primary)' : 'var(--brand-muted)' }}>
            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        </button>
      </div>

      {on && (
        <fieldset className="mt-3" data-testid="settings-text-number">
          <legend className="text-[12px] mb-1" style={{ color: 'var(--brand-muted)' }}>{t('orderTexts.body', 'Each new order is texted to this number, with a link to confirm or decline it.')}</legend>
          <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
            <input type="radio" name="settings-text-number" checked={!different} onChange={() => setDifferent(false)} data-testid="settings-text-same" />
            <span>{t('orderTexts.same', 'Same as my WhatsApp number')}{loaded.whatsapp_number && <span dir="ltr" className="ms-1" style={{ color: 'var(--brand-muted)' }}>{loaded.whatsapp_number}</span>}</span>
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
                   className="px-2 min-h-[40px] rounded-lg border text-sm bg-white w-full sm:w-64" style={fieldStyle}
                   placeholder="05X-XXX-XXXX" aria-label={t('orderTexts.numberLabel', 'Number for texts')} data-testid="settings-text-input" />
          )}
        </fieldset>
      )}

      {/* Emails: on unless switched off, to the sign-in address unless another is chosen. */}
      <div className="flex items-start gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }}>
        <div className="flex-1 min-w-0">
          <p id="email-on-label" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.emailOn', 'Email me new orders and bookings')}</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>{emailOn
            ? t('orderTexts.emailOnHint', 'On: each new order and booking is emailed to you, with a button to confirm or decline it.')
            : t('orderTexts.emailOffHint', 'Off: no emails to you. Customers still get their own emails.')}</p>
        </div>
        <button type="button" role="switch" aria-checked={emailOn} aria-labelledby="email-on-label" onClick={() => setEmailOn((v) => !v)}
                className="shrink-0 -my-2.5 inline-flex min-h-[44px] min-w-[52px] items-center justify-center" data-testid="settings-email-on">
          <span className={`inline-flex h-6 w-11 items-center rounded-full px-1 ${emailOn ? 'justify-end' : 'justify-start'}`}
            style={{ background: emailOn ? 'var(--brand-primary)' : 'var(--brand-muted)' }}>
            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        </button>
      </div>

      {emailOn && (
        <fieldset className="mt-3" data-testid="settings-email-to">
          <legend className="text-[12px] mb-1" style={{ color: 'var(--brand-muted)' }}>{t('orderTexts.emailBody', 'Where your emails go')}</legend>
          <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
            <input type="radio" name="settings-email-to" checked={!emailDifferent} onChange={() => setEmailDifferent(false)} data-testid="settings-email-same" />
            <span>{t('orderTexts.emailSame', 'The email I sign in with')}{loaded.account_email && <span dir="ltr" className="ms-1" style={{ color: 'var(--brand-muted)' }}>{loaded.account_email}</span>}</span>
          </label>
          <label className="flex items-center gap-2 min-h-[44px] text-sm" style={{ color: 'var(--ink)' }}>
            <input type="radio" name="settings-email-to" checked={emailDifferent} onChange={() => setEmailDifferent(true)} data-testid="settings-email-different" />
            {t('orderTexts.emailDifferent', 'A different email')}
          </label>
          {emailDifferent && (
            <input type="email" dir="ltr" inputMode="email" maxLength={200} value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                   className="px-2 min-h-[40px] rounded-lg border text-sm bg-white w-full sm:w-72" style={fieldStyle}
                   placeholder="orders@example.com" aria-label={t('orderTexts.emailLabel', 'Email for orders')} data-testid="settings-email-input" />
          )}
        </fieldset>
      )}

      {/* One wording and one own line for customers' texts and emails alike, so it shows with texts off too. */}
        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="settings-text-note">
          <label htmlFor="settings-text-note-input" className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.noteLabel', 'Your own line on texts and emails to customers')}</label>
          <p className="text-[12px] mt-0.5 mb-1" style={{ color: 'var(--brand-muted)' }}>{t('orderTexts.noteHint', 'Added to texts and emails when an order or booking is confirmed, and to reminders. Optional.')}</p>
          <input id="settings-text-note-input" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)}
                 className="px-2 min-h-[40px] rounded-lg border text-sm bg-white w-full" style={fieldStyle} dir="auto"
                 placeholder={t('orderTexts.notePlaceholder', 'For example: Pickup at Farn 5, ring the bell')} data-testid="settings-text-note-input" />
          <p className="text-[11px] mt-1 text-end" style={{ color: 'var(--brand-muted)' }}>{note.length}/80</p>
          {note.trim() && (
            <div className="mt-1 rounded-xl px-3 py-2 text-[13px] whitespace-pre-line" style={{ background: 'var(--surface-alt, #F9FAFB)', color: 'var(--ink)' }} dir="auto" data-testid="settings-text-preview">
              <span className="block text-[11px] font-semibold mb-0.5" style={{ color: 'var(--brand-muted)' }}>{t('orderTexts.preview', 'What your customer gets')}</span>
              {t('orderTexts.previewText', 'Your order #1042 is confirmed. Your tracking link: myisraelrental.com/…')}{'\n'}{note.trim()}
            </div>
          )}
          <TextTemplatesEditor defaults={loaded.text_defaults} templates={templates} setTemplates={setTemplates}
                               businessName={loaded.business_name} businessNameHe={loaded.business_name_he} />
        </div>

      <div className="mt-4">
        <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="settings-text-save">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('orders.saveSettings', 'Save')}
        </button>
      </div>

      {recent && (recent.texts.length > 0 || recent.replies.length > 0) && <RecentTexts recent={recent} />}
      {recentEmails.length > 0 && <RecentEmails emails={recentEmails} />}
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
