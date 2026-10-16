/**
 * "None of these times work? Join the waiting list" under an appointment
 * picker (backend routes/marketplace/appointment_extras.py). A name and an
 * email for one day; when a time frees up that day the customer is emailed.
 * No account.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, BellPlus } from 'lucide-react';
import { API } from '../../lib/apiBase';

export default function WaitlistForm({ gigId, days, defaultDay, staffId }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(defaultDay || (days[0] && days[0].iso) || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!days.length) return null;

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await axios.post(`${API}/marketplace/gigs/${gigId}/waitlist`, {
        date: day, name: name.trim(), email: email.trim(),
        lang: String(i18n.language || 'en').startsWith('he') ? 'he' : 'en',
        staff_id: staffId && staffId !== 'any' ? staffId : null,
      });
      setDone(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('waitlist.failed', 'Could not add you. Try again.'));
    } finally { setBusy(false); }
  };

  if (done) {
    return <p className="text-xs pt-2" style={{ color: '#2E7D4F' }} data-testid="waitlist-done">{t('waitlist.done', "You're on the list. We'll email you if a time opens that day.")}</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs underline pt-2 min-h-[36px]" style={{ color: 'var(--ink)' }} data-testid="waitlist-open">
        <BellPlus size={13} /> {t('waitlist.open', 'None of these times work? Join the waiting list')}
      </button>
    );
  }
  const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
  return (
    <form onSubmit={join} className="pt-2 space-y-2" data-testid="waitlist-form">
      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('waitlist.hint', 'If someone cancels on that day, you get an email straight away.')}</p>
      <select value={day} onChange={(e) => setDay(e.target.value)} className={field} style={{ borderColor: 'var(--brand-border)' }} aria-label={t('waitlist.day', 'Day')}>
        {days.map((d) => <option key={d.iso} value={d.iso}>{d.label}</option>)}
      </select>
      <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('waitlist.name', 'Your name')}
             className={field} style={{ borderColor: 'var(--brand-border)' }} data-testid="waitlist-name" />
      <input required type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('waitlist.email', 'Your email')} dir="ltr"
             className={field} style={{ borderColor: 'var(--brand-border)' }} data-testid="waitlist-email" />
      <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-full text-xs font-semibold border disabled:opacity-60"
              style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="waitlist-submit">
        {busy && <Loader2 size={13} className="animate-spin" />} {t('waitlist.join', 'Tell me if a time opens')}
      </button>
    </form>
  );
}
