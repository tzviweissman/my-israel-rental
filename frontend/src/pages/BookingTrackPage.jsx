/**
 * /bookings/track/:token — a booking's status page, no account needed.
 *
 * Booking needs no sign-in (Tzvi, 7 Oct 2026), so a guest has no dashboard:
 * this page is where the business's answer arrives. Once the business marks
 * the booking completed, it offers a review, with this link as the proof.
 * Mirrors OrderTrackPage. Refreshes itself while open.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, CalendarCheck, Star } from 'lucide-react';
import { API } from '../lib/apiBase';

const REFRESH_MS = 30_000;

export default function BookingTrackPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [reviewsOn, setReviewsOn] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/marketplace/bookings/track/${encodeURIComponent(token)}`);
      setData(d);
    } catch (err) {
      if (err?.response?.status === 404) setData(false);
    }
  }, [token]);

  // No site chrome, like the order status page (OrderTrackPage).
  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    axios.get(`${API}/reviews/config`).then(({ data: c }) => setReviewsOn(!!c.native)).catch(() => {});
  }, []);

  const startReview = async () => {
    setReviewMsg('');
    try {
      const { data: r } = await axios.post(`${API}/bookings/track/${encodeURIComponent(token)}/review-link`);
      navigate(`/review/${encodeURIComponent(r.token)}`);
    } catch (err) {
      const code = err?.response?.data?.detail?.code;
      setReviewMsg(code === 'already_reviewed' ? t('bookingTrack.reviewDone', 'Thank you, you already reviewed this booking.')
        : t('bookingTrack.reviewClosed', 'This booking can no longer be reviewed.'));
    }
  };

  const lang = String(i18n.language || 'en').split('-')[0];
  if (data === null) return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="booking-track-bad-link">
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('bookingTrack.badLink', 'This link no longer works')}</h1>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business?.name_he) || data.business?.name || '';
  const title = (lang === 'he' && data.gig_title_he) || data.gig_title;
  const STATUS = {
    pending: t('bookingTrack.pending', 'Waiting for the business to reply'),
    accepted: t('bookingTrack.accepted', 'Confirmed'),
    declined: t('bookingTrack.declined', 'The business could not take this one'),
    completed: t('bookingTrack.completed', 'Done'),
    cancelled: t('bookingTrack.cancelled', 'Cancelled'),
    expired: t('bookingTrack.expired', 'No reply in time, so the time is free again'),
    cancellation_requested: t('bookingTrack.cancelling', 'Cancellation requested'),
  };
  const when = [data.preferred_date, data.time_slot].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="booking-track-page" data-status={data.status}>
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.from', 'Your booking with')}</p>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }} dir="auto">{bizName}</h1>

        <section className="mt-5 rounded-2xl border bg-white p-5" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="inline-flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--ink)' }} data-testid="booking-track-status">
            <CalendarCheck size={18} aria-hidden="true" /> {STATUS[data.status] || data.status}
          </p>
          <p className="mt-3 text-sm" style={{ color: 'var(--ink)' }} dir="auto">{title}{data.tier_name ? ` · ${data.tier_name}` : ''}</p>
          {when && <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>{when}</p>}
          {data.provider_reply && (
            <div className="mt-4 ps-3 border-s-2" style={{ borderColor: 'var(--gold)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.reply', 'Reply from the business')}</p>
              <p className="text-sm mt-0.5 whitespace-pre-line" style={{ color: 'var(--ink)' }} dir="auto">{data.provider_reply}</p>
            </div>
          )}
        </section>

        {reviewsOn && data.status === 'completed' && (
          <section className="mt-4 rounded-2xl border bg-white p-4 text-center" style={{ borderColor: 'var(--brand-border)' }} data-testid="booking-track-review">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.reviewAsk', 'How did it go?')}</p>
            <button type="button" onClick={startReview} className="mt-3 min-h-[44px] px-5 rounded-full text-sm font-bold inline-flex items-center gap-2"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="booking-track-review-button">
              <Star size={15} aria-hidden="true" /> {t('bookingTrack.reviewButton', 'Write a review')}
            </button>
            {reviewMsg && <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }} role="status">{reviewMsg}</p>}
          </section>
        )}

        <p className="text-xs mt-6 text-center" style={{ color: 'var(--brand-muted)' }}>
          {t('bookingTrack.keep', 'Keep this page: the business\'s reply appears here.')}
        </p>
      </main>
    </div>
  );
}
