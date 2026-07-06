import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Mail, MessageCircle, X } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { HOLIDAY_WINDOWS } from '../../constants/holidayWindows';
import { loadHolidayWindows } from '../../utils/holidayWindows';

// Parse 'YYYY-MM-DD' as a LOCAL date (avoids the UTC-shift bug where
// selecting June 2 displays as June 1 in timezones east of UTC).
const parseLocalDate = (dateStr) => {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const PriceBlock = ({ property, sublease, preSubleaseId, convertPrice, holidayContext, setHolidayContext }) => {
  const { t } = useTranslation();
  if (sublease) {
    const converted = convertPrice(sublease.price, sublease.currency);
    const perLabel = sublease.price_type === 'per_night' ? t('property.perNight') : ' total';
    return (
      <>
        <span className="text-3xl font-bold" style={{ color: '#D4AF37' }} data-testid="property-detail-price">
          {sublease.currency === 'USD' ? '$' : '₪'}{(sublease.price || 0).toLocaleString()}
        </span>
        <span className="text-base text-gray-600">{perLabel}</span>
        {converted && (
          <div className="text-xs text-gray-400 mt-1" data-testid="property-detail-converted-price">
            ≈ {converted.symbol}{converted.amount.toLocaleString()}{perLabel}
          </div>
        )}
      </>
    );
  }
  if (preSubleaseId) {
    // Sublease still loading — render skeleton instead of flashing the
    // underlying property's price for a frame.
    return <div className="h-10 w-40 rounded-md bg-gray-100 animate-pulse" data-testid="property-detail-price-loading" />;
  }
  // Two-price model: a listing can carry BOTH a regular monthly/nightly
  // rate AND a holiday rate (lump or per-night). We display the holiday
  // rate only when the renter is in a holiday context (linked from
  // /sukkot or /pesach, clicked the toggle below, OR the auto-switch
  // effect matched their check-in date). Browsing the detail page
  // directly → regular rate by default.
  //
  // Applies to any `rental_type` (short-term or long-term listings can
  // dual-list for Sukkot/Pesach via the multi-rental-types feature) as
  // long as the owner has actually configured a holiday_lump_price.
  const tags = property.holiday_tags || [];
  const hasHolidayPrice =
    property.holiday_lump_price != null &&
    property.holiday_lump_price > 0 &&
    tags.length > 0;
  const matchingHolidayTags = tags.filter((tg) => ['sukkot', 'pesach'].includes(tg));
  const showHolidayPrice =
    hasHolidayPrice &&
    holidayContext != null &&
    matchingHolidayTags.includes(holidayContext);

  const displayCurrency = showHolidayPrice
    ? (property.holiday_lump_currency || property.currency)
    : property.currency;
  const rawPrice = showHolidayPrice
    ? property.holiday_lump_price
    : property.rental_type === 'vacation'
      ? (property.nightly_price || 0)
      : (property.monthly_price || 0);
  const converted = convertPrice(rawPrice, displayCurrency);
  const holidayLabelMap = {
    sukkot: t('property.perSukkot') || '/ Sukkot',
    pesach: t('property.perPesach') || '/ Pesach',
  };
  const perLabel = showHolidayPrice
    ? (property.holiday_lump_is_per_night
        ? `${t('property.perNight')} (${(holidayContext || '').charAt(0).toUpperCase() + (holidayContext || '').slice(1)})`
        : holidayLabelMap[holidayContext] || (t('property.perHoliday') || '/ holiday'))
    : property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth');

  return (
    <>
      <span className="text-3xl font-bold" style={{ color: '#D4AF37' }} data-testid="property-detail-price">
        {displayCurrency === 'USD' ? '$' : '₪'}{rawPrice.toLocaleString()}
      </span>
      <span className="text-base text-gray-600">{perLabel}</span>
      {converted && (
        <div className="text-xs text-gray-400 mt-1" data-testid="property-detail-converted-price">
          ≈ {converted.symbol}{converted.amount.toLocaleString()}{perLabel}
        </div>
      )}
      {/* Rate toggle: lets the renter switch between regular and holiday
          pricing when both are available on this listing. Surfaces the
          dual-price model without forcing two separate listings. */}
      {hasHolidayPrice && matchingHolidayTags.length > 0 && (
        <div className="mt-3" data-testid="rate-toggle-wrap">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FBF8F2] border border-[#D4AF37]/30" data-testid="rate-toggle">
            <button
              type="button"
              onClick={() => setHolidayContext(null)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
              style={{
                backgroundColor: !holidayContext ? '#1E6A6A' : 'transparent',
                color: !holidayContext ? '#FFFFFF' : '#1E6A6A',
              }}
              data-testid="rate-toggle-regular"
            >Regular</button>
            {matchingHolidayTags.map((tg) => (
              <button
                key={tg}
                type="button"
                onClick={() => setHolidayContext(tg)}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize"
                style={{
                  backgroundColor: holidayContext === tg ? '#1E6A6A' : 'transparent',
                  color: holidayContext === tg ? '#FFFFFF' : '#1E6A6A',
                }}
                data-testid={`rate-toggle-${tg}`}
              >{tg} rate</button>
            ))}
          </div>
          {/* Auto-applied hint: only shows when the holiday rate was
              selected by the date-driven effect (still active toggle +
              this listing's check-in falls in the holiday window). */}
          {holidayContext && (
            <p className="text-[11px] text-[#1E6A6A] mt-1.5 ml-1" data-testid="rate-auto-hint">
              {(t('property.holidayRateApplied') || 'Holiday rate applied — switch to Regular if you prefer.')}
            </p>
          )}
        </div>
      )}
    </>
  );
};

const QuickSelectRow = ({ property, dateRange, setDateRange, setBookingData }) => {
  const { t } = useTranslation();
  const setRange = (from, to) => {
    setDateRange({ from, to });
    setBookingData((prev) => ({
      ...prev,
      start_date: format(from, 'yyyy-MM-dd'),
      end_date: format(to, 'yyyy-MM-dd'),
    }));
  };
  // When the owner set an `available_to` cap and it lands inside the +1
  // year window, clamp the quick-select checkout to that cap. Otherwise
  // the renter builds a range the backend will reject at submit time
  // (see routes/bookings.py::_assert_within_availability_window) — and
  // in the worst case they'd contact the owner about impossible dates.
  // Applies to every rental_type — including long-term listings whose
  // owner capped the rental at, say, 18 months from the starting_date.
  const availableTo = property.available_to
    ? parseLocalDate(property.available_to)
    : null;
  // Compute the raw +1 year target so we know whether the clamp will
  // actually kick in — used to decide when to re-label the button.
  const rawFrom = (property.rental_type === 'long-term' && property.starting_date)
    ? parseLocalDate(property.starting_date)
    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
  const rawTo = new Date(rawFrom);
  rawTo.setFullYear(rawTo.getFullYear() + 1);
  const clampActive = availableTo && availableTo < rawTo;
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-2">{t('property.quickSelect')}</p>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            let to = new Date(rawTo);
            if (clampActive) to = availableTo;
            setRange(rawFrom, to);
          }}
          className="px-3 py-1.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A] hover:text-white text-xs font-medium transition-colors"
          data-testid="quick-select-plus-year"
        >
          {clampActive
            ? t('property.untilAvailability', 'Until {{date}}').replace('{{date}}', format(availableTo, 'MMM d'))
            : t('property.plusOneYear')}
        </button>
        <button
          type="button"
          onClick={() => {
            // For long-term rentals with fixed starting date, only clear checkout
            if (property.rental_type === 'long-term' && property.starting_date) {
              setDateRange({ from: dateRange.from, to: undefined });
              setBookingData((prev) => ({ ...prev, end_date: '' }));
            } else {
              setDateRange({ from: undefined, to: undefined });
              setBookingData((prev) => ({ ...prev, start_date: '', end_date: '' }));
            }
          }}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
        >
          {t('property.clearBtn')}
        </button>
      </div>
    </div>
  );
};

