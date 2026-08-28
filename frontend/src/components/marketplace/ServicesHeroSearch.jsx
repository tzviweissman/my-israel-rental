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
 *
 * NO FREE-TEXT BOX HERE, on purpose (Tzvi, 28 Aug 2026). One was built and
 * removed the same day, and the reasoning is worth keeping because it will
 * come up again.
 *
 * The argument for it: a category cannot go below itself. Picking
 * "Cleaning" returns every cleaner; typing "oven" returns the one listing
 * that does ovens, and "windows" also finds a deep-clean whose DESCRIPTION
 * mentions them. Search also bridges the visitor's vocabulary and ours —
 * somebody types "handyman", the category is `home-services-repair`.
 *
 * The argument against, which won: at roughly 200 listings, browsing seven
 * cleaners is not a hardship. Search earns its place at 2,000, and until
 * then it is a fourth segment in a bar that reads better with three. The
 * cost is now and the benefit is later.
 *
 * The BACKEND search stays wired and is not dead: `Services.jsx` still
 * reads `q` from the URL and forwards it, so a link carrying `?q=` filters
 * correctly and shows a removable chip. Putting the box back is this
 * component's job alone — see the commit that removed it.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Calendar as CalendarIcon, Wallet, SlidersHorizontal, ChevronDown, Check, Coins } from 'lucide-react';
import { iconForCategory } from './categoryTheme';
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
// Ceilings, not bands. Two reasons, and the second one is a bug fix.
//
// A band anchors: "₪300 – ₪800" makes the reader weigh the top of the
// range, and four bands on screen at once is four simultaneous
// negotiations, so the easy decision becomes no decision.
//
// And a band was the wrong filter. Somebody with ₪300 to spend picked
// "₪100 – ₪300" and we hid every service under ₪100 from them — the
// cheapest options, withheld from the most price-sensitive people who
// asked. Nobody means "at least ₪100" when they state a budget. A budget
// is a ceiling, so each option is now one.
//
// "₪800 and up" stays a floor because there is no honest ceiling to give
// it, and it is a single number either way.
const BUDGET_OPTIONS = [
  { value: '',        labelKey: 'services.hero.budget.any',      labelDefault: 'Any budget' },
  { value: '0-100',   labelKey: 'services.hero.budget.under100', labelDefault: 'Under ₪100' },
  { value: '0-300',   labelKey: 'services.hero.budget.under300', labelDefault: 'Under ₪300' },
  { value: '0-800',   labelKey: 'services.hero.budget.under800', labelDefault: 'Under ₪800' },
  { value: '800-',    labelKey: 'services.hero.budget.over800',  labelDefault: '₪800 and up' },
];

/**
 * A pill segment whose picker is OUR panel, not the browser's.
 *
 * It used to be a native <select>. That renders an OS listbox — grey,
 * square-cornered, system-font — sitting beside a calendar panel built to
 * the design system, which is exactly why the calendar "looked nice" and
 * these two looked old. Same reason they could not be made to match: the
 * OS draws that menu and CSS cannot reach it.
 *
 * A Popover with the calendar's own surface fixes both, and opens
 * DOWNWARD like the calendar now does.
 */
