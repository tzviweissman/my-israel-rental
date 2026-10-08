/**
 * "Get listed": a restaurant owner sends their details and hechsher; it
 * waits in the admin queue (POST /restaurants/submissions) and is listed
 * only once a person approves it.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';
import { apiErrorMessage } from '../../utils/apiError';

const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/0.2)]';
const label = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5';

export default function GetListedForm({ cities, defaultCity, onDone }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    name: '', city: defaultCity || '', address: '', phone: '', whatsapp: '', website: '',
    certification: '', kashrut: '', contact_email: '', note: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await axios.post(`${API}/restaurants/submissions`, { ...f, kashrut: f.kashrut || null });
      setSent(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('restaurants.sendFailed', 'That did not send. Please try again.'), t));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-5 rounded-xl p-4 text-sm" style={{ background: '#E3F3EA', color: '#1F8A50' }} data-testid="get-listed-sent">
        {t('restaurants.sent', 'Thank you. We check the hechsher and add you; we will email you when you are listed.')}
        <button type="button" onClick={onDone} className="ms-3 font-semibold underline">{t('restaurants.close', 'Close')}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="get-listed-form">
      <label><span className={label}>{t('restaurants.fName', 'Restaurant name')}</span>
        <input required minLength={2} value={f.name} onChange={set('name')} className={field} /></label>
      <label><span className={label}>{t('restaurants.city', 'City')}</span>
        <select required value={f.city} onChange={set('city')} className={field}>
          <option value="">{t('restaurants.chooseCity', 'Choose a city')}</option>
          {cities.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
        </select></label>
      <label className="sm:col-span-2"><span className={label}>{t('restaurants.fAddress', 'Address')}</span>
        <input value={f.address} onChange={set('address')} className={field} /></label>
      <label><span className={label}>{t('restaurants.fCert', 'Hechsher')}</span>
        <input required minLength={2} value={f.certification} onChange={set('certification')} className={field}
          placeholder={t('restaurants.fCertPh', 'Rabbanut Yerushalayim, Mehadrin')} /></label>
      <label><span className={label}>{t('restaurants.fKashrut', 'Meat, dairy or pareve')}</span>
        <select value={f.kashrut} onChange={set('kashrut')} className={field}>
          <option value="">{t('restaurants.notSet', 'Choose')}</option>
          <option value="meat">{t('restaurants.meat', 'Meat')}</option>
          <option value="dairy">{t('restaurants.dairy', 'Dairy')}</option>
          <option value="pareve">{t('restaurants.pareve', 'Pareve')}</option>
        </select></label>
      <label><span className={label}>{t('restaurants.fPhone', 'Phone')}</span>
        <input type="tel" value={f.phone} onChange={set('phone')} className={field} /></label>
      <label><span className={label}>WhatsApp</span>
        <input type="tel" value={f.whatsapp} onChange={set('whatsapp')} className={field} /></label>
      <label><span className={label}>{t('restaurants.fWebsite', 'Website')}</span>
        <input type="url" value={f.website} onChange={set('website')} className={field} placeholder="https://" /></label>
      <label><span className={label}>{t('restaurants.fEmail', 'Your email (not shown)')}</span>
        <input type="email" required value={f.contact_email} onChange={set('contact_email')} className={field} /></label>
      <label className="sm:col-span-2"><span className={label}>{t('restaurants.fNote', 'Anything we should know')}</span>
        <textarea rows={3} value={f.note} onChange={set('note')} className={field} /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={sending}
          className="rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-[0.97]"
          style={{ background: '#000' }} data-testid="get-listed-submit">
          {sending ? t('restaurants.sending', 'Sending…') : t('restaurants.send', 'Send for review')}
        </button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-gray-600">{t('restaurants.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}
