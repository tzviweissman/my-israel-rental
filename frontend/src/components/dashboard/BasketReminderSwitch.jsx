/**
 * Orders → settings: the one switch for the left-behind basket reminder
 * (backend basket_reminders.py). On by default; moves at once and saves
 * behind it, a failed save moves it back.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';

export default function BasketReminderSwitch({ API, auth, businessId }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  const url = `${API}/marketplace/businesses/${businessId}/basket-reminder`;
  useEffect(() => { axios.get(url, auth).then(({ data }) => setD(data)).catch(() => setD(null)); }, [url, auth]);
  if (!d) return null;
  const flip = async () => {
    const on = !d.on;
    setD({ ...d, on });
    try { await axios.put(url, { on }, auth); } catch (err) {
      setD((x) => ({ ...x, on: !on }));
      toast.error(err?.response?.status === 403 ? t('feedbackBiz.ownerOnly', 'Only the owner can change this.') : t('auto.failed', 'Could not save. Try again.'));
    }
  };
  return (
    <div className="mt-4 flex items-start justify-between gap-3 rounded-xl p-3" style={{ background: '#F9FAFB' }} data-testid="basket-reminder">
      <div className="text-sm">
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('basketReminder.title', 'Remind people who leave without ordering')}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
          {t('basketReminder.hint', 'If someone chooses items and gives their email but does not order, they get one email about three hours later with a button back to their basket.')}
          {d.sent > 0 && ` ${t('basketReminder.sent', '{{n}} sent so far.', { n: d.sent })}`}
        </p>
      </div>
      <button type="button" role="switch" aria-checked={d.on} onClick={flip} data-testid="basket-switch"
              className="relative w-10 h-6 rounded-full shrink-0 mt-1" style={{ background: d.on ? 'var(--ink)' : '#D1D5DB' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ insetInlineStart: d.on ? '18px' : '2px' }} />
      </button>
    </div>
  );
}
