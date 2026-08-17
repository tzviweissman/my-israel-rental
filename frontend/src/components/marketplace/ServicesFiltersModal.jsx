/**
 * Services Marketplace Discovery filters — Phase 2 of Trust & Discovery.
 *
 * Pill-chip modal that composes with the existing category + location
 * carousels on `/services`. State is fully controlled from the parent
 * (Services.jsx) — the modal only wires the visuals + local draft so
 * users can adjust several filters then Apply in one shot.
 *
 * Backend contract:
 *   GET /marketplace/gigs?min_rating=&min_price=&max_price=&response_time=&languages=&booking_mode=&sort=
 * (see /app/backend/routes/marketplace.py::list_gigs)
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, SlidersHorizontal } from 'lucide-react';

const TEAL = 'var(--brand-primary)';

const ChipRow = ({ options, value, onChange, testidPrefix }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value ?? 'any'}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            active
              ? 'text-white'
              : 'text-gray-700 bg-white border-gray-200 hover:border-gray-400'
          }`}
          style={active ? { background: TEAL, borderColor: TEAL } : {}}
          data-testid={`${testidPrefix}-${opt.value ?? 'any'}`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const LanguageChips = ({ languages, selected, onToggle }) => (
  <div className="flex flex-wrap gap-2" data-testid="filter-languages">
    {languages.map((lang) => {
      const active = selected.includes(lang);
      return (
        <button
          key={lang}
          onClick={() => onToggle(lang)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            active
              ? 'text-white'
              : 'text-gray-700 bg-white border-gray-200 hover:border-gray-400'
          }`}
          style={active ? { background: TEAL, borderColor: TEAL } : {}}
          data-testid={`filter-language-${lang.toLowerCase()}`}
        >
          {lang}
        </button>
      );
    })}
  </div>
);

export const buildInitialDraft = (state) => ({
  minRating: state.minRating || '',
  minPrice: state.minPrice || '',
  maxPrice: state.maxPrice || '',
  responseTime: state.responseTime || '',
  languages: state.languages || [],
  bookingMode: state.bookingMode || '',
  maxDistance: state.maxDistance || '',
});

const ServicesFiltersModal = ({ open, onClose, initial, languages, onApply, onClearAll, nearbyActive }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(buildInitialDraft(initial));

  // Re-sync when the modal reopens with different initial state (e.g.
  // the caller cleared everything from a chip strip outside the modal).
  useEffect(() => {
    if (open) setDraft(buildInitialDraft(initial));
  }, [open, initial]);

  if (!open) return null;

  const toggleLang = (lang) => {
    setDraft((d) => ({
      ...d,
      languages: d.languages.includes(lang)
        ? d.languages.filter((l) => l !== lang)
        : [...d.languages, lang],
    }));
  };

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const clear = () => {
    const empty = buildInitialDraft({});
    setDraft(empty);
    onClearAll();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="services-filters-modal"
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-[var(--brand-primary)]" />
            <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Playfair Display' }}>
              {t('services.filters', 'More filters')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close"
            data-testid="services-filters-close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Rating */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('services.filter.rating', 'Minimum rating')}
            </p>
            <ChipRow
              testidPrefix="filter-rating"
              value={draft.minRating}
              onChange={(v) => setDraft((d) => ({ ...d, minRating: v }))}
              options={[
                { value: '',    label: t('common.any', 'Any') },
                { value: '3',   label: '★ 3+' },
                { value: '4',   label: '★ 4+' },
                { value: '4.5', label: '★ 4.5+' },
              ]}
            />
          </section>

          {/* Price range */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('services.filter.price', 'Price range (per service)')}
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 start-3 flex items-center text-xs text-gray-400">₪</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder={t('common.min', 'Min')}
                  value={draft.minPrice}
                  onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))}
                  className="w-full ps-6 pe-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--brand-primary)]"
                  data-testid="filter-min-price"
                />
              </div>
              <span className="text-gray-400 text-sm">–</span>
              <div className="relative flex-1">
                <span className="absolute inset-y-0 start-3 flex items-center text-xs text-gray-400">₪</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder={t('common.max', 'Max')}
                  value={draft.maxPrice}
                  onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value }))}
                  className="w-full ps-6 pe-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--brand-primary)]"
                  data-testid="filter-max-price"
                />
              </div>
            </div>
          </section>

          {/* Response time */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('services.filter.responseTime', 'Response time')}
            </p>
            <ChipRow
              testidPrefix="filter-response"
              value={draft.responseTime}
              onChange={(v) => setDraft((d) => ({ ...d, responseTime: v }))}
              options={[
                { value: '',    label: t('common.any', 'Any') },
                { value: '1h',  label: t('services.replies1h', 'Replies in 1h') },
                { value: '24h', label: t('services.replies24h', 'Replies in 24h') },
              ]}
            />
          </section>

          {/* Max distance — only meaningful when Nearby is active
              (coords are in memory). Grayed out with a hint when off so
              renters know to tap "Show nearby" first. */}
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {t('services.filter.distance', 'Max distance')}
              </p>
              {!nearbyActive && (
                <p className="text-[10px] text-gray-400 italic">
                  {t('services.filter.distanceNeedsNearby', 'Enable "Show nearby" first')}
                </p>
              )}
            </div>
            <div className={nearbyActive ? '' : 'opacity-50 pointer-events-none'}>
              <ChipRow
                testidPrefix="filter-distance"
                value={draft.maxDistance}
                onChange={(v) => setDraft((d) => ({ ...d, maxDistance: v }))}
                options={[
                  { value: '',   label: t('common.any', 'Any') },
                  { value: '1',  label: t('services.within1km',  'Within 1 km') },
                  { value: '3',  label: t('services.within3km',  'Within 3 km') },
                  { value: '5',  label: t('services.within5km',  'Within 5 km') },
                  { value: '10', label: t('services.within10km', 'Within 10 km') },
                ]}
              />
            </div>
          </section>

          {/* Languages */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('services.filter.languages', 'Languages spoken')}
            </p>
            <LanguageChips
              languages={languages}
              selected={draft.languages}
              onToggle={toggleLang}
            />
          </section>

          {/* Booking mode */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('services.filter.bookingMode', 'Booking method')}
            </p>
            <ChipRow
              testidPrefix="filter-booking"
              value={draft.bookingMode}
              onChange={(v) => setDraft((d) => ({ ...d, bookingMode: v }))}
              options={[
                { value: '',            label: t('common.any', 'Any') },
                { value: 'in_platform', label: t('services.bookOnPlatform', 'On-platform booking') },
                { value: 'whatsapp',    label: t('services.bookWhatsApp', 'WhatsApp only') },
              ]}
            />
          </section>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-t bg-white/95 backdrop-blur">
          <button
            onClick={clear}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900 underline"
            data-testid="services-filters-clear"
          >
            {t('common.clearAll', 'Clear all')}
          </button>
          <button
            onClick={apply}
            className="px-6 py-2.5 rounded-full text-sm font-bold text-white shadow hover:shadow-lg transition-shadow"
            style={{ background: TEAL }}
            data-testid="services-filters-apply"
          >
            {t('common.applyFilters', 'Apply filters')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServicesFiltersModal;
