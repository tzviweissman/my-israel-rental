/**
 * The review form (backend routes/reviews.py).
 *
 *   /review/:token               from the emailed link, no sign-in needed:
 *                                the signed single-use token is the proof
 *   /review/booking/:bookingId   signed in, from a past booking
 *
 * Overall stars are required; the detailed scores are for stays only and
 * optional. Nothing here offers anything in return for a review.
 */
import React, { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, CalendarDays, Loader2 } from 'lucide-react';
import { StarInput } from '../components/reviews/ReviewsSection';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';
const MIN = 20;

function fmt(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WriteReview() {
  const { token: linkToken, bookingId } = useParams();
  const { token } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const [info, setInfo] = useState(null);
  const [rating, setRating] = useState(0);
  const [subs, setSubs] = useState({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const req = linkToken
      ? axios.get(`${API}/reviews/request/${linkToken}`)
      : token ? axios.get(`${API}/reviews/eligibility/${bookingId}`, { headers: { Authorization: `Bearer ${token}` } })
        : Promise.resolve({ data: { eligible: false, reason: 'sign_in' } });
    req.then(({ data }) => setInfo(data)).catch((e) => setInfo({ eligible: false, reason: e.response?.status === 404 ? 'off' : 'error' }));
  }, [linkToken, bookingId, token]);

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) return setError(t('reviewForm.pickStars', 'Choose a star rating.'));
    if (text.trim().length < MIN) return setError(t('reviewForm.tooShort', { n: MIN, defaultValue: 'Write at least {{n}} characters.' }));
    setBusy(true);
    setError('');
    try {
      const body = { rating, text, sub_ratings: Object.keys(subs).length ? subs : undefined,
        ...(linkToken ? { token: linkToken } : { booking_id: bookingId }) };
      await axios.post(`${API}/reviews`, body, token && !linkToken ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      setDone(true);
    } catch (err) {
      const code = err.response?.data?.detail?.code;
      setError(code ? t(`reviewForm.reason_${code}`, t('reviewForm.failed', 'Your review did not send. Try again.')) : t('reviewForm.failed', 'Your review did not send. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const listingHref = info?.listing_kind === 'property' ? `/property/${info.listing_id}` : info?.listing_id ? `/services/gig/${info.listing_id}` : '/';

  return (
    <main className="min-h-screen px-4 pt-24 pb-16" style={{ background: 'var(--bg)' }} data-testid="write-review-page">
      <PageMeta title={t('reviewForm.metaTitle', 'Write a review')} noindex />
      <div className="max-w-xl mx-auto">
        {!info && <div className="py-24 text-center" style={{ color: MUTED }}><Loader2 className="animate-spin inline" size={20} /></div>}

        {info && done && (
          <div className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: BORDER }} data-testid="write-review-done">
            <BadgeCheck size={36} className="mx-auto" style={{ color: 'var(--success)' }} aria-hidden="true" />
            <h1 className="mt-3 text-2xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              {t('reviewForm.thanks', 'Thank you. Your review is up.')}
            </h1>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>{t('reviewForm.editWindow', 'You can change it for the next 48 hours from the listing page.')}</p>
            <Link to={listingHref} className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-bold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('reviewForm.seeIt', 'See it on the page')}</Link>
          </div>
        )}

        {info && !done && !info.eligible && (
          <div className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: BORDER }} data-testid="write-review-closed">
            <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              {t('reviewForm.closedTitle', "This review can't be written")}
            </h1>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              {t(`reviewForm.reason_${info.reason}`, t('reviewForm.reason_error', 'Something went wrong. Try the link again later.'))}
            </p>
            {info.reason === 'sign_in' && (
              <Link to={`/auth/login?redirect=${encodeURIComponent(`/review/booking/${bookingId}`)}`} className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-bold"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('reviewForm.signIn', 'Sign in')}</Link>
            )}
          </div>
        )}

        {info && !done && info.eligible && (
          <form onSubmit={submit} className="rounded-2xl border bg-white p-5 sm:p-6 space-y-5" style={{ borderColor: BORDER }} noValidate data-testid="write-review-form">
            <div>
              <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                {info.kind === 'stay' ? t('reviewForm.titleStay', 'How was your stay?') : t('reviewForm.titleService', 'How did it go?')}
              </h1>
              <p className="mt-1 font-semibold text-sm" style={{ color: 'var(--ink)' }} dir="auto">{info.listing_title}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm" style={{ color: MUTED }} data-testid="write-review-dates">
                <CalendarDays size={14} aria-hidden="true" />
                {info.stay_start && info.stay_end && info.stay_start !== info.stay_end
                  ? t('reviewForm.dateRange', { from: fmt(info.stay_start, i18n.language), to: fmt(info.stay_end, i18n.language), defaultValue: '{{from}} to {{to}}' })
                  : fmt(info.stay_end || info.stay_start, i18n.language)}
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('reviewForm.overall', 'Overall')} *</legend>
              <StarInput value={rating} onChange={setRating} size={34} label={t('reviewForm.overall', 'Overall')} testid="write-review-star" />
            </fieldset>

            {info.sub_ratings?.length > 0 && (
              <fieldset>
                <legend className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('reviewForm.details', 'In detail (optional)')}</legend>
                <div className="mt-1 divide-y" style={{ borderColor: BORDER }}>
                  {info.sub_ratings.map((k) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{t(`reviews.sub_${k}`)}</span>
                      <StarInput value={subs[k] || 0} onChange={(v) => setSubs((s) => ({ ...s, [k]: v }))} size={24} label={t(`reviews.sub_${k}`)} testid={`write-review-${k}`} />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <div>
              <label htmlFor="review-text" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('reviewForm.textLabel', 'Your review')} *</label>
              <textarea id="review-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={2000}
                placeholder={t('reviewForm.textHint', 'What should the next person know? Good or bad, say what happened.')}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-base" style={{ borderColor: BORDER }} data-testid="write-review-text" />
              <p className="text-xs mt-1" style={{ color: text.trim().length >= MIN ? MUTED : 'var(--ink)' }} aria-live="polite">
                {text.trim().length < MIN
                  ? t('reviewForm.moreChars', { count: MIN - text.trim().length, defaultValue: '{{count}} more characters' })
                  : `${text.length}/2000`}
              </p>
            </div>

            {error && <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--ink)' }} data-testid="write-review-error">{error}</p>}

            <p className="text-xs" style={{ color: MUTED }}>
              {t('reviewForm.publicNote', 'Your first name and last initial appear with your review, marked as a verified booking.')}
            </p>
            <button type="submit" disabled={busy} className="w-full min-h-[48px] rounded-full text-base font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="write-review-submit">
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {t('reviewForm.submit', 'Post review')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
