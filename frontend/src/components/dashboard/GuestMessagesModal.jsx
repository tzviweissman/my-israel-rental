/**
 * A stay's automatic messages to guests (backend routes/guest_messages.py):
 * the check-in instructions only a confirmed guest receives, and the three
 * messages (day before arrival, first evening, checkout morning), each on
 * or off and in the host's own words if they like. Opened from the
 * property's card.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

const TRIGGERS = ['before', 'evening', 'checkout'];
const box = 'w-full px-3 py-2 rounded-lg border text-sm bg-white';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function GuestMessagesModal({ property, API, token, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').startsWith('he') ? 'he' : 'en';
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const url = `${API}/properties/${property.id}/guest-messages`;
  const [s, setS] = useState(null);
  const [own, setOwn] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(url, { ...auth, params: { lang } }).then(({ data }) => {
      setS(data);
      setOwn(Object.fromEntries(TRIGGERS.map((k) => [k, !!(data[k].text || data[k].subject)])));
    }).catch(() => setS(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, lang]);

  const upd = (k, patch) => setS({ ...s, [k]: { ...s[k], ...patch } });
  // The ready-made message as a guest will read it: this property's own
  // details in place of the {words}, and an example guest name.
  const fill = (text) => String(text || '').replace(/\{(\w+)\}/g, (m, k) => ({
    name: lang === 'he' ? 'נועה' : 'Noa',
    property: property.title || '',
    address: property.address || property.location || '',
    checkin: property.checkin_time || '15:00',
    checkout: property.checkout_time || '11:00',
    instructions: (s && s.instructions) || t('guestMsg.yourInstructions', '(your check-in instructions)'),
  }[k] ?? m)).split('\n').filter((line) => !/:\s*$/.test(line)).join('\n');
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        instructions: s.instructions || '',
        ...Object.fromEntries(TRIGGERS.map((k) => [k, {
          on: !!s[k].on, subject: own[k] ? s[k].subject || '' : '', text: own[k] ? s[k].text || '' : '',
        }])),
      };
      await axios.put(url, body, auth);
      toast.success(t('auto.saved', 'Saved'));
      onClose();
    } catch { toast.error(t('auto.failed', 'Could not save. Try again.')); } finally { setBusy(false); }
  };
  const names = {
    before: [t('guestMsg.before', 'The day before arrival'), t('guestMsg.beforeWhen', 'At 10:00, with the address, check-in time and your instructions')],
    evening: [t('guestMsg.evening', 'The first evening'), t('guestMsg.eveningWhen', 'At 19:00 on the arrival day: is everything all right?')],
    checkout: [t('guestMsg.checkout', 'Checkout morning'), t('guestMsg.checkoutWhen', 'At 08:00 on the checkout day, with the checkout time')],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(17,24,39,.45)' }} role="dialog" aria-modal="true"
         aria-label={t('guestMsg.title', 'Messages to guests')} data-testid="guest-messages-modal">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b sticky top-0 bg-white" style={{ borderColor: 'var(--brand-border)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{t('guestMsg.title', 'Messages to guests')}</h2>
            <p className="text-xs truncate" style={{ color: 'var(--brand-muted)' }}>{property.title}</p>
          </div>
          <button type="button" onClick={onClose} className="grid place-content-center w-11 h-11" aria-label={t('orders.close', 'Close')}><X size={18} /></button>
        </div>
        {s === null ? <div className="p-8 text-center"><Loader2 className="animate-spin inline" size={18} /></div>
          : s === false ? <p className="p-5 text-sm" style={{ color: 'var(--brand-muted)' }}>{t('auto.failed', 'Could not save. Try again.')}</p> : (
            <div className="p-5 space-y-4 text-sm" style={{ color: 'var(--ink)' }}>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('guestMsg.body', 'Sent by email on their own to guests with a confirmed booking, in the guest’s language. Their replies come to your email.')}
              </p>
              <label className="block">
                <span className="font-semibold">{t('guestMsg.instructions', 'Check-in instructions')}</span>
                <span className="block text-xs mb-1" style={{ color: 'var(--brand-muted)' }}>{t('guestMsg.instructionsHint', 'Key or door code, parking, Wi-Fi. Only a guest with a confirmed booking gets this, the day before.')}</span>
                <textarea rows={4} maxLength={3000} dir="auto" className={box} style={boxStyle} value={s.instructions || ''}
                          onChange={(e) => setS({ ...s, instructions: e.target.value })} data-testid="guest-instructions" />
              </label>
              {TRIGGERS.map((k) => (
                <div key={k} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand-border)' }} data-testid={`guest-msg-${k}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{names[k][0]}</p>
                      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{names[k][1]}</p>
                    </div>
                    <label className="shrink-0 inline-flex items-center gap-2 min-h-[44px]">
                      <input type="checkbox" checked={!!s[k].on} onChange={(e) => upd(k, { on: e.target.checked })} data-testid={`guest-msg-on-${k}`} /> {t('auto.on', 'On')}
                    </label>
                  </div>
                  {s[k].on && (
                    <>
                      <label className="inline-flex items-center gap-2 text-xs min-h-[36px]">
                        <input type="checkbox" checked={!!own[k]} onChange={(e) => setOwn({ ...own, [k]: e.target.checked })} /> {t('auto.ownWords', 'Use my own words')}
                      </label>
                      {own[k] ? (
                        <>
                          <input value={s[k].subject || ''} maxLength={150} dir="auto" className={box} style={boxStyle} placeholder={s[k].default_subject}
                                 onChange={(e) => upd(k, { subject: e.target.value })} aria-label={t('messages.subject', 'Subject')} />
                          <textarea rows={5} maxLength={3000} dir="auto" className={box} style={boxStyle} placeholder={s[k].default_text}
                                    value={s[k].text || ''} onChange={(e) => upd(k, { text: e.target.value })} aria-label={t('messages.body', 'Message')} />
                          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('guestMsg.words', 'You can use {name}, {property}, {address}, {checkin}, {checkout} and {instructions}.')}</p>
                        </>
                      ) : (
                        <p className="text-xs whitespace-pre-line rounded-lg p-2" dir="auto" style={{ background: '#F9FAFB' }}>
                          <b>{fill(s[k].default_subject)}</b>{'\n'}{fill(s[k].default_text)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
              <button type="button" onClick={save} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="guest-messages-save">
                {busy && <Loader2 size={15} className="animate-spin" />} {t('auto.save', 'Save')}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
