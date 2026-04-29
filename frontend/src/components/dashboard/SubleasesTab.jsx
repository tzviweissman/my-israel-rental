import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Plus, Home, Check, Send, FileText, Upload, Loader2, Copy, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';
import { Calendar as CalendarComponent } from '../ui/calendar';

// Parse YYYY-MM-DD without UTC midnight drift (matches AddPropertyModal helper)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Renter "My Subleases" dashboard tab.
 * Handles the whole CRUD: pick a booking → fill details → post → upload
 * contract → share signing link → pause/remove.
 * Self-contained (owns all state + fetches).
 */
const SubleasesTab = ({ API, token }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    property_id: '',
    available_from: '',
    available_to: '',
    price: '',
    price_type: 'per_night',
    currency: 'ILS',
    bedrooms_available: '',
    notes: '',
    holiday_tags: [],
  });
  const [myBookings, setMyBookings] = useState([]);
  const [mySubleases, setMySubleases] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [copiedSignLink, setCopiedSignLink] = useState(null);
  // Single hidden file input rendered once outside the list. We track which
  // sublease triggered it so the onChange handler uploads to the correct row.
  const [uploadTargetId, setUploadTargetId] = useState(null);
  const fileRef = useRef(null);
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const fromCalendarRef = useRef(null);
  const toCalendarRef = useRef(null);

  // Close calendar popovers when clicking outside
  useEffect(() => {
    const onClick = (e) => {
      if (fromCalendarRef.current && !fromCalendarRef.current.contains(e.target)) {
        setShowFromCalendar(false);
      }
      if (toCalendarRef.current && !toCalendarRef.current.contains(e.target)) {
        setShowToCalendar(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchMySubleases = async () => {
    try {
      const res = await axios.get(`${API}/my-subleases`, authHeaders);
      setMySubleases(res.data || []);
    } catch (err) {
      console.error('Failed to fetch subleases', err);
    }
  };

  const fetchRenterBookings = async () => {
    try {
      const res = await axios.get(`${API}/bookings`, authHeaders);
      const bookingsWithProps = await Promise.all(
        res.data.map(async (b) => {
          try {
            const propRes = await axios.get(`${API}/properties/${b.property_id}`);
            return { ...b, property: propRes.data };
          } catch {
            return { ...b, property: null };
          }
        }),
      );
      setMyBookings(bookingsWithProps.filter((b) => b.property));
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  };

  useEffect(() => {
    fetchMySubleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () =>
    setForm({
      property_id: '',
      available_from: '',
      available_to: '',
      price: '',
      price_type: 'per_night',
      currency: 'ILS',
      bedrooms_available: '',
      notes: '',
      holiday_tags: [],
    });

  const openForm = () => {
    if (!showForm) fetchRenterBookings();
    setShowForm(!showForm);
  };

  const selectPropertyForSublease = (booking) => {
    setForm({
      ...form,
      property_id: booking.property_id,
      bedrooms_available: booking.property?.bedrooms?.toString() || '',
    });
    setShowForm(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.property_id || !form.available_from || !form.available_to || !form.price) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/subleases`,
        {
          property_id: form.property_id,
          available_from: form.available_from,
          available_to: form.available_to,
          price: parseFloat(form.price),
          price_type: form.price_type,
          currency: form.currency,
          holiday_tags: form.holiday_tags,
          bedrooms_available: form.bedrooms_available ? parseInt(form.bedrooms_available) : null,
          notes: form.notes,
        },
        authHeaders,
      );
      toast.success('Sublease listed successfully!');
      resetForm();
      setShowForm(false);
      fetchMySubleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create sublease.');
    } finally {
      setSubmitting(false);
    }
  };

  // Use a sonner confirm toast instead of window.confirm (blocked in iframe)
  const confirmDelete = (subleaseId) => {
    toast.custom(
      (tid) => (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
          <p className="text-sm font-semibold text-gray-800 mb-1">Remove sublease listing?</p>
          <p className="text-xs text-gray-500 mb-3">This action cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(tid)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(tid);
                performDelete(subleaseId);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
              data-testid={`confirm-delete-sublease-${subleaseId}`}
            >
              Remove
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const performDelete = async (subleaseId) => {
    try {
      await axios.delete(`${API}/subleases/${subleaseId}`, authHeaders);
      toast.success('Sublease removed.');
      fetchMySubleases();
    } catch (err) {
      toast.error('Failed to remove sublease.');
    }
  };

  const toggleActive = async (subleaseId, currentActive) => {
    try {
      await axios.put(`${API}/subleases/${subleaseId}`, { active: !currentActive }, authHeaders);
      toast.success(!currentActive ? 'Sublease reactivated' : 'Sublease paused');
      fetchMySubleases();
    } catch (err) {
      toast.error('Failed to update sublease.');
    }
  };

  const handleContractUpload = async (subleaseId, file) => {
    if (!file) return;
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF, DOCX, JPG, PNG, or WebP file.');
      return;
    }
    setUploadingFor(subleaseId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/subleases/${subleaseId}/contract`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Contract uploaded! Share the signing link with your sublessee.');
      fetchMySubleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload contract.');
    } finally {
      setUploadingFor(null);
    }
  };

  const copySignLink = (signToken) => {
    const link = `${window.location.origin}/sign/${signToken}`;
    navigator.clipboard.writeText(link);
    setCopiedSignLink(signToken);
    toast.success('Signing link copied to clipboard!');
    setTimeout(() => setCopiedSignLink(null), 3000);
  };

  const imageUrl = (images) => {
    const first = images?.[0];
    if (!first) return '';
    return first.startsWith('/api') ? `${API.replace('/api', '')}${first}` : first;
  };

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm';

  return (
    <div className="space-y-6" data-testid="subleases-tab">
      {/* Single shared file picker — triggered per row via uploadTargetId */}
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetId) handleContractUpload(uploadTargetId, file);
          e.target.value = '';
          setUploadTargetId(null);
        }}
      />
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#1E6A6A] to-[#267a7a] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Home size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus size={20} className="text-white" />
                  Sublease Your Property
                </h3>
                <p className="text-white/80 text-sm">Post your rental for others in just a few clicks</p>
              </div>
            </div>
            <button
              onClick={openForm}
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all backdrop-blur-sm"
              data-testid="create-sublease-btn"
            >
              {showForm ? 'Cancel' : '+ New Sublease'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {showForm && (
            <div className="mb-6 bg-gray-50 rounded-xl p-5" data-testid="sublease-form-section">
              {!form.property_id ? (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Step 1: Select the property you're renting</h4>
                  {myBookings.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm">You don't have any active bookings to sublease.</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Book a property first, then you can sublease it here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                          <span className="text-xs font-medium text-[#1E6A6A]">Select →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-800">Step 2: Set your sublease details</h4>
                    <button
                      onClick={() => setForm({ ...form, property_id: '' })}
                      className="text-xs text-gray-500 hover:text-[#1E6A6A]"
                    >
                      ← Change property
                    </button>
                  </div>

                  {(() => {
                    const selectedBooking = myBookings.find((b) => b.property_id === form.property_id);
                    return selectedBooking?.property ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#1E6A6A]/20 mb-4">
                        <div
                          className="w-12 h-12 rounded-lg bg-gray-200 shrink-0"
                          style={{
                            backgroundImage: `url(${imageUrl(selectedBooking.property.images)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{selectedBooking.property.title}</p>
                          <p className="text-xs text-gray-500">{selectedBooking.property.area}</p>
                        </div>
                        <Check size={18} className="text-[#1E6A6A] ml-auto" />
                      </div>
                    ) : null;
                  })()}

                  <form onSubmit={handleCreate} className="space-y-4" data-testid="sublease-form">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative" ref={fromCalendarRef}>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#1E6A6A]" />
                          Available From
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowFromCalendar((v) => !v);
                            setShowToCalendar(false);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-[#1E6A6A]/40 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm text-left flex items-center justify-between transition-all"
                          data-testid="sublease-from-date"
                        >
                          <span className={form.available_from ? 'text-gray-700' : 'text-gray-400'}>
                            {form.available_from
                              ? format(parseLocalDate(form.available_from), 'MMMM d, yyyy')
                              : 'Select start date'}
                          </span>
                          <Calendar size={16} className="text-[#1E6A6A]/50" />
                        </button>
                        {showFromCalendar && (
                          <div className="absolute top-full mt-2 left-0 bg-white rounded-xl border-2 border-[#1E6A6A] shadow-2xl p-4 z-[100] w-[320px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFromCalendar(false);
                              }}
                              className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                            >
                              <X size={14} />
                            </button>
                            <CalendarComponent
                              mode="single"
                              selected={parseLocalDate(form.available_from)}
                              defaultMonth={parseLocalDate(form.available_from) || new Date()}
                              onSelect={(date) => {
                                if (date) {
                                  const next = format(date, 'yyyy-MM-dd');
                                  setForm((f) => ({
                                    ...f,
                                    available_from: next,
                                    // Clear available_to if it's now before the new start
                                    available_to:
                                      f.available_to && f.available_to < next ? '' : f.available_to,
                                  }));
                                  setShowFromCalendar(false);
                                }
                              }}
                              disabled={[{ before: new Date() }]}
                              initialFocus
                            />
                          </div>
                        )}
                      </div>
                      <div className="relative" ref={toCalendarRef}>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#D4AF37]" />
                          Available To
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowToCalendar((v) => !v);
                            setShowFromCalendar(false);
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm text-left flex items-center justify-between transition-all"
                          data-testid="sublease-to-date"
                        >
                          <span className={form.available_to ? 'text-gray-700' : 'text-gray-400'}>
                            {form.available_to
                              ? format(parseLocalDate(form.available_to), 'MMMM d, yyyy')
                              : 'Select end date'}
                          </span>
                          <Calendar size={16} className="text-[#D4AF37]/60" />
                        </button>
                        {showToCalendar && (
                          <div className="absolute top-full mt-2 right-0 bg-white rounded-xl border-2 border-[#D4AF37] shadow-2xl p-4 z-[100] w-[320px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowToCalendar(false);
                              }}
                              className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                            >
                              <X size={14} />
                            </button>
                            <CalendarComponent
                              mode="single"
                              selected={parseLocalDate(form.available_to)}
                              defaultMonth={
                                parseLocalDate(form.available_to) ||
                                parseLocalDate(form.available_from) ||
                                new Date()
                              }
                              onSelect={(date) => {
                                if (date) {
                                  setForm({ ...form, available_to: format(date, 'yyyy-MM-dd') });
                                  setShowToCalendar(false);
                                }
                              }}
                              disabled={[
                                {
                                  before: form.available_from
                                    ? parseLocalDate(form.available_from)
                                    : new Date(),
                                },
                              ]}
                              initialFocus
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Price</label>
                        <div className="flex items-stretch rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#1E6A6A]/30 focus-within:border-[#1E6A6A] transition-all">
                          <select
                            value={form.currency}
                            onChange={(e) => setForm({ ...form, currency: e.target.value })}
                            className="bg-gray-50 border-0 border-r border-gray-200 pl-3 pr-7 text-sm font-medium text-gray-700 focus:outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                            data-testid="sublease-currency"
                            aria-label="Currency"
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
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Price Type</label>
                        <select
                          value={form.price_type}
                          onChange={(e) => setForm({ ...form, price_type: e.target.value })}
                          className={inputCls}
                          data-testid="sublease-price-type"
                        >
                          <option value="per_night">Per Night</option>
                          <option value="flat">Flat Rate (Total)</option>
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
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Sublease Type
                      </label>
                      <p className="text-[11px] text-gray-500 mb-2">
                        Defaults to Short Term. Tick Sukkot and/or Pesach to also list under those holiday categories.
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
                              {[
                                { key: 'sukkot', label: 'Sukkot' },
                                { key: 'pesach', label: 'Pesach' },
                              ].map(({ key, label }) => {
                                const active = tags.includes(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                      const next = active
                                        ? tags.filter((t) => t !== key)
                                        : [...tags, key];
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
                      {submitting ? 'Posting...' : 'Post Sublease Listing'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {mySubleases.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Your Sublease Listings</h4>
              {mySubleases.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                  data-testid={`sublease-${sub.id}`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div
                      className="w-16 h-16 rounded-lg bg-gray-200 shrink-0"
                      style={{
                        backgroundImage: `url(${imageUrl(sub.images)})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-800 truncate">{sub.title}</p>
                      <p className="text-xs text-gray-500">
                        {sub.area} • {sub.bedrooms_available} bed
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(sub.available_from).toLocaleDateString()} —{' '}
                        {new Date(sub.available_to).toLocaleDateString()}
                      </p>
                      {sub.holiday_tags && sub.holiday_tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {sub.holiday_tags.includes('sukkot') && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D4AF37]/15 text-[#8a6d1d]">
                              Sukkot
                            </span>
                          )}
                          {sub.holiday_tags.includes('pesach') && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D4AF37]/15 text-[#8a6d1d]">
                              Pesach
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold" style={{ color: '#D4AF37' }}>
                        {sub.currency === 'USD' ? '$' : '₪'}
                        {sub.price?.toLocaleString()}
                        <span className="text-[10px] font-normal text-gray-500">
                          {sub.price_type === 'per_night' ? '/night' : ' total'}
                        </span>
                      </p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          sub.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {sub.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(sub.id, sub.active)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-colors"
                        data-testid={`toggle-sublease-${sub.id}`}
                      >
                        {sub.active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => confirmDelete(sub.id)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors"
                        data-testid={`delete-sublease-${sub.id}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    {sub.contract_id && sub.sign_token ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText size={16} className="text-[#1E6A6A] shrink-0" />
                          <span className="text-xs font-medium text-gray-700 truncate">Contract uploaded</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                              sub.contract_signed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {sub.contract_signed ? 'Signed' : 'Awaiting signature'}
                          </span>
                        </div>
                        <button
                          onClick={() => copySignLink(sub.sign_token)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1E6A6A]/20 text-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors shrink-0"
                          data-testid={`copy-sign-link-${sub.id}`}
                        >
                          {copiedSignLink === sub.sign_token ? (
                            <>
                              <Check size={12} /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copy Signing Link
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setUploadTargetId(sub.id);
                            fileRef.current?.click();
                          }}
                          disabled={uploadingFor === sub.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors disabled:opacity-50"
                          data-testid={`upload-contract-${sub.id}`}
                        >
                          {uploadingFor === sub.id ? (
                            <>
                              <Loader2 size={12} className="animate-spin" /> Uploading...
                            </>
                          ) : (
                            <>
                              <Upload size={12} /> Upload Contract for Sublessee to Sign
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !showForm ? (
            <div className="text-center py-6">
              <Home size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">No active subleases</p>
              <p className="text-gray-400 text-xs mt-1">
                Click "+ New Sublease" to post your rental for others.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SubleasesTab;
