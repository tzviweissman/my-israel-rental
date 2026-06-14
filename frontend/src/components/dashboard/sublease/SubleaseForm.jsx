import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Calendar, X, Check, Send } from 'lucide-react';
import { Calendar as CalendarComponent } from '../../ui/calendar';

// Parse YYYY-MM-DD without UTC midnight drift
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm';

const SingleDatePopover = ({ value, onChange, anchor, accent, minDate, label, testId }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const isGold = accent === 'gold';
  const borderColor = isGold ? '#D4AF37' : '#1E6A6A';
  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
        <Calendar size={13} style={{ color: borderColor }} />
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-[#1E6A6A]/40 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm text-left flex items-center justify-between transition-all"
        data-testid={testId}
      >
        <span className={value ? 'text-gray-700' : 'text-gray-400'}>
          {value ? format(parseLocalDate(value), 'MMMM d, yyyy') : t('sublease.selectDate')}
        </span>
        <Calendar size={16} style={{ color: borderColor, opacity: 0.55 }} />
      </button>
      {open && (
        <div
          className={`absolute top-full mt-2 ${anchor === 'right' ? 'right-0' : 'left-0'} bg-white rounded-xl shadow-2xl p-4 z-[100] w-[320px] border-2`}
          style={{ borderColor }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
          >
            <X size={14} />
          </button>
          <CalendarComponent
            mode="single"
            selected={parseLocalDate(value)}
            defaultMonth={parseLocalDate(value) || minDate || new Date()}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
            disabled={[{ before: minDate || new Date() }]}
            initialFocus
          />
        </div>
      )}
    </div>
  );
};

/**
 * Renter-facing sublease form: step-1 booking picker + step-2 details
 * (dates, price, type tags, notes). Two paths in step 1:
 *  - Pick one of your active in-app bookings (auto-fills title/area/images)
 *  - "Booked elsewhere?" — enter property details manually
 * All state lives in the parent (SubleasesTab.jsx) so an edit flow can
 * hydrate the same form.
 */
const SubleaseForm = ({
  form, setForm,
  editingId,
  myBookings,
  mySubleases,
  submitting,
  onSubmit,
  imageUrl,
}) => {
  const { t } = useTranslation();
  // 'booking' = property_id linked to an in-app booking
  // 'manual'  = renter typed in their own title/area (booked elsewhere)
  const isManual = form.manual === true;

  const selectPropertyForSublease = (booking) => {
    setForm({
      ...form,
      manual: false,
      property_id: booking.property_id,
      bedrooms_available: booking.property?.bedrooms?.toString() || '',
    });
  };

  const startManualEntry = () => {
    setForm({
      ...form,
      manual: true,
      property_id: '',
      title: '',
      area: '',
      address: '',
      bedrooms: '',
      bathrooms: '',
    });
  };

  if (!form.property_id && !isManual) {
    return (
      <div data-testid="sublease-form-container">
        <h4 className="text-sm font-bold text-gray-800 mb-3">
          {t('sublease.step1Title')}
        </h4>
        {myBookings.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">{t('sublease.noActiveBookings')}</p>
            <p className="text-gray-400 text-xs mt-1">
              {t('sublease.bookedElsewhereHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {myBookings.map((b) => (
              <button
                key={b.id}
                onClick={() => selectPropertyForSublease(b)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#1E6A6A] hover:bg-white transition-all text-left"
                data-testid={`select-booking-${b.id}`}
              >
                <div
                  className="w-14 h-14 rounded-lg bg-gray-200 shrink-0"
                  style={{
                    backgroundImage: `url(${imageUrl(b.property?.images)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{b.property?.title}</p>
                  <p className="text-xs text-gray-500">
                    {b.property?.area} • {b.property?.bedrooms} bed • {b.property?.bathrooms} bath
                  </p>
                </div>
                <span className="text-xs font-medium text-[#1E6A6A]">{t('sublease.selectArrow')}</span>
              </button>
            ))}
          </div>
        )}
        <div className="border-t border-gray-200 pt-3">
          <button
            type="button"
            onClick={startManualEntry}
            className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-[#D4AF37] hover:bg-[#D4AF37]/5 text-sm font-semibold text-[#1E6A6A] transition-all"
            data-testid="sublease-manual-entry-btn"
          >
            {t('sublease.bookedElsewhereBtn')}
          </button>
        </div>
      </div>
    );
  }

  // Build the "selected property" summary card. In edit mode myBookings
  // may not be loaded — fall back to the sublease being edited.
  const selectedBooking = myBookings.find((b) => b.property_id === form.property_id);
  const editedSub = editingId ? mySubleases.find((s) => s.id === editingId) : null;
  const title = selectedBooking?.property?.title || editedSub?.title || '';
  const area = selectedBooking?.property?.area || editedSub?.area || '';
  const img = imageUrl(selectedBooking?.property?.images || editedSub?.images);

  return (
    <div data-testid="sublease-form-container">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-800">
          {editingId ? t('sublease.editDetails') : (isManual ? t('sublease.step2Manual') : t('sublease.step2Title'))}
        </h4>
        {!editingId && (
          <button
            onClick={() => setForm({ ...form, manual: false, property_id: '' })}
            className="text-xs text-gray-500 hover:text-[#1E6A6A]"
          >
            ← {isManual ? t('sublease.useInAppInstead') : t('sublease.changeProperty')}
          </button>
        )}
      </div>
      {isManual ? (
        <div className="p-3 rounded-xl bg-[#FBF8F2] border border-[#D4AF37]/30 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="sublease-manual-fields">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.listingTitleReq')}</label>
            <input
              type="text"
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('sublease.listingTitlePlaceholder')}
              className={inputCls}
              required
              data-testid="sublease-manual-title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.areaReq')}</label>
            <input
              type="text"
              value={form.area || ''}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder={t('sublease.areaPlaceholder')}
              className={inputCls}
              required
              data-testid="sublease-manual-area"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.streetOptional')}</label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t('sublease.addressPlaceholder')}
              className={inputCls}
              data-testid="sublease-manual-address"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.bedroomsLabel')}</label>
            <input
              type="number"
              min="0"
              value={form.bedrooms || ''}
              onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
              placeholder="2"
              className={inputCls}
              data-testid="sublease-manual-bedrooms"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.bathroomsLabel')}</label>
            <input
              type="number"
              min="0"
              value={form.bathrooms || ''}
              onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
              placeholder="1"
              className={inputCls}
              data-testid="sublease-manual-bathrooms"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.descriptionOptional')}</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('sublease.descPlaceholder')}
              rows={2}
              className={`${inputCls} resize-none`}
              data-testid="sublease-manual-description"
            />
          </div>
          <p className="md:col-span-2 text-[11px] text-gray-500">
            {t('sublease.photosTip')}
          </p>
        </div>
      ) : title && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#1E6A6A]/20 mb-4">
          <div
            className="w-12 h-12 rounded-lg bg-gray-200 shrink-0"
            style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500">{area}</p>
          </div>
          <Check size={18} className="text-[#1E6A6A] ml-auto" />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" data-testid="sublease-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SingleDatePopover
            value={form.available_from}
            onChange={(next) =>
              setForm((f) => ({
                ...f,
                available_from: next,
                // Clear available_to if it's now before the new start
                available_to: f.available_to && f.available_to < next ? '' : f.available_to,
              }))
            }
            accent="teal"
            anchor="left"
            label={t('sublease.availableFrom')}
            testId="sublease-from-date"
          />
          <SingleDatePopover
            value={form.available_to}
            onChange={(next) => setForm((f) => ({ ...f, available_to: next }))}
            accent="gold"
            anchor="right"
            label={t('sublease.availableTo')}
            testId="sublease-to-date"
            minDate={form.available_from ? parseLocalDate(form.available_from) : new Date()}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.price')}</label>
            <div className="flex items-stretch rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#1E6A6A]/30 focus-within:border-[#1E6A6A] transition-all">
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="bg-gray-50 border-0 border-r border-gray-200 pl-3 pr-7 text-sm font-medium text-gray-700 focus:outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                data-testid="sublease-currency"
                aria-label={t('sublease.currency')}
              >
                <option value="ILS">₪ ILS</option>
                <option value="USD">$ USD</option>
              </select>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="e.g. 200"
                className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-transparent border-0 focus:outline-none"
                required
                min="1"
                data-testid="sublease-price"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.priceType')}</label>
            <select
              value={form.price_type}
              onChange={(e) => setForm({ ...form, price_type: e.target.value })}
              className={inputCls}
              data-testid="sublease-price-type"
            >
              <option value="per_night">{t('sublease.perNight')}</option>
              <option value="flat">{t('sublease.flatRate')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Bedrooms Available <span className="text-gray-400">(leave blank for all rooms)</span>
          </label>
          <input
            type="number"
            value={form.bedrooms_available}
            onChange={(e) => setForm({ ...form, bedrooms_available: e.target.value })}
            placeholder="All rooms"
            className={inputCls}
            min="1"
            data-testid="sublease-bedrooms"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('sublease.subleaseType')}</label>
          <p className="text-[11px] text-gray-500 mb-2">
            {t('sublease.subleaseTypeHelp')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const tags = form.holiday_tags || [];
              const isShortTerm = tags.length === 0;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, holiday_tags: [] })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                      isShortTerm
                        ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#1E6A6A]/40'
                    }`}
                    data-testid="sublease-type-short-term"
                  >
                    Short Term
                  </button>
                  {[{ key: 'sukkot', label: 'Sukkot' }, { key: 'pesach', label: 'Pesach' }].map(({ key, label }) => {
                    const active = tags.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const next = active ? tags.filter((t) => t !== key) : [...tags, key];
                          setForm({ ...form, holiday_tags: next });
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                          active
                            ? 'bg-[#D4AF37] text-white border-[#D4AF37]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]/40'
                        }`}
                        data-testid={`sublease-type-${key}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes for Sublessee</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. Furnished, utilities included, no pets..."
            rows={2}
            className={`${inputCls} resize-none`}
            data-testid="sublease-notes"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-md"
          style={{ backgroundColor: '#1E6A6A' }}
          data-testid="sublease-submit-btn"
        >
          <Send size={16} />
          {submitting
            ? editingId ? t('sublease.saving') : t('sublease.posting')
            : editingId ? t('sublease.saveChanges') : t('sublease.postListing')}
        </button>
      </form>
    </div>
  );
};

export default SubleaseForm;
;
