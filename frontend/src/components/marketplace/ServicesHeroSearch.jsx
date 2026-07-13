/**
 * Segmented "Airbnb-style" search bar for the Services hero.
 *
 * Replaces the old free-text search + separate address input with three
 * inline controls (Service · Day · Budget) plus a search button. Users
 * pick a service from a dropdown, an optional day window, and an
 * optional budget bracket — all backed by the same URL params the
 * server-side filter already understands (`category`, `min_price`,
 * `max_price`, `available_now`).
 *
 * Kept in its own file to avoid bloating Services.jsx further. All state
 * comes from the parent via props (categories list + patchUrl + current
 * URL params) so this component stays a pure controlled surface.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Calendar as CalendarIcon, Wallet, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';

// Format a Date object as YYYY-MM-DD for the URL param — uses the
// browser's local timezone so what the renter picks visually matches
// what the server evaluates (both live in civil time, no TZ math needed).
const toIsoDate = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Parse a YYYY-MM-DD string back to a Date at local midnight. Returns
// null for anything not matching the expected shape so we don't
// hydrate the calendar with garbage from a tampered URL.
const fromIsoDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

// Short, locale-aware label for the "When" segment. Falls back to a
// month/day summary when Intl isn't available (very rare).
const formatDateLabel = (d, locale = 'en-US') => {
  if (!(d instanceof Date)) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
};

// Budget brackets in ILS. Values are `min-max` (max can be empty for
// open-ended "and up"). Kept short so the dropdown stays scannable.
const BUDGET_OPTIONS = [
  { value: '',           labelKey: 'services.hero.budget.any',      labelDefault: 'Any budget' },
  { value: '0-100',      labelKey: 'services.hero.budget.under100', labelDefault: 'Under ₪100' },
  { value: '100-300',    labelKey: 'services.hero.budget.100_300',  labelDefault: '₪100 – ₪300' },
  { value: '300-800',    labelKey: 'services.hero.budget.300_800',  labelDefault: '₪300 – ₪800' },
  { value: '800-',       labelKey: 'services.hero.budget.over800',  labelDefault: '₪800 and up' },
];

/**
 * Native <select> styled as a full-height pill segment. Uses `appearance-
 * none` so we can render our own chevron + label + placeholder, but
 * still gets the OS-native picker on mobile (best-in-class UX).
 */
