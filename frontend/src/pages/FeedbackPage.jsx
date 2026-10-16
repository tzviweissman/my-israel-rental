/**
 * /feedback/:token, the "How did we do?" page from the day-after email
 * (backend routes/marketplace/feedback.py). No account. The star tapped in
 * the email arrives as ?rating=n and is saved at once; a comment is
 * optional; both go to the business only.
 *
 * After sending, everyone is offered the public review where one is
 * possible, whatever they scored: inviting only the happy customers would
 * skew the ratings other people rely on.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, Lock } from 'lucide-react';
import { API } from '../lib/apiBase';
import { StarInput } from '../components/reviews/ReviewsSection';

export default function FeedbackPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [d, setD] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [reviewsOn, setReviewsOn] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const saved = useRef(false);
  const url = `${API}/marketplace/feedback/${encodeURIComponent(token)}`;

  useEffect(() => { document.body.classList.add('orders-bare'); return () => document.body.classList.remove('orders-bare'); }, []);
  useEffect(() => {
    axios.get(url).then(({ data }) => {
      setD(data);
      setComment(data.comment || '');
      const fromEmail = Number(params.get('rating'));
      const r = fromEmail >= 1 && fromEmail <= 5 ? fromEmail : data.rating || 0;
      setRating(r);
      // The tap in the email already counts, even if they close the page.
      if (fromEmail >= 1 && fromEmail <= 5 && !saved.current) {
        saved.current = true;
        axios.post(url, { rating: fromEmail, comment: data.comment || '', final: false }).catch(() => {});
      }
    }).catch(() => setD(false));
    axios.get(`${API}/reviews/config`).then(({ data: c }) => setReviewsOn(!!c.native)).catch(() => {});
  }, [url, params]);

  const send = async () => {
    setBusy(true);
    try {
      await axios.post(url, { rating, comment, final: true });
      setSent(true);
    } catch { /* the button stays for another try */ } finally { setBusy(false); }
  };

  const publicReview = async () => {
    setReviewMsg('');
    const path = d.kind === 'order' ? 'orders' : 'bookings';
    try {
      const { data: r } = await axios.post(`${API}/${path}/track/${encodeURIComponent(d.review_track_token)}/review-link`);
      navigate(`/review/${encodeURIComponent(r.token)}?rating=${rating}`);
    } catch (err) {
      const code = err?.response?.data?.detail?.code;
      setReviewMsg(code === 'already_reviewed' ? t('feedback.alreadyReviewed', 'You already left a review. Thank you.')
        : t('feedback.reviewClosed', 'A public review is not possible for this one.'));
    }
  };

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (d === false) return <div className="max-w-md mx-auto px-4 py-24 text-center"><h1 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.badLink', 'This link no longer works')}</h1></div>;
  const biz = (lang === 'he' && d.business.name_he) || d.business.name;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="feedback-page">
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('feedback.eyebrow', 'Your feedback for')}</p>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }} dir="auto">{biz}</h1>
        {d.what && <p className="text-sm mt-0.5" dir="auto" style={{ color: 'var(--brand-muted)' }}>{d.what}</p>}

        <section className="mt-5 rounded-2xl border bg-white p-5" style={{ borderColor: 'var(--brand-border)' }}>
          {sent ? (
            <div data-testid="feedback-sent">
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('feedback.thanks', 'Thank you. {{b}} has your feedback.', { b: biz })}</p>
              {reviewsOn && d.review_track_token && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--brand-border)' }}>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('feedback.publicAsk', 'Would you also like to leave a public review, to help other customers decide?')}</p>
                  <button type="button" onClick={publicReview} className="mt-3 px-4 min-h-[44px] rounded-full border text-sm font-semibold"
                          style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="feedback-public-review">
                    {t('feedback.publicBtn', 'Write a public review')}
                  </button>
                  {reviewMsg && <p className="text-xs mt-2" role="status" style={{ color: 'var(--brand-muted)' }}>{reviewMsg}</p>}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('feedback.ask', 'How did we do?')}</p>
              <div className="mt-2"><StarInput value={rating} onChange={setRating} size={32} label={t('feedback.stars', 'Your rating')} testid="feedback-stars" /></div>
              <label className="block mt-4 text-sm" style={{ color: 'var(--ink)' }}>
                {rating && rating <= 3 ? t('feedback.lowAsk', 'What could have been better?') : t('feedback.commentAsk', 'Anything you would like to tell them? (optional)')}
                <textarea rows={4} maxLength={2000} dir="auto" value={comment} onChange={(e) => setComment(e.target.value)}
                          className="mt-1.5 w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="feedback-comment" />
              </label>
              <button type="button" disabled={!rating || busy} onClick={send}
                      className="mt-3 w-full inline-flex items-center justify-center gap-1.5 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-50"
                      style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="feedback-send">
                {busy && <Loader2 size={14} className="animate-spin" />} {t('feedback.send', 'Send to {{b}}', { b: biz })}
              </button>
              <p className="mt-3 text-xs inline-flex items-center gap-1.5" style={{ color: 'var(--brand-muted)' }}>
                <Lock size={12} aria-hidden="true" /> {t('feedback.private', 'Only the business sees this. It is not posted anywhere.')}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