function SegmentSelect({ icon: Icon, label, value, onChange, options, testId }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) || options[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex-1 flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-black/[0.03] transition-colors text-start w-full"
          data-testid={testId}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <Icon size={16} className="text-[var(--brand-primary)] shrink-0" strokeWidth={2.25} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
              {label}
            </div>
            <div className="text-sm font-medium text-[var(--ink)] truncate">
              {current?.label}
            </div>
          </div>
          <ChevronDown size={14} className="text-[var(--brand-muted)] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={10}
        avoidCollisions={false}
        className="p-1.5 rounded-2xl bg-white border-[var(--brand-border)] max-h-[320px] overflow-y-auto"
        style={{ boxShadow: '0 2px 6px -2px rgba(18,59,87,.12), 0 24px 60px -20px rgba(18,59,87,.35)', minWidth: 'var(--radix-popover-trigger-width)' }}
        data-testid={`${testId}-panel`}
      >
        <div role="listbox">
          {options.map((o) => {
            const selected = o.value === value;
            const OptIcon = o.icon;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-start transition-colors hover:bg-black/[0.04]"
                style={{
                  color: 'var(--ink)',
                  background: selected ? 'rgb(var(--brand-primary-rgb) / 0.08)' : 'transparent',
                  fontWeight: selected ? 600 : 400,
                }}
                data-testid={`${testId}-option-${o.value || 'any'}`}
              >
                {/* The same little tile the Stays stay-type menu uses, so
                    the two pickers read as one product. */}
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  {OptIcon
                    ? <OptIcon size={14} className="text-gray-500" />
                    : <span className="text-xs font-bold text-gray-500">∗</span>}
                </span>
                <span className="truncate flex-1">{o.label}</span>
                <Check
                  size={14}
                  className="shrink-0"
                  style={{ opacity: selected ? 1 : 0, color: 'var(--brand-primary)' }}
                />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
          <CalendarIcon size={16} className="text-[var(--brand-primary)] shrink-0" strokeWidth={2.25} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
              {t('services.hero.day.label', 'When')}
            </div>
            <div className="text-sm font-medium text-[var(--ink)] truncate" data-testid="services-hero-day-value">
              {displayLabel}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        /* Downward, always. Radix defaults to bottom but flips to top on
           collision, and this panel floats at the bottom edge of the hero
           — so on a short window the calendar opened UPWARDS, over the
           hero, which is what it was reported doing. The panel scrolls
           with the page, so opening down never traps it off-screen. */
        side="bottom"
        sideOffset={10}
        avoidCollisions={false}
        className="w-auto p-4 rounded-2xl bg-white border-[var(--brand-border)]"
        /* Two-layer shadow as an inline style, not an arbitrary class: a
           multi-layer `shadow-[a,b]` silently fails to compile and the
           panel ships with no shadow at all, which is the same failure
           mode as a space inside an arbitrary value. Tinted to the brand
           blue rather than neutral black, per the design system. */
        style={{ boxShadow: '0 2px 6px -2px rgba(18,59,87,.12), 0 24px 60px -20px rgba(18,59,87,.35)' }}
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
                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-[0_2px_8px_-2px_rgba(30,95,140,0.5)]'
                : 'bg-[rgb(var(--brand-primary-rgb)/0.05)] text-[var(--ink)] border-transparent hover:border-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/0.09)]'
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
                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-[0_2px_8px_-2px_rgba(30,95,140,0.5)]'
                : 'bg-[rgb(var(--brand-primary-rgb)/0.05)] text-[var(--ink)] border-transparent hover:border-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/0.09)]'
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
                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-[0_2px_8px_-2px_rgba(30,95,140,0.5)]'
                : 'bg-[rgb(var(--brand-primary-rgb)/0.05)] text-[var(--ink)] border-transparent hover:border-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/0.09)]'
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
      icon: iconForCategory(c.slug),
    }));
    return [any, ...cats];
  }, [categories, t]);

  const budgetOptions = useMemo(
    // Coins for a bracket, wallet for "any" — the tile is what makes the
    // row scannable; leaving budget plain would make the two menus look
    // like different components again.
    () => BUDGET_OPTIONS.map((o) => ({
      ...o,
      label: t(o.labelKey, o.labelDefault),
      icon: o.value ? Coins : Wallet,
    })),
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
        className="flex flex-col md:flex-row bg-white rounded-3xl md:rounded-full shadow-2xl divide-y md:divide-y-0 md:divide-x divide-[var(--brand-border)] overflow-hidden"
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
          className="hidden md:flex items-center justify-center px-5 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white transition-colors"
          aria-label={t('services.hero.moreFilters', 'More filters')}
          data-testid="services-hero-more-filters"
        >
          <SlidersHorizontal size={18} strokeWidth={2.25} />
        </button>
      </div>

      {/* Mobile-only "More filters" row + a plain-language link back to
          the provider path. Below the pill so the primary controls stay
          uncluttered on small screens. */}
      <div className="mt-4 flex items-center justify-center gap-3 md:gap-4 text-sm text-[var(--brand-muted)]">
        <button
          type="button"
          onClick={onOpenFilters}
          className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/15 text-[var(--brand-primary)] border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 transition-colors"
          data-testid="services-hero-more-filters-mobile"
        >
          <SlidersHorizontal size={14} />
          {t('services.hero.moreFilters', 'More filters')}
        </button>
        <a
          href="/dashboard?tab=my-gigs"
          className="inline-flex items-center gap-1.5 text-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)] font-semibold transition-colors"
          data-testid="services-hero-become-provider"
        >
          {t('services.becomeProvider', 'Become a provider')}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
