import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';

const parseLocalDate = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Pre-built holiday window banner shown on /properties/pesach. Clicking the
 * CTA hands the window key (e.g. "pesach") back to the parent which builds
 * the corresponding query params and refetches.
 */
const HolidayBanner = ({ window: win, type, onApply }) => {
  const { t } = useTranslation();
  if (!win) return null;
  return (
    <div
      className="mb-8 rounded-2xl overflow-hidden border border-[#D4AF37]/30 bg-gradient-to-br from-[#fffaee] via-white to-[#fffaee] shadow-sm"
      data-testid={`holiday-banner-${type}`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
            <CalendarIcon size={22} style={{ color: '#8a6d1d' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8a6d1d] mb-1">
              {win.label} {win.year}
            </p>
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">
              {format(parseLocalDate(win.start), 'MMM d')} —{' '}
              {format(parseLocalDate(win.end), 'MMM d, yyyy')}
            </h2>
            <p className="text-sm text-gray-600">{t('filters.holidayBannerDesc')}</p>
          </div>
        </div>
        <button
          onClick={() => onApply(type)}
          className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-md active:scale-[0.98] flex items-center gap-2 self-start md:self-center"
          style={{ backgroundColor: '#1E6A6A', color: '#D4AF37' }}
          data-testid={`apply-holiday-window-${type}`}
        >
          <Filter size={14} />
          {t('filters.findHomesThisDates')}
        </button>
      </div>
    </div>
  );
};

export default HolidayBanner;