// Build the disabled-dates argument for the calendar. Sublease view confines
// the picker to the sublease window; otherwise it disables past dates,
// pre-availability dates, and any blocked-out booking days.
const computeDisabled = ({ sublease, property, blockedDates }) => {
  if (sublease && sublease.available_from && sublease.available_to) {
    return [
      { before: parseLocalDate(sublease.available_from) },
      { after: parseLocalDate(sublease.available_to) },
    ];
  }
  const minStart = (() => {
    if (property.rental_type === 'long-term' && property.starting_date) {
      const startDate = parseLocalDate(property.starting_date);
      if (property.minimum_booking_days) {
        const minCheckout = new Date(startDate);
        minCheckout.setMonth(minCheckout.getMonth() + parseInt(property.minimum_booking_days, 10));
        return [{ before: minCheckout }];
      }
      return [{ before: startDate }];
    }
    if (property.available_from) {
      return [{ before: parseLocalDate(property.available_from) }];
    }
    return [];
  })();
  // Owners can cap the availability window (e.g. only renting their place
  // out for a week while travelling). When set, disable every date after.
  const maxEnd = property.available_to
    ? [{ after: parseLocalDate(property.available_to) }]
    : [];
  return [{ before: new Date() }, ...minStart, ...maxEnd, ...blockedDates.map((d) => new Date(d))];
};