function SegmentSelect({ icon: Icon, label, value, onChange, options, testId }) {
  return (
    <label
      className="relative flex-1 flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-black/[0.03] transition-colors"
      data-testid={testId}
    >
      <Icon size={16} className="text-[#1E6A6A] shrink-0" strokeWidth={2.25} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent text-sm font-medium text-gray-900 focus:outline-none cursor-pointer pr-4 truncate"
          data-testid={`${testId}-select`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

/**
 * "When" segment — clicks open a popover with three preset chips (Any /
 * Today / Tomorrow) plus an inline calendar for picking any future date.
 * Renders a compact human-readable label ("Fri, Jul 12") when a date is
 * active so the visitor always sees which day their results are pinned
 * to without opening the popover.
 */
function WhenSegment({ value, onChange, locale }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const selectedDate = fromIsoDate(value);

  // Human-readable label rendered inside the pill segment.
  const displayLabel = !selectedDate
    ? t('services.hero.day.any', 'Anytime')
    : selectedDate.getTime() === today.getTime()
      ? t('services.hero.day.today', 'Today')
      : selectedDate.getTime() === tomorrow.getTime()
        ? t('services.hero.day.tomorrow', 'Tomorrow')
        : formatDateLabel(selectedDate, locale);

  const handlePreset = (nextIso) => {
    onChange(nextIso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex-1 flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-black/[0.03] transition-colors text-left"
          data-testid="services-hero-day"
        >
          <CalendarIcon size={16} className="text-[#1E6A6A] shrink-0" strokeWidth={2.25} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {t('services.hero.day.label', 'When')}
            </div>
            <div className="text-sm font-medium text-gray-900 truncate" data-testid="services-hero-day-value">
              {displayLabel}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-3 bg-white shadow-xl border-gray-200"
        data-testid="services-hero-day-popover"
      >
        {/* Preset chips row — three fastest bookings sit here so the
            common case doesn't require scrolling the calendar. */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => handlePreset('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              !selectedDate
                ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#1E6A6A]'
            }`}
            data-testid="services-hero-day-preset-any"
          >
            {t('services.hero.day.any', 'Anytime')}
          </button>
          <button
            type="button"
            onClick={() => handlePreset(toIsoDate(today))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedDate?.getTime() === today.getTime()
                ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#1E6A6A]'
            }`}
            data-testid="services-hero-day-preset-today"
          >
            {t('services.hero.day.today', 'Today')}
          </button>
          <button
            type="button"
            onClick={() => handlePreset(toIsoDate(tomorrow))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedDate?.getTime() === tomorrow.getTime()
                ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#1E6A6A]'
            }`}
            data-testid="services-hero-day-preset-tomorrow"
          >
            {t('services.hero.day.tomorrow', 'Tomorrow')}
          </button>
        </div>
        <Calendar
          mode="single"
          selected={selectedDate || undefined}
          onSelect={(d) => handlePreset(toIsoDate(d))}
          // Block past dates — booking yesterday makes no sense.
          disabled={{ before: today }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function ServicesHeroSearch({
  categories,
  selectedCat,
  minPrice,
  maxPrice,
  availableOn,
  onPatch,
  onOpenFilters,
  locale = 'en-US',
}) {
  const { t } = useTranslation();

  // Options for the Service dropdown — build once per categories change.
  const serviceOptions = useMemo(() => {
    const any = {
      value: '',
      label: t('services.hero.service.any', 'All services'),
    };
    const cats = (categories || []).map((c) => ({
      value: c.slug,
      label: c.label,
    }));
    return [any, ...cats];
  }, [categories, t]);

  const budgetOptions = useMemo(
    () => BUDGET_OPTIONS.map((o) => ({ ...o, label: t(o.labelKey, o.labelDefault) })),
    [t]
  );

  // Derive current budget bracket from min/max, or fall back to empty.
  const currentBudget = useMemo(() => {
    if (!minPrice && !maxPrice) return '';
    return `${minPrice || 0}-${maxPrice || ''}`;
  }, [minPrice, maxPrice]);

  const handleBudgetChange = (v) => {
    if (!v) {
      onPatch({ min_price: '', max_price: '' });
      return;
    }
    const [min, max] = v.split('-');
    onPatch({ min_price: min || '', max_price: max || '' });
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Main segmented pill. On mobile the three segments stack; on md+
          they sit side-by-side with subtle dividers between them. */}
      <div
        className="flex flex-col md:flex-row bg-white rounded-3xl md:rounded-full shadow-2xl divide-y md:divide-y-0 md:divide-x divide-gray-200 overflow-hidden"
        data-testid="services-hero-search"
      >
        <SegmentSelect
          icon={Briefcase}
          label={t('services.hero.service.label', 'Service')}
          value={selectedCat}
          onChange={(v) => onPatch({ category: v })}
          options={serviceOptions}
          testId="services-hero-service"
        />
        <WhenSegment
          value={availableOn}
          onChange={(iso) => onPatch({ available_on: iso })}
          locale={locale}
        />
        <SegmentSelect
          icon={Wallet}
          label={t('services.hero.budget.label', 'Budget')}
          value={currentBudget}
          onChange={handleBudgetChange}
          options={budgetOptions}
          testId="services-hero-budget"
        />
        {/* Search action — on mobile it becomes a full-width bar at the
            bottom of the stacked pill; on desktop it's a circular icon
            button pinned right. */}
        <button
          type="button"
          onClick={onOpenFilters}
          className="hidden md:flex items-center justify-center px-5 bg-[#1E6A6A] hover:bg-[#175656] text-white transition-colors"
          aria-label={t('services.hero.moreFilters', 'More filters')}
          data-testid="services-hero-more-filters"
        >
          <SlidersHorizontal size={18} strokeWidth={2.25} />
        </button>
      </div>

      {/* Mobile-only "More filters" row + a plain-language link back to
          the provider path. Below the pill so the primary controls stay
          uncluttered on small screens. */}
      <div className="mt-4 flex items-center justify-center gap-3 md:gap-4 text-sm text-gray-600">
        <button
          type="button"
          onClick={onOpenFilters}
          className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E6A6A]/10 hover:bg-[#1E6A6A]/15 text-[#1E6A6A] border border-[#1E6A6A]/20 transition-colors"
          data-testid="services-hero-more-filters-mobile"
        >
          <SlidersHorizontal size={14} />
          {t('services.hero.moreFilters', 'More filters')}
        </button>
        <a
          href="/dashboard?tab=my-gigs"
          className="inline-flex items-center gap-1.5 text-[#1E6A6A] hover:text-[#0F3A3A] font-semibold transition-colors"
          data-testid="services-hero-become-provider"
        >
          {t('services.becomeProvider', 'Become a provider')}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
