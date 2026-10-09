/**
 * Two small forms that open inside a restaurant card:
 *   report  "Report a change": closed, hechsher changed, not kosher, wrong details.
 *   claim   "Is this your restaurant?": the owner asks to manage the listing.
 * Both go to the admin tab; nothing on the listing changes until a person acts.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';
import { apiErrorMessage } from '../../utils/apiError';

const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-primary)]';

export default function RestaurantFeedback({ id, mode, onDone }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ kind: '', note: '', email: '', name: '', phone: '', role: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'report') {
        await axios.post(`${API}/restaurants/${encodeURIComponent(id)}/reports`, { kind: f.kind, note: f.note, email: f.email });
      } else {
        await axios.post(`${API}/restaurants/${encodeURIComponent(id)}/claims`,
          { name: f.name, email: f.email, phone: f.phone, role: f.role, note: f.note });
      }
      setDone(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('restaurants.sendFailed', 'That did not send. Please try again.'), t));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="mt-3 rounded-xl p-3 text-sm" style={{ background: '#E3F3EA', color: '#1F8A50' }} role="status">
        {mode === 'report'
          ? t('restaurants.reportThanks', 'Thank you. We check it and update the listing.')
          : t('restaurants.claimThanks', 'Thank you. We confirm it is yours and email you.')}
      </p>
    );
  }

  return (
    <form onSubmit={send} className="mt-3 grid gap-2 rounded-xl p-3" style={{ background: '#F9FAFB' }} data-testid={`restaurant-${mode}-form`}>
      {mode === 'report' ? (
        <>
          <select required value={f.kind} onChange={set('kind')} className={field} aria-label={t('restaurants.whatChanged', 'What changed?')}>
            <option value="">{t('restaurants.whatChanged', 'What changed?')}</option>
            <option value="closed">{t('restaurants.rClosed', 'It has closed')}</option>
            <option value="hechsher_changed">{t('restaurants.rHechsher', 'The hechsher changed')}</option>
            <option value="not_kosher">{t('restaurants.rNotKosher', 'It is not kosher')}</option>
            <option value="wrong_details">{t('restaurants.rDetails', 'Phone, website or address is wrong')}</option>
            <option value="other">{t('restaurants.rOther', 'Something else')}</option>
          </select>
          <textarea rows={2} value={f.note} onChange={set('note')} className={field} placeholder={t('restaurants.rNote', 'What did you see? (optional)')} />
          <input type="email" value={f.email} onChange={set('email')} className={field} placeholder={t('restaurants.rEmail', 'Your email, if we may ask you (optional)')} />
        </>
      ) : (
        <>
          <input required minLength={2} value={f.name} onChange={set('name')} className={field} placeholder={t('restaurants.cName', 'Your name')} />
          <input required type="email" value={f.email} onChange={set('email')} className={field} placeholder={t('restaurants.cEmail', 'Your email')} />
          <input type="tel" value={f.phone} onChange={set('phone')} className={field} placeholder={t('restaurants.cPhone', 'Phone (optional)')} />
          <input value={f.role} onChange={set('role')} className={field} placeholder={t('restaurants.cRole', 'Your role, e.g. owner or manager')} />
        </>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-60 active:scale-[0.97]">
          {busy ? t('restaurants.sending', 'Sending…') : t('restaurants.send2', 'Send')}
        </button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-gray-600">{t('restaurants.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}
