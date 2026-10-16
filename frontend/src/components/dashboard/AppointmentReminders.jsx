/**
 * Appointments → "Reminders to customers" (backend
 * routes/marketplace/appointment_reminders.py): on or off and how many
 * hours before, per business. One line until opened. Nothing for someone
 * with no business of their own.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { BellRing, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

export default function AppointmentReminders({ API, token }) {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState('');
  const [s, setS] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/marketplace/my-workplaces`, auth).then(({ data }) => {
      const own = (data || []).filter((b) => b.active && b.role !== 'staff');
      setBusinesses(own);
      if (own[0]) setBizId(own[0].id);
    }).catch(() => setBusinesses([]));
  }, [API, auth]);
  useEffect(() => {
    if (!bizId) return;
    setS(null);
    axios.get(`${API}/marketplace/businesses/${bizId}/appointment-reminders`, auth).then(({ data }) => setS(data)).catch(() => setS(false));
  }, [API, auth, bizId]);

  if (!businesses || !businesses.length || s === false) return null;
  const save = async (next) => {
    setS(next);
    setBusy(true);
    try {
      await axios.put(`${API}/marketplace/businesses/${bizId}/appointment-reminders`, next, auth);
      toast.success(t('auto.saved', 'Saved'));
    } catch { toast.error(t('auto.failed', 'Could not save. Try again.')); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border bg-white mb-6" style={{ borderColor: 'var(--brand-border)' }} data-testid="appointment-reminders">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 p-4 text-start min-h-[44px]">
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <BellRing size={16} aria-hidden="true" /> {t('apptRemind.title', 'Reminders to customers')}
          {s && <span className="text-xs font-normal" style={{ color: s.on ? '#2E7D4F' : 'var(--brand-muted)' }}>{s.on ? t('apptRemind.onShort', 'On, {{h}} hours before', { h: s.hours }) : t('apptRemind.off', 'Off')}</span>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm" style={{ color: 'var(--ink)' }}>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('apptRemind.body', 'Customers who gave an email get a reminder before a confirmed appointment, with a link to cancel or ask for another time. Fewer no-shows, and a freed time can go to someone else.')}
          </p>
          {businesses.length > 1 && (
            <select value={bizId} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]"
                    style={{ borderColor: 'var(--brand-border)' }} aria-label={t('orders.pickBusiness', 'Business')}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {s === null ? <Loader2 size={15} className="animate-spin" /> : (
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" checked={!!s.on} onChange={(e) => save({ ...s, on: e.target.checked })} data-testid="appt-remind-on" />
                {t('apptRemind.send', 'Send reminders')}
              </label>
              {s.on && (
                <label className="inline-flex items-center gap-2">
                  <select value={s.hours} onChange={(e) => save({ ...s, hours: Number(e.target.value) })} disabled={busy}
                          className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={{ borderColor: 'var(--brand-border)' }} data-testid="appt-remind-hours">
                    {[2, 4, 12, 24, 48].map((h) => <option key={h} value={h}>{t('apptRemind.hours', '{{h}} hours', { h })}</option>)}
                  </select>
                  {t('apptRemind.before', 'before the appointment')}
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
