import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Search, RefreshCw, Calendar, Mail, Phone, Users as UsersIcon, ExternalLink, Home as HomeIcon, MessageCircle } from 'lucide-react';
import { getCoverImage } from '../../utils/coverImage';
import { API } from '../../lib/apiBase';

/**
 * Super Admin → Bookings tab.
 *
 * One row per booking with:
 *   • property thumbnail (drives the user's "see each booking with a
 *     picture of the apartment" request — uses the same `getCoverImage`
 *     helper the dashboard uses so a video-only listing still shows the
 *     auto-poster from frame 0, not a blank tile).
 *   • property title, area, rental type
 *   • guest name + email + phone
 *   • date range + nights
 *   • status pill (color-coded)
 *   • price (best-effort — nightly × N for vacation, lump otherwise)
 *
 * Status chips at the top double as filter pills and badge counters
 * (`{status}: 47`). Tapping the chip toggles the filter.
 *
 * Search box does a client-side filter against guest name/email + property
 * title — the typical bookings volume (low thousands) fits in memory, no
 * need for server-side fuzzy search yet.
 */
const STATUS_STYLES = {
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  cancellation_requested: 'bg-orange-100 text-orange-700 border-orange-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
};
const STATUS_LABELS = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
  cancellation_requested: 'Cancel requested',
  completed: 'Completed',
};