const computeDefaultMonth = ({ property, dateRange }) => {
  // Smart calendar navigation: jump to minimum checkout month
  if (property.rental_type === 'long-term' && property.starting_date && property.minimum_booking_days) {
    const startDate = parseLocalDate(property.starting_date);
    const minCheckout = new Date(startDate);
    minCheckout.setMonth(minCheckout.getMonth() + parseInt(property.minimum_booking_days, 10));
    return minCheckout;
  }
  if (dateRange?.from) return dateRange.from;
  return new Date();
};

const BookingCalendar = ({
  property, sublease, blockedDates,
  dateRange, setDateRange, setBookingData,
  calendarMonth, setCalendarMonth, setShowCalendar,
}) => {
  const { t } = useTranslation();
  const onSelect = (range) => {
    // If the user already had a complete range and is now clicking ANY
    // single date, treat it as a fresh restart. react-day-picker's default
    // for mode="range" shrinks the range when the click falls inside it
    // (e.g. clicking May 3 inside May 1 → Jun 1 yields {May 1, May 3},
    // which is confusing UX). The clicked date becomes the new check-in;
    // check-out clears so the user picks it next.
    const hadCompleteRange = dateRange?.from && dateRange?.to;
    if (hadCompleteRange) {
      const clicked =
        range?.from && range.from.getTime() !== dateRange.from.getTime()
          ? range.from
          : range?.to ?? null;
      if (clicked) {
        setDateRange({ from: clicked, to: undefined });
        setBookingData((prev) => ({
          ...prev,
          start_date: format(clicked, 'yyyy-MM-dd'),
          end_date: '',
        }));
      } else {
        setDateRange({ from: undefined, to: undefined });
        setBookingData((prev) => ({ ...prev, start_date: '', end_date: '' }));
      }
      return;
    }

    // Handle minimum booking days/months
    if (range?.from && !range?.to && property.minimum_booking_days) {
      const minValue = parseInt(property.minimum_booking_days, 10);
      const minCheckout = new Date(range.from);
      if (property.rental_type === 'vacation') {
        minCheckout.setDate(minCheckout.getDate() + minValue);
      } else {
        minCheckout.setMonth(minCheckout.getMonth() + minValue);
      }
      setDateRange({ from: range.from, to: minCheckout });
      setBookingData((prev) => ({
        ...prev,
        start_date: format(range.from, 'yyyy-MM-dd'),
        end_date: format(minCheckout, 'yyyy-MM-dd'),
      }));
      setShowCalendar(null);
      return;
    }

    setDateRange(range || { from: undefined, to: undefined });
    if (range?.from) setBookingData((prev) => ({ ...prev, start_date: format(range.from, 'yyyy-MM-dd') }));
    if (range?.to) {
      setBookingData((prev) => ({ ...prev, end_date: format(range.to, 'yyyy-MM-dd') }));
      setShowCalendar(null);
    }
  };

  return (
    <div
      className="mt-2 bg-white rounded-xl border-2 border-[#1E6A6A] shadow-2xl p-4 relative z-[100] w-[320px]"
      data-testid="booking-calendar"
      style={{ pointerEvents: 'auto' }}
    >
      <button
        onClick={() => setShowCalendar(null)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
      >
        <X size={14} />
      </button>
      <Calendar
        mode="range"
        selected={dateRange}
        month={calendarMonth}
        onMonthChange={setCalendarMonth}
        onSelect={onSelect}
        defaultMonth={computeDefaultMonth({ property, dateRange })}
        numberOfMonths={1}
        disabled={computeDisabled({ sublease, property, blockedDates })}
        className="rounded-xl"
        style={{ pointerEvents: 'auto' }}
        classNames={{
          months: 'flex flex-col w-[280px]',
          month: 'space-y-3 w-[280px]',
          caption: 'flex justify-center pt-1 relative items-center h-8 w-[280px]',
          caption_label: 'text-sm font-bold w-[150px] text-center',
          nav: 'space-x-1 flex items-center',
          nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-[#E5E5E5]',
          nav_button_previous: 'absolute left-1',
          nav_button_next: 'absolute right-1',
          table: 'w-[280px] border-collapse',
          head_row: 'flex w-[280px]',
          head_cell: 'text-gray-500 rounded-md w-10 font-medium text-[0.75rem] uppercase flex-shrink-0',
          row: 'flex w-[280px] mt-1',
          cell: 'relative p-0 text-center text-sm w-10 flex-shrink-0',
          day: 'h-10 w-10 p-0 font-bold rounded-full hover:bg-[#1E6A6A] hover:text-white inline-flex items-center justify-center text-gray-900 transition-all text-base',
          day_range_start: 'day-range-start !bg-black !text-white rounded-full hover:!bg-black',
          day_range_end: 'day-range-end !bg-black !text-white rounded-full hover:!bg-black',
          day_selected: '!bg-black !text-white hover:!bg-black focus:!bg-black',
          day_today: 'font-bold text-[#D4AF37] border-2 border-[#D4AF37]',
          day_outside: 'text-gray-300 opacity-50',
          day_disabled: 'text-gray-200 opacity-30 line-through',
          day_range_middle: 'aria-selected:bg-black/10 aria-selected:text-black',
          day_hidden: 'invisible',
        }}
      />
      {dateRange.from && dateRange.to && (
        <div className="px-3 pb-2 pt-1 text-center">
          <span className="text-xs text-gray-500">
            {Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))} {t('property.nights')}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Sticky booking sidebar shown on the right of every PropertyDetail page.
 * Owns: price block, check-in/check-out pills, quick-select presets, the
 * range calendar popover, contact buttons (email/message), reserve CTA.
 *
 * State stays in the parent (PropertyDetail) since `bookingData` and
 * `dateRange` are also read by the deep-link prefill effect there.
 */
const BookingSidebar = ({
  property, sublease, preSubleaseId,
  bookingData, setBookingData,
  dateRange, setDateRange,
  showCalendar, setShowCalendar,
  calendarMonth, setCalendarMonth,
  blockedDates,
  convertPrice,
  onBook, onChat,
}) => {
  const { t } = useTranslation();

  const onCheckInClick = () => {
    // If a complete range is set, clear both on calendar-open so the next
    // two clicks pick a brand-new range cleanly. (react-day-picker's
    // mode="range" otherwise no-ops or shrinks the existing range when
    // clicking inside it.)
    if (dateRange?.from && dateRange?.to) {
      setDateRange({ from: undefined, to: undefined });
      setBookingData((prev) => ({ ...prev, start_date: '', end_date: '' }));
    }
    setShowCalendar(showCalendar === 'range' ? null : 'range');
  };

  const onCheckOutClick = () => {
    // Clicking the Check-out pill should only reset the check-out side;
    // check-in must be preserved so the next calendar click sets the new
    // check-out date, not a brand-new check-in.
    if (dateRange?.from && dateRange?.to) {
      setDateRange({ from: dateRange.from, to: undefined });
      setBookingData((prev) => ({ ...prev, end_date: '' }));
    }
    setShowCalendar(showCalendar === 'range' ? null : 'range');
  };

  const datesIncomplete = !bookingData.start_date || !bookingData.end_date;
  const isInstantBook = property.rental_type === 'vacation' && !sublease;
  const ctaLabel = datesIncomplete
    ? t('property.pickDates')
    : isInstantBook
      ? t('property.bookNow', 'Book now')
      : t('property.reserveBooking');

  // Holiday context — read once from `?holiday=sukkot|pesach` so a renter
  // who clicked through from the /properties/sukkot grid lands on the
  // Sukkot rate. State, not derived, so the in-sidebar Regular/Sukkot
  // toggle below can flip it without leaving the URL.
  const [holidayContext, setHolidayContext] = React.useState(() => {
    if (typeof window === 'undefined') return null;
    const qs = new URLSearchParams(window.location.search).get('holiday');
    return ['sukkot', 'pesach'].includes(qs) ? qs : null;
  });
  // True once the user has manually flipped the rate toggle — pauses
  // date-driven auto-switching so we don't override their explicit choice.
  const [holidayManuallySet, setHolidayManuallySet] = React.useState(false);

  // Auto-rolling holiday windows from Hebcal (cached 30 days in
  // localStorage; falls back to the static dates if the API is
  // unreachable). One fetch per page load — windows rarely change.
  const [resolvedWindows, setResolvedWindows] = React.useState(HOLIDAY_WINDOWS);
  React.useEffect(() => {
    let cancelled = false;
    loadHolidayWindows()
      .then((w) => { if (!cancelled && w) setResolvedWindows(w); })
      .catch(() => {});  // static fallback already in state
    return () => { cancelled = true; };
  }, []);

  // Date-aware rate auto-switch: if the renter's check-in lands inside
  // Sukkot/Pesach AND this listing has the matching holiday tag + a
  // holiday rate set, flip to the holiday rate automatically. So a
  // renter who wandered in from /vacation but picked Sukkot dates gets
  // the holiday price without having to find the toggle.
  //
  // Skipped once the user has flipped the toggle manually so we never
  // override an explicit choice; resets when they clear dates.
  const checkInISO = bookingData?.start_date;
  React.useEffect(() => {
    if (holidayManuallySet || !checkInISO) return;
    const tags = property.holiday_tags || [];
    // Match the relaxed gate in PriceDisplay — any rental_type qualifies
    // as long as the owner set a holiday lump price + tag.
    const hasHolidayRate =
      property.holiday_lump_price != null &&
      property.holiday_lump_price > 0 &&
      tags.length > 0;
    if (!hasHolidayRate) return;

    let matchedTag = null;
    for (const tag of ['sukkot', 'pesach']) {
      if (!tags.includes(tag)) continue;
      const win = resolvedWindows?.[tag];
      if (!win) continue;
      // String-compare ISO dates (YYYY-MM-DD) — both ends inclusive.
      if (checkInISO >= win.start && checkInISO <= win.end) {
        matchedTag = tag;
        break;
      }
    }
    if (matchedTag && holidayContext !== matchedTag) {
      setHolidayContext(matchedTag);
    } else if (!matchedTag && holidayContext != null) {
      // Date moved OUT of any holiday window → fall back to the regular
      // rate. (Still respects manual override via the `holidayManuallySet`
      // guard above.)
      setHolidayContext(null);
    }
  }, [checkInISO, resolvedWindows, holidayManuallySet, property.holiday_tags, property.rental_type, property.holiday_lump_price, holidayContext]);

  // Reset the manual-override flag when the user clears dates entirely
  // — they're essentially starting fresh, so auto-switching should
  // resume on the next date pick.
  React.useEffect(() => {
    if (!checkInISO && holidayManuallySet) setHolidayManuallySet(false);
  }, [checkInISO, holidayManuallySet]);

  // Wrap the toggle setter so any UI click is treated as a manual choice
  // and locks the date-driven auto-switch until the renter clears dates.
  const setHolidayContextManual = (next) => {
    setHolidayManuallySet(true);
    setHolidayContext(next);
  };

  // Big renter-facing CTA card: "Book Sukkot / Pesach at $X →". Only
  // shown when the listing has a holiday rate configured AND we're
  // currently on the regular rate. One tap: pre-fills the date range
  // with the owner's holiday window + flips to the holiday rate context.
  const holidayCTA = React.useMemo(() => {
    const t2 = property.holiday_tags || [];
    if (!(property.holiday_lump_price > 0) || t2.length === 0) return null;
    // Prefer the owner-defined holiday_start/end_date window; fall back
    // to the shared Jewish calendar lookup if the owner never set one.
    const ownerStart = property.holiday_start_date;
    const ownerEnd = property.holiday_end_date;
    const primaryTag = t2.find((tg) => ['sukkot', 'pesach'].includes(tg)) || t2[0];
    const win = ownerStart && ownerEnd
      ? { start: ownerStart, end: ownerEnd }
      : resolvedWindows?.[primaryTag];
    if (!win) return null;
    return { tag: primaryTag, win };
  }, [property.holiday_tags, property.holiday_lump_price, property.holiday_start_date, property.holiday_end_date, resolvedWindows]);

  const applyHolidayCTA = () => {
    if (!holidayCTA) return;
    const parseIso = (s) => {
      const [y, m, d] = s.split('-').map(Number);
      // Local-noon anchor prevents DST edge-cases from moving the day.
      return new Date(y, m - 1, d, 12, 0, 0);
    };
    // End is inclusive on the owner's side but bookings treat end as
    // checkout (exclusive), so add one day so the renter checks out the
    // morning after the last holiday night.
    const startDate = parseIso(holidayCTA.win.start);
    const endInclusive = parseIso(holidayCTA.win.end);
    const checkoutDate = new Date(endInclusive.getTime() + 24 * 3600 * 1000);
    setDateRange({ from: startDate, to: checkoutDate });
    setBookingData((prev) => ({
      ...prev,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(checkoutDate, 'yyyy-MM-dd'),
    }));
    setHolidayContextManual(holidayCTA.tag);
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto">
      <div className="mb-3">
        <PriceBlock
          property={property}
          sublease={sublease}
          preSubleaseId={preSubleaseId}
          convertPrice={convertPrice}
          holidayContext={holidayContext}
          setHolidayContext={setHolidayContextManual}
        />
      </div>

      {/* Prominent holiday CTA — pushes the alternative rate to the
          renter without hiding the primary one. Auto-hides once the
          renter is already in the holiday context. */}
      {holidayCTA && holidayContext !== holidayCTA.tag && (
        <button
          type="button"
          onClick={applyHolidayCTA}
          className="w-full mb-4 group relative overflow-hidden rounded-xl border-2 border-[#D4AF37] bg-gradient-to-br from-[#FBF8F2] to-[#F7EFDD] p-3 text-left hover:shadow-md transition-shadow"
          data-testid="holiday-cta-card"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                {t('property.availableFor', 'Also available for')} {holidayCTA.tag.charAt(0).toUpperCase() + holidayCTA.tag.slice(1)}
              </p>
              <p className="mt-0.5 text-lg font-bold text-[#1E6A6A] leading-tight" data-testid="holiday-cta-price">
                {property.holiday_lump_currency === 'USD' ? '$' : '₪'}
                {property.holiday_lump_price.toLocaleString()}
                <span className="text-xs font-medium text-gray-500 ms-1">
                  {property.holiday_lump_is_per_night
                    ? t('property.perNight', '/ night')
                    : t('property.perHoliday', '/ holiday')}
                </span>
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {holidayCTA.win.start} → {holidayCTA.win.end}
              </p>
            </div>
            <span className="shrink-0 text-[#1E6A6A] text-base font-bold group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </div>
          <p className="text-[11px] text-[#1E6A6A]/80 mt-1.5 font-medium">
            {t('property.holidayCTAHint', 'Tap to book the holiday window at this rate')}
          </p>
        </button>
      )}

      <div className="space-y-2.5" data-testid="booking-form">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {t('property.checkIn')} & {t('property.checkOut')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCheckInClick}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-sm text-left hover:border-black/30 transition-colors"
              data-testid="booking-start-date"
            >
              <CalendarIcon size={14} className="text-gray-400 flex-shrink-0" />
              <span className={dateRange.from ? 'text-black' : 'text-gray-400'}>
                {dateRange.from ? format(dateRange.from, 'MMM d, yyyy') : t('property.checkIn')}
              </span>
            </button>
            <button
              type="button"
              onClick={onCheckOutClick}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-sm text-left hover:border-black/30 transition-colors"
              data-testid="booking-end-date"
            >
              <CalendarIcon size={14} className="text-gray-400 flex-shrink-0" />
              <span className={dateRange.to ? 'text-black' : 'text-gray-400'}>
                {dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : t('property.checkOut')}
              </span>
            </button>
          </div>

          {/* Quick Select Buttons for Longer Stays — hidden for subleases
              (short window) and for vacation rentals (the "+1 year" preset
              is meaningless for nightly stays where most guests want a few
              nights). */}
          {!sublease && property.rental_type !== 'vacation' && (
            <QuickSelectRow
              property={property}
              dateRange={dateRange}
              setDateRange={setDateRange}
              setBookingData={setBookingData}
            />
          )}

          {showCalendar === 'range' && (
            <BookingCalendar
              property={property}
              sublease={sublease}
              blockedDates={blockedDates}
              dateRange={dateRange}
              setDateRange={setDateRange}
              setBookingData={setBookingData}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              setShowCalendar={setShowCalendar}
            />
          )}
        </div>

        {/* Contact Actions - Above Reserve Booking */}
        <div className="space-y-2">
          {property.owner_email && (
            <a
              href={`mailto:${property.owner_email}?subject=${encodeURIComponent(t('property.emailSubject') + ': ' + property.title)}`}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium border-2 transition-colors"
              style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
              data-testid="email-owner-button"
            >
              <Mail size={18} />
              {t('property.emailOwner')}
            </a>
          )}
          <button
            onClick={onChat}
            className="w-full secondary-btn flex items-center justify-center gap-2 py-2.5"
            data-testid="message-owner-button"
          >
            <MessageCircle size={18} />
            {t('property.messageOwner')}
          </button>
        </div>

        <button
          onClick={onBook}
          disabled={datesIncomplete}
          className="w-full primary-btn py-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          data-testid="confirm-booking-button"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default BookingSidebar;
