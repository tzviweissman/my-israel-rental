/**
 * Pause orders for a holiday (Tzvi, 6 Nov 2026). The switch saves at once;
 * dates and a line for customers are optional. With a last day, orders come
 * back by themselves the day after. Backend: orders.py pause_of.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';

const box = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function PauseOrders({ API, auth, businessId, onChanged }) {
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  const [state, setState] = useState(null);
  const url = `${API}/marketplace/businesses/${businessId}/orders/pause`;
  const take = (data) => {
    setD({ on: !!data.on, from: data.from || '', until: data.until || '', note: data.note || '' });
    setState(data.state || null);
  };
  useEffect(() => { axios.get(url, auth).then(({ data }) => take(data)).catch(() => setD(null)); }, [url, auth]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;

  const save = async (next) => {
    try {
      const { data } = await axios.put(url, { on: next.on, from: next.from || null, until: next.until || null, note: next.note || null }, auth);
      take(data);
      if (onChanged) onChanged();
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pauseOrders.failed', 'Could not save. Try again.'));
      return false;
    }
  };
  const flip = () => { const next = { ...d, on: !d.on }; setD(next); save(next).then((ok) => { if (!ok) setD(d); }); };
  const nice = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language?.startsWith('he') ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long' });
  const bad = d.from && d.until && d.until < d.from;

  let status = null;
  if (state?.active) status = state.back_on ? t('pauseOrders.activeUntil', 'Customers cannot order now. Orders come back on {{date}}.', { date: nice(state.back_on) }) : t('pauseOrders.active', 'Customers cannot order now, until you turn this off.');
  else if (state) status = t('pauseOrders.upcoming', 'Customers cannot order for these days. Pause starts on {{date}}.', { date: nice(state.from) });

  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: '#F9FAFB' }} data-testid="pause-orders">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('pauseOrders.title', 'Pause orders')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{t('pauseOrders.hint', 'For a holiday or time away. Your page stays up and customers see that orders are paused.')}</p>
        </div>
        <button type="button" role="switch" aria-checked={d.on} aria-label={t('pauseOrders.title', 'Pause orders')} onClick={flip} data-testid="pause-orders-switch"
                className="relative w-10 h-6 rounded-full shrink-0 mt-1" style={{ background: d.on ? 'var(--ink)' : '#D1D5DB' }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ insetInlineStart: d.on ? '18px' : '2px' }} />
        </button>
      </div>
      {d.on && (
        <div className="mt-3 space-y-2">
          {status && <p className="text-sm font-semibold" role="status" style={{ color: 'var(--ink)' }} data-testid="pause-orders-status">{status}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('pauseOrders.from', 'First day closed (optional)')}
              <input type="date" className={`${box} mt-1`} style={boxStyle} value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} data-testid="pause-orders-from" />
            </label>
            <label className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('pauseOrders.until', 'Last day closed (optional)')}
              <input type="date" className={`${box} mt-1`} style={boxStyle} value={d.until} onChange={(e) => setD({ ...d, until: e.target.value })} data-testid="pause-orders-until" />
            </label>
          </div>
          <label className="block text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
            {t('pauseOrders.note', 'A line for customers (optional)')}
            <input className={`${box} mt-1`} style={boxStyle} maxLength={140} dir="auto" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })}
                   placeholder={t('pauseOrders.notePlaceholder', 'Closed for Sukkot, back on 20 October')} data-testid="pause-orders-note" />
          </label>
          {bad && <p className="text-xs" role="alert" style={{ color: 'var(--error-text)' }}>{t('pauseOrders.badDates', 'The last day is before the first day.')}</p>}
          <button type="button" disabled={bad} onClick={() => save(d).then((ok) => { if (ok) toast.success(t('pauseOrders.saved', 'Saved')); })}
                  className="inline-flex items-center px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="pause-orders-save">
            {t('pauseOrders.save', 'Save dates and line')}
          </button>
        </div>
      )}
    </div>
  );
}