const BookingsTab = ({ token }) => {
  const [bookings, setBookings] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');  // '' = all
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/bookings`, {
        ...authHeaders,
        params: statusFilter ? { status: statusFilter, limit: 500 } : { limit: 500 },
      });
      setBookings(r.data.bookings || []);
      setStatusCounts(r.data.status_counts || {});
      setTotal(r.data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Client-side search across guest + property fields. Booking volume is
  // typically in the low thousands, so this stays fast without an index.
  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.trim().toLowerCase();
    return bookings.filter((b) =>
      (b.guest_name || '').toLowerCase().includes(q) ||
      (b.guest_email || '').toLowerCase().includes(q) ||
      (b.property_title || '').toLowerCase().includes(q) ||
      (b.property_area || '').toLowerCase().includes(q),
    );
  }, [bookings, search]);

  const nightsBetween = (start, end) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      return Math.max(1, Math.round((e - s) / 86400000));
    } catch {
      return 1;
    }
  };

  const formatPrice = (b) => {
    const sym = b.property_currency === 'USD' ? '$' : '₪';
    const nights = nightsBetween(b.start_date, b.end_date);
    if (b.property_rental_type === 'vacation' && b.property_nightly_price) {
      return `${sym}${(b.property_nightly_price * nights).toLocaleString()} (${nights} night${nights === 1 ? '' : 's'})`;
    }
    if (b.property_monthly_price) {
      return `${sym}${b.property_monthly_price.toLocaleString()}/mo`;
    }
    return '—';
  };

  // Build a one-click message to the property manager pre-filled with
  // every piece of context from the booking row (guest, dates, listing,
  // short ID). Used by both the mailto and wa.me (?text=) links so the
  // admin doesn't retype anything.
  const buildManagerMessage = (b) => {
    const shortId = String(b.id || '').slice(0, 8);
    const first = (b.manager_name || 'there').split(' ')[0];
    const dateRange = `${new Date(b.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(b.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const propLabel = b.property_title || 'your listing';
    const guest = b.guest_name ? ` for guest ${b.guest_name}` : '';
    const subject = `Regarding booking #${shortId} — ${propLabel}`;
    const body =
      `Hi ${first},\n\n` +
      `I'm reaching out from MyIsraelRental about booking #${shortId} at ${propLabel}${guest}, for ${dateRange}.\n\n` +
      `Could you let me know if there's anything you'd like us to help with?\n\n` +
      `Thanks,\nMyIsraelRental Admin`;
    return { subject, body };
  };

  return (
    <div data-testid="admin-bookings-section">
      {/* Header strip */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>
          Bookings <span className="text-sm font-normal text-gray-500">({total} total)</span>
        </h2>
        <button
          onClick={fetchBookings}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-[var(--gold)] disabled:opacity-50"
          data-testid="bookings-refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            statusFilter === ''
              ? 'bg-black text-[var(--gold)] border-black'
              : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
          }`}
          data-testid="bookings-filter-all"
        >
          All ({total})
        </button>
        {Object.entries(statusCounts).map(([s, n]) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              statusFilter === s
                ? 'bg-black text-[var(--gold)] border-black'
                : `${STATUS_STYLES[s] || 'bg-white text-gray-700 border-gray-200'} hover:border-[var(--gold)]`
            }`}
            data-testid={`bookings-filter-${s}`}
          >
            {STATUS_LABELS[s] || s} ({n})
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by guest, email, property, or area…"
          className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[var(--gold)]"
          data-testid="bookings-search"
        />
      </div>

      {/* Bookings grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[var(--brand-primary)]" size={28} />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          {search ? 'No bookings match your search.' : 'No bookings to show.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBookings.map((b) => {
            const cover = getCoverImage(b.property_images, 320, '', b.property_videos, b.property_id);
            const statusKey = b.status || 'unknown';
            const statusStyle = STATUS_STYLES[statusKey] || 'bg-gray-100 text-gray-700 border-gray-200';
            const nights = nightsBetween(b.start_date, b.end_date);
            return (
              <div
                key={b.id}
                className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden hover:border-[var(--gold)] hover:shadow-md transition-all flex"
                data-testid={`booking-row-${b.id}`}
              >
                {/* Property thumbnail — the centerpiece of the user's
                    "let me see each booking with a picture" ask */}
                <div
                  className="w-32 sm:w-40 shrink-0 bg-gray-100"
                  style={{
                    backgroundImage: `url(${cover.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate" data-testid={`booking-property-${b.id}`}>
                        {b.property_title || <span className="text-gray-400 italic">Property deleted</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{b.property_area || '—'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusStyle} shrink-0`}>
                      {STATUS_LABELS[statusKey] || statusKey}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-700 mt-2">
                    <Calendar size={12} className="text-[var(--brand-primary)] shrink-0" />
                    <span className="font-medium">
                      {new Date(b.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' → '}
                      {new Date(b.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">{nights} night{nights === 1 ? '' : 's'}</span>
                  </div>

                  {(b.guest_name || b.guest_email) && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Booked by</p>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        {b.guest_name && (
                          <div className="flex items-center gap-1.5 truncate">
                            <UsersIcon size={11} className="text-gray-400 shrink-0" />
                            <span className="font-medium">{b.guest_name}</span>
                            {b.number_of_guests > 0 && <span className="text-gray-400">· {b.number_of_guests} guest{b.number_of_guests === 1 ? '' : 's'}</span>}
                          </div>
                        )}
                        {b.guest_email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail size={11} className="text-gray-400 shrink-0" />
                            <a href={`mailto:${b.guest_email}`} className="text-[var(--brand-primary)] hover:underline truncate">{b.guest_email}</a>
                          </div>
                        )}
                        {b.guest_phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={11} className="text-gray-400 shrink-0" />
                            <a href={`tel:${b.guest_phone}`} className="text-gray-700 hover:text-[var(--brand-primary)]">{b.guest_phone}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(b.manager_email || b.manager_whatsapp) && (
                    <div className="mt-2 pt-2 border-t border-gray-100" data-testid={`booking-manager-${b.id}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Property manager</p>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        {b.manager_name && (
                          <div className="flex items-center gap-1.5 truncate">
                            <HomeIcon size={11} className="text-gray-400 shrink-0" />
                            <span className="font-medium">{b.manager_name}</span>
                            {b.manager_role && b.manager_role !== 'owner' && (
                              <span className="text-gray-400">· {b.manager_role}</span>
                            )}
                          </div>
                        )}
                        {b.manager_email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail size={11} className="text-gray-400 shrink-0" />
                            <a href={`mailto:${b.manager_email}`} className="text-[var(--brand-primary)] hover:underline truncate" data-testid={`booking-manager-email-${b.id}`}>{b.manager_email}</a>
                          </div>
                        )}
                        {b.manager_whatsapp && (
                          <div className="flex items-center gap-1.5">
                            <MessageCircle size={11} className="text-[#25D366] shrink-0" />
                            <a
                              href={`https://wa.me/${b.manager_whatsapp.replace(/[^\d+]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-700 hover:text-[var(--brand-primary)]"
                              data-testid={`booking-manager-whatsapp-${b.id}`}
                            >
                              {b.manager_whatsapp}
                            </a>
                          </div>
                        )}
                      </div>
                      {/* Pre-filled composer buttons — one click drops the
                          admin into email (or WhatsApp) with subject + body
                          already populated from the booking context. */}
                      {(b.manager_email || b.manager_whatsapp) && (() => {
                        const msg = buildManagerMessage(b);
                        return (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {b.manager_email && (
                              <a
                                href={`mailto:${b.manager_email}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white transition-colors"
                                data-testid={`booking-message-manager-email-${b.id}`}
                              >
                                <Mail size={11} />
                                Email manager
                              </a>
                            )}
                            {b.manager_whatsapp && (
                              <a
                                href={`https://wa.me/${b.manager_whatsapp.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(msg.body)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors"
                                data-testid={`booking-message-manager-whatsapp-${b.id}`}
                              >
                                <MessageCircle size={11} />
                                WhatsApp manager
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-bold text-sm text-[var(--brand-primary)]">{formatPrice(b)}</p>
                    {b.property_id && b.property_title && (
                      <a
                        href={`/property/${b.property_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-[var(--brand-primary)]"
                        data-testid={`booking-open-property-${b.id}`}
                      >
                        Open listing <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookingsTab;
