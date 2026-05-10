import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Mail, MessageCircle, X } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';

// Parse 'YYYY-MM-DD' as a LOCAL date (avoids the UTC-shift bug where
// selecting June 2 displays as June 1 in timezones east of UTC).
const parseLocalDate = (dateStr) => {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const PriceBlock = ({ property, sublease, preSubleaseId, convertPrice }) => {
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
  const rawPrice = property.monthly_price || property.nightly_price || 0;
  const converted = convertPrice(rawPrice, property.currency);
  const perLabel = property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth');
  return (
    <>
      <span className="text-3xl font-bold" style={{ color: '#D4AF37' }} data-testid="property-detail-price">
        {property.currency === 'USD' ? '$' : '₪'}{rawPrice.toLocaleString()}
      </span>
      <span className="text-base text-gray-600">{perLabel}</span>
      {converted && (
        <div className="text-xs text-gray-400 mt-1" data-testid="property-detail-converted-price">
          ≈ {converted.symbol}{converted.amount.toLocaleString()}{perLabel}
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
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-2">{t('property.quickSelect')}</p>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            // For long-term rentals with a fixed starting date, anchor the
            // +1 year range to that date. Otherwise, start tomorrow.
            const from = (property.rental_type === 'long-term' && property.starting_date)
              ? parseLocalDate(property.starting_date)
              : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
            const to = new Date(from);
            to.setFullYear(to.getFullYear() + 1);
            setRange(from, to);
          }}
          className="px-3 py-1.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] hover:bg-[#1E6A6A] hover:text-white text-xs font-medium transition-colors"
        >
          {t('property.plusOneYear')}
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
  return [{ before: new Date() }, ...minStart, ...blockedDates.map((d) => new Date(d))];
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
  const longTermLocked = !sublease && property.rental_type === 'long-term';

  const onCheckInClick = () => {
    if (!sublease && property.rental_type === 'long-term') return;
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

  return (
    <div className="bg-white p-4 rounded-2xl border border-[#E5E5E5] sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto">
      <div className="mb-3">
        <PriceBlock
          property={property}
          sublease={sublease}
          preSubleaseId={preSubleaseId}
          convertPrice={convertPrice}
        />
      </div>

      <div className="space-y-2.5" data-testid="booking-form">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {t('property.checkIn')} & {t('property.checkOut')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCheckInClick}
              disabled={longTermLocked}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                longTermLocked
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-[#E5E5E5] hover:border-black/30'
              }`}
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
