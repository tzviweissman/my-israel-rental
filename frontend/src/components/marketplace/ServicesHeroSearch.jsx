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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Calendar, Wallet, SlidersHorizontal } from 'lucide-react';

// Day windows. "Today" and "This week" are the two we can express with
// existing backend params (available_now=1) or the client-side filter.
// "Anytime" clears the day filter entirely.
const DAY_OPTIONS = [
  { value: '',       labelKey: 'services.hero.day.any',      labelDefault: 'Anytime' },
  { value: 'today',  labelKey: 'services.hero.day.today',    labelDefault: 'Today' },
  { value: 'week',   labelKey: 'services.hero.day.week',     labelDefault: 'This week' },
];

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

export default function ServicesHeroSearch({
  categories,
  selectedCat,
  minPrice,
  maxPrice,
  availableNow,
  onPatch,
  onOpenFilters,
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

  const dayOptions = useMemo(
    () => DAY_OPTIONS.map((o) => ({ ...o, label: t(o.labelKey, o.labelDefault) })),
    [t]
  );

  const budgetOptions = useMemo(
    () => BUDGET_OPTIONS.map((o) => ({ ...o, label: t(o.labelKey, o.labelDefault) })),
    [t]
  );

  // Derive the current "day" value from the URL flags. We only surface
  // Today/Anytime today — This week is client-side-only and reset every
  // page load, so it's stored on the pill via `availableNow` too.
  const currentDay = availableNow ? 'today' : '';

  const handleDayChange = (v) => {
    // Only 'today' hits the server (available_now flag). Other windows
    // just clear the flag; a future backend `available_on=YYYY-MM-DD`
    // param can hook in here without touching the pill's UX.
    if (v === 'today') onPatch({ available_now: '1' });
    else onPatch({ available_now: '' });
  };

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
        <SegmentSelect
          icon={Calendar}
          label={t('services.hero.day.label', 'When')}
          value={currentDay}
          onChange={handleDayChange}
          options={dayOptions}
          testId="services-hero-day"
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
      <div className="mt-4 flex items-center justify-center gap-3 md:gap-4 text-sm text-white/85">
        <button
          type="button"
          onClick={onOpenFilters}
          className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 transition-colors"
          data-testid="services-hero-more-filters-mobile"
        >
          <SlidersHorizontal size={14} />
          {t('services.hero.moreFilters', 'More filters')}
        </button>
        <a
          href="/dashboard?tab=my-gigs"
          className="inline-flex items-center gap-1.5 text-white/90 hover:text-[#D4AF37] font-semibold transition-colors"
          data-testid="services-hero-become-provider"
        >
          {t('services.becomeProvider', 'Become a provider')}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
