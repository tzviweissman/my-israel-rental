import React from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X, Calendar as CalendarIcon, Minus, Plus, Bell } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Slider } from '../ui/slider';
import { format } from 'date-fns';
import { areaLabel } from '../../utils/areaNames';

export const PRICE_MAX = 50000;

const StepperControl = ({ label, value, onDecrement, onIncrement, displayValue, testId }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-[14px] text-[#3a3a3a] tracking-wide">{label}</span>
    <div className="flex items-center gap-2.5">
      <button
        onClick={onDecrement}
        disabled={!value}
        className="w-9 h-9 rounded-full border border-[#d0d0d0] flex items-center justify-center text-[#888] hover:border-[var(--gold)] hover:text-[var(--gold)] hover:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/5 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-[#d0d0d0] disabled:hover:text-[#888] disabled:hover:bg-transparent"
        data-testid={`${testId}-minus`}
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <span
        className="w-7 text-center text-[14px] font-semibold text-[var(--brand-primary)] tabular-nums"
        data-testid={`${testId}-value`}
      >
        {displayValue}
      </span>
      <button
        onClick={onIncrement}
        className="w-9 h-9 rounded-full border border-[#d0d0d0] flex items-center justify-center text-[#888] hover:border-[var(--gold)] hover:text-[var(--gold)] hover:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/5 transition-all duration-200"
        data-testid={`${testId}-plus`}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

/**
 * Two-column filters drawer with price/rooms/property/dates sections.
 * State and callbacks live in the parent (Properties.js); this component is
 * just the rendered drawer + its bottom action bar.
 */
const FiltersPanel = ({
  filters,
  onFilterChange,
  dateRange,
  onDateRangeChange,
  priceRange,
  onPriceSliderChange,
  setPriceRange,
  priceCurrency,
  onSetPriceCurrency,
  resultsCount,
  activeFilterCount,
  user,
  onApply,
  onClear,
  onClose,
  onSaveAsAlert,
  stepValue,
}) => {
  const { t } = useTranslation();

  // Currency switch: clear active price filters because the numeric values
  // would otherwise be interpreted in the new currency (e.g. "max 5000 ILS"
  // becoming "max $5000" silently filters out everything).
  const switchCurrency = (next) => {
    onSetPriceCurrency(next);
    setPriceRange([0, PRICE_MAX]);
    onFilterChange('min_price', '');
    onFilterChange('max_price', '');
  };

  return (
    <div
      className="mb-8 rounded-2xl overflow-hidden"
      style={{
        border: '1px solid #e0dcd4',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
      }}
      data-testid="filters-panel"
    >
      {/* Header */}
      <div
        className="px-7 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2A8585 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <Filter size={16} className="text-[var(--gold)]" />
          <span className="text-[13px] font-semibold tracking-[0.08em] uppercase text-white/90">
            {t('filters.filters')}
          </span>
          {activeFilterCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[var(--gold)] text-[var(--brand-primary)]">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="bg-[#fafaf8]">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column */}
          <div className="lg:border-r" style={{ borderColor: '#e8e4dc' }}>
            {/* Price Range Section */}
            <div className="px-7 pt-6 pb-5" data-testid="filter-price-section">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[var(--brand-primary)]">
                  {t('filters.priceRange')}
                </h3>
                <div
                  className="flex rounded-lg overflow-hidden"
                  style={{ border: '1.5px solid #d0ccc4' }}
                  data-testid="filter-currency-toggle"
                >
                  <button
                    onClick={() => switchCurrency('ILS')}
                    className={`px-3 py-1 text-xs font-bold tracking-wider transition-all duration-200 ${
                      priceCurrency === 'ILS'
                        ? 'bg-[var(--brand-primary)]'
                        : 'bg-transparent text-[#999] hover:text-[#666]'
                    }`}
                    style={priceCurrency === 'ILS' ? { color: 'var(--gold-text-on-dark)' } : undefined}
                    data-testid="filter-currency-ils"
                  >
                    ₪ ILS
                  </button>
                  <div className="w-px bg-[#d0ccc4]" />
                  <button
                    onClick={() => switchCurrency('USD')}
                    className={`px-3 py-1 text-xs font-bold tracking-wider transition-all duration-200 ${
                      priceCurrency === 'USD'
                        ? 'bg-[var(--brand-primary)]'
                        : 'bg-transparent text-[#999] hover:text-[#666]'
                    }`}
                    style={priceCurrency === 'USD' ? { color: 'var(--gold-text-on-dark)' } : undefined}
                    data-testid="filter-currency-usd"
                  >
                    $ USD
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#999] tracking-wide mb-5">
                {t('filters.priceSubtitle')}
              </p>

              <div className="px-1 mb-5">
                <Slider
                  value={priceRange}
                  onValueChange={onPriceSliderChange}
                  min={0}
                  max={PRICE_MAX}
                  step={100}
                  className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-[2.5px] [&_[role=slider]]:border-[var(--brand-primary)] [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&_[role=slider]]:hover:shadow-lg [&_[role=slider]]:hover:scale-110 [&_[role=slider]]:transition-all [&_.bg-primary\\/20]:bg-[#e0dcd4] [&_.bg-primary\\/20]:h-[3px] [&_.bg-primary]:bg-[var(--gold)] [&_.bg-primary]:h-[3px]"
                  data-testid="filter-price-slider"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider mb-1 block">
                    {t('filters.minimum')}
                  </label>
                  <div
                    className="flex items-center rounded-lg px-3.5 py-2.5 bg-white transition-all duration-200 hover:shadow-sm"
                    style={{ border: '1.5px solid #e0dcd4' }}
                  >
                    <span className="text-sm font-bold mr-1.5" style={{ color: 'var(--gold-text-on-light)' }}>
                      {priceCurrency === 'USD' ? '$' : '₪'}
                    </span>
                    <input
                      type="number"
                      value={priceRange[0] || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        const newRange = [Math.min(val, priceRange[1]), priceRange[1]];
                        setPriceRange(newRange);
                        onFilterChange('min_price', val > 0 ? String(val) : '');
                      }}
                      placeholder="0"
                      className="w-full text-sm font-medium bg-transparent outline-none text-[var(--brand-primary)] placeholder:text-[#ccc]"
                      data-testid="filter-price-min-input"
                    />
                  </div>
                </div>
                <div className="w-4 h-px bg-[#d0ccc4] mt-5" />
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wider mb-1 block">
                    {t('filters.maximum')}
                  </label>
                  <div
                    className="flex items-center rounded-lg px-3.5 py-2.5 bg-white transition-all duration-200 hover:shadow-sm"
                    style={{ border: '1.5px solid #e0dcd4' }}
                  >
                    <span className="text-sm font-bold mr-1.5" style={{ color: 'var(--gold-text-on-light)' }}>
                      {priceCurrency === 'USD' ? '$' : '₪'}
                    </span>
                    <input
                      type="number"
                      value={priceRange[1] >= PRICE_MAX ? '' : priceRange[1]}
                      onChange={(e) => {
                        const val = Number(e.target.value) || PRICE_MAX;
                        const newRange = [priceRange[0], Math.max(val, priceRange[0])];
                        setPriceRange(newRange);
                        onFilterChange('max_price', val < PRICE_MAX ? String(val) : '');
                      }}
                      placeholder={`${PRICE_MAX.toLocaleString()}+`}
                      className="w-full text-sm font-medium bg-transparent outline-none text-[var(--brand-primary)] placeholder:text-[#ccc]"
                      data-testid="filter-price-max-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-7 border-t" style={{ borderColor: '#e8e4dc' }} />

            {/* Rooms & Details Section */}
            <div className="px-7 py-5" data-testid="filter-rooms-section">
              <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[var(--brand-primary)] mb-1">
                {t('filters.roomsAndDetails')}
              </h3>
              <StepperControl
                label={t('property.bedrooms')}
                value={filters.min_bedrooms ? Number(filters.min_bedrooms) : 0}
                onDecrement={() => stepValue('min_bedrooms', -1, 8, 0.5)}
                onIncrement={() => stepValue('min_bedrooms', 1, 8, 0.5)}
                displayValue={filters.min_bedrooms || t('filters.any')}
                testId="filter-bedrooms"
              />
              <div className="border-t" style={{ borderColor: '#f0ece4' }} />
              <StepperControl
                label={t('property.bathrooms')}
                value={filters.min_bathrooms ? Number(filters.min_bathrooms) : 0}
                onDecrement={() => stepValue('min_bathrooms', -1, 5, 0.5)}
                onIncrement={() => stepValue('min_bathrooms', 1, 5, 0.5)}
                displayValue={filters.min_bathrooms || t('filters.any')}
                testId="filter-bathrooms"
              />
              <div className="border-t" style={{ borderColor: '#f0ece4' }} />
              <StepperControl
                label={t('property.porches')}
                value={filters.min_porches ? Number(filters.min_porches) : 0}
                onDecrement={() => stepValue('min_porches', -1)}
                onIncrement={() => stepValue('min_porches', 1, 5)}
                displayValue={filters.min_porches || t('filters.any')}
                testId="filter-porches"
              />
              <div className="border-t" style={{ borderColor: '#f0ece4' }} />
              <StepperControl
                label={t('filters.maxFloor')}
                value={filters.max_floor ? Number(filters.max_floor) : 0}
                onDecrement={() => stepValue('max_floor', -1, 30)}
                onIncrement={() => stepValue('max_floor', 1, 30)}
                displayValue={filters.max_floor || t('filters.any')}
                testId="filter-floor"
              />
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Property Section */}
            <div className="px-7 pt-6 pb-5" data-testid="filter-property-section">
              <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[var(--brand-primary)] mb-4">
                {t('filters.propertySection')}
              </h3>
              <div className="space-y-4">
                {/* Location */}
                <div>
                  <label className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-1.5 block">
                    {t('property.propertyLocation')}
                  </label>
                  <select
                    value={filters.area}
                    onChange={(e) => onFilterChange('area', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:shadow-sm transition-all duration-200 text-[var(--brand-primary)] appearance-none"
                    style={{
                      border: '1.5px solid #e0dcd4',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                    }}
                    data-testid="filter-area-input"
                  >
                    <option value="">{t('filters.anyLocation')}</option>
                    <optgroup label="Jerusalem">
                      {[
                        'Abu Tor', 'Arnona', 'Arzei HaBira', 'Baka', 'Bayit VeGan', 'Beit HaKerem',
                        'French Hill', 'Geula', 'German Colony', 'Gilo', 'Givat HaMivtar',
                        'Givat Shaul', 'Har Nof', 'Jewish Quarter', 'Katamon', 'Kiryat HaYovel',
                        'Kiryat Moshe', 'Maalot Dafna', 'Mamilla', 'Mea Shearim', 'Nachlaot',
                        'Neve Yaakov', 'Old City', 'Pisgat Zeev', 'Ramat Eshkol', 'Ramat Shlomo',
                        'Ramot', 'Rehavia', 'Sanhedria', 'Talbiya', 'Talpiot',
                      ].map((n) => (
                        <option key={n} value={`Jerusalem - ${n}`}>{areaLabel(n, t)}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Tel Aviv">
                      {[
                        'City Center', 'Florentin', 'Jaffa (Yafo)', 'Neve Tzedek', 'Old North',
                        'Ramat Aviv', 'Ramat HaHayal', 'Sarona', 'Shapira', 'White City', 'Yad Eliyahu',
                      ].map((n) => (
                        <option key={n} value={`Tel Aviv - ${n}`}>{areaLabel(n, t)}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Haifa">
                      {[
                        'Ahuza', 'Carmel Center', 'German Colony', 'Hadar HaCarmel', "Neve Sha'anan",
                        'Stella Maris', 'Wadi Nisnas',
                      ].map((n) => (
                        <option key={n} value={`Haifa - ${n}`}>{areaLabel(n, t)}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Other">
                      {[
                        'Ashdod', 'Ashkelon', 'Bat Yam', 'Beersheba', 'Beit Shemesh', 'Bnei Brak',
                        'Eilat', 'Herzliya', 'Kfar Saba', 'Modiin', 'Netanya', 'Petah Tikva',
                        'Raanana', 'Ramat Gan', 'Rehovot', 'Rishon LeZion',
                      ].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Elevator Toggle */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-[14px] text-[#3a3a3a] tracking-wide">
                    {t('property.elevator')}
                  </span>
                  <button
                    onClick={() =>
                      onFilterChange('has_elevator', filters.has_elevator === 'true' ? '' : 'true')
                    }
                    className={`relative w-[52px] h-[28px] rounded-full transition-all duration-300 ${
                      filters.has_elevator === 'true' ? 'bg-[var(--gold)]' : 'bg-[#d4d0c8]'
                    }`}
                    style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }}
                    data-testid="filter-elevator-toggle"
                  >
                    <span
                      className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                        filters.has_elevator === 'true' ? 'translate-x-[24px]' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Condition */}
                <div>
                  <label className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-1.5 block">
                    {t('property.condition')}
                  </label>
                  <select
                    value={filters.condition}
                    onChange={(e) => onFilterChange('condition', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white focus:outline-none focus:shadow-sm transition-all duration-200 text-[var(--brand-primary)] appearance-none"
                    style={{
                      border: '1.5px solid #e0dcd4',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                    }}
                    data-testid="filter-condition-input"
                  >
                    <option value="">{t('filters.any')}</option>
                    <option value="renovated">{t('property.renovated')}</option>
                    <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                    <option value="good">{t('property.goodCondition')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mx-7 border-t" style={{ borderColor: '#e8e4dc' }} />

            {/* Dates Available Section */}
            <div className="px-7 py-5" data-testid="filter-dates-section">
              <h3 className="text-[13px] font-bold tracking-[0.06em] uppercase text-[var(--brand-primary)] mb-3">
                {t('filters.datesAvailable')}
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm flex items-center gap-2.5 bg-white hover:shadow-sm transition-all duration-200 text-left"
                    style={{ border: '1.5px solid #e0dcd4' }}
                    data-testid="filter-date-picker-trigger"
                  >
                    <CalendarIcon size={15} className="text-[var(--gold)] shrink-0" />
                    {dateRange.from ? (
                      <span className="text-[var(--brand-primary)] font-medium text-[13px]">
                        {format(dateRange.from, 'MMM d, yyyy')}
                        {dateRange.to && (
                          <span className="text-[var(--gold)] font-bold mx-1.5">&#8594;</span>
                        )}
                        {dateRange.to && format(dateRange.to, 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-[#bbb] text-[13px]">
                        {t('filters.startDate')} — {t('filters.endDate')}
                      </span>
                    )}
                    {dateRange.from && (
                      <span
                        role="button"
                        className="ml-auto text-[#bbb] hover:text-[#666] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDateRangeChange({ from: undefined, to: undefined });
                          onFilterChange('date_from', '');
                          onFilterChange('date_to', '');
                        }}
                        data-testid="filter-date-clear"
                      >
                        <X size={14} />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 border-0 shadow-xl rounded-xl overflow-hidden"
                  align="start"
                  sideOffset={8}
                  style={{ minWidth: '580px' }}
                >
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2A8585 100%)' }}
                  >
                    <span className="text-[12px] font-semibold tracking-[0.06em] uppercase text-white/90">
                      {t('filters.datesAvailable')}
                    </span>
                    {dateRange.from && dateRange.to && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[rgb(var(--gold-rgb)/<alpha-value>)]/20 text-[var(--gold)] font-semibold">
                        {Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))}{' '}
                        {t('property.nights')}
                      </span>
                    )}
                  </div>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      onDateRangeChange(range || { from: undefined, to: undefined });
                      if (range?.from) {
                        onFilterChange('date_from', format(range.from, 'yyyy-MM-dd'));
                      } else {
                        onFilterChange('date_from', '');
                      }
                      if (range?.to) {
                        onFilterChange('date_to', format(range.to, 'yyyy-MM-dd'));
                      } else {
                        onFilterChange('date_to', '');
                      }
                    }}
                    numberOfMonths={2}
                    disabled={{ before: new Date() }}
                    className="bg-white"
                    classNames={{
                      months: 'flex flex-col sm:flex-row gap-0 divide-x divide-[#E5E5E5]',
                      month: 'p-4',
                      caption: 'flex justify-center pt-1 relative items-center mb-2',
                      caption_label: 'text-sm font-bold text-[var(--brand-primary)]',
                      nav: 'space-x-1 flex items-center',
                      nav_button:
                        'h-7 w-7 bg-transparent border border-[#E5E5E5] rounded-md p-0 opacity-60 hover:opacity-100 hover:border-[var(--gold)] transition-all inline-flex items-center justify-center',
                      // Logical sides + `!` so this survives RTL and
                      // react-day-picker's own stylesheet — see ui/calendar.jsx.
                      nav_button_previous: '!absolute start-1',
                      nav_button_next: '!absolute end-1',
                      table: 'w-full border-collapse',
                      head_row: 'flex',
                      head_cell: 'text-[var(--gold)] rounded-md w-9 font-semibold text-[0.7rem] uppercase',
                      row: 'flex w-full mt-1',
                      cell:
                        'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 [&:has([aria-selected].day-outside)]:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/5 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
                      day:
                        'h-9 w-9 p-0 font-normal rounded-md hover:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 transition-colors inline-flex items-center justify-center aria-selected:opacity-100 cursor-pointer',
                      day_range_start:
                        'day-range-start bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)] rounded-l-md',
                      day_range_end:
                        'day-range-end bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)] rounded-r-md',
                      day_selected: 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)] focus:bg-[var(--brand-primary)] focus:text-white',
                      day_today: 'border border-[var(--gold)] text-[var(--gold)] font-bold',
                      day_outside: 'text-gray-300 aria-selected:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/5 aria-selected:text-gray-400',
                      day_disabled: 'text-gray-300 opacity-40 cursor-not-allowed',
                      day_range_middle: 'aria-selected:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 aria-selected:text-[var(--brand-primary)]',
                      day_hidden: 'invisible',
                    }}
                    data-testid="filter-date-calendar"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div
        className="px-7 py-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2A8585 100%)' }}
      >
        <button
          onClick={onClear}
          className="text-[13px] font-medium text-white/50 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/50"
          data-testid="clear-filters-button"
        >
          {t('filters.clear')}
        </button>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={onSaveAsAlert}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12px] font-semibold tracking-wide text-white border border-white/30 hover:bg-white/10 transition-all"
              data-testid="save-as-alert-button"
              title={t('filters.saveAsAlertTooltip')}
            >
              <Bell size={14} />
              {t('filters.saveAsAlert')}
            </button>
          )}
          <button
            onClick={onApply}
            className="px-7 py-2.5 rounded-lg text-[13px] font-bold tracking-wide text-[var(--brand-primary)] transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: 'var(--gold)' }}
            data-testid="apply-filters-button"
          >
            {t('filters.showResults')} {resultsCount} {t('filters.places')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltersPanel;
