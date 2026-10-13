/**
 * Weekly hours + slot length editor.
 *
 * Lifted out of CreateGig.jsx so the listing wizard and the edit sheet
 * (components/dashboard/EditListingModal.jsx) share one set of controls
 * and cannot drift. Behaviour in the wizard is unchanged.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

export const DAYS = [
  { k: 'mon', label: 'Mon' },
  { k: 'tue', label: 'Tue' },
  { k: 'wed', label: 'Wed' },
  { k: 'thu', label: 'Thu' },
  { k: 'fri', label: 'Fri' },
  { k: 'sat', label: 'Sat' },
  { k: 'sun', label: 'Sun' },
];

const AvailabilityStep = ({ weekly, slotDuration, onToggleDay, onUpdateWindow, onSlotDurationChange, showIntro = true, testid = 'wizard-hours-step' }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4" data-testid={testid}>
    {showIntro && <div className="rounded-xl bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 p-3 text-xs text-[var(--brand-primary)] leading-snug">
      {t('wizard.hoursIntro', 'Tell us when you are open. We turn this into booking times on your page. You can change it or add exceptions later from your dashboard.')}
    </div>}
    <div>
      <label className="text-sm font-semibold text-gray-700">{t('sweep.slotLength', 'Slot length')}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {[15, 30, 45, 60, 90].map((mm) => (
          <button key={mm} type="button" onClick={() => onSlotDurationChange(mm)}
            className={`px-3 min-h-[44px] rounded-full text-xs font-semibold border ${
              slotDuration === mm ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
            }`} data-testid={`wizard-slot-${mm}`}>
            {mm} {t('wizard.min', 'min')}
          </button>
        ))}
      </div>
    </div>
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {DAYS.map((d) => {
        const wins = weekly[d.k] || [];
        const open = wins.length > 0;
        const win = wins[0] || { start: '09:00', end: '17:00' };
        return (
          <div key={d.k} className="p-3 flex items-center gap-3" data-testid={`wizard-day-${d.k}`}>
            <label className="flex items-center gap-2 w-24 flex-shrink-0 cursor-pointer">
              <input type="checkbox" checked={open} onChange={() => onToggleDay(d.k)} data-testid={`wizard-day-toggle-${d.k}`} />
              <span className="text-sm font-semibold text-gray-900">{t(`wizard.day_${d.k}`, d.label)}</span>
            </label>
            {open ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={win.start} onChange={(e) => onUpdateWindow(d.k, { start: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" data-testid={`wizard-day-start-${d.k}`} />
                <span className="text-gray-400 text-sm">–</span>
                <input type="time" value={win.end} onChange={(e) => onUpdateWindow(d.k, { end: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" data-testid={`wizard-day-end-${d.k}`} />
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">{t('wizard.closed', 'Closed')}</span>
            )}
          </div>
        );
      })}
    </div>
  </div>
  );
};

export default AvailabilityStep;
