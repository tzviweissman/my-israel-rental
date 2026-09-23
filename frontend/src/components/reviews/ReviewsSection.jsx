/**
 * Verified reviews on a listing or business page (backend routes/reviews.py).
 *
 * Two sources, never blended: verified guest reviews and a business's own
 * Google reviews, each with its own average. No filter hides low ratings;
 * sorting is the only control. The owner may respond once to a verified
 * review, and anyone signed in may report one, which leaves it visible
 * until an admin decides.
 *
 * When both review flags are off the endpoint says so and this renders
 * `fallback` (the old section on a service page, nothing elsewhere), so a
 * page looks exactly as it did before.
 */
import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BadgeCheck, ExternalLink, Flag, Loader2, Star } from 'lucide-react';
import { API, AuthContext } from '../../App';
import StarRating from '../marketplace/StarRating';

const REPORT_REASONS = ['spam', 'hate_or_harassment', 'personal_information', 'off_topic', 'conflict_of_interest', 'illegal_content', 'other'];
const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';

function monthYear(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
}

function Summary({ summary, kind, t }) {
  const parts = [];
  if (summary.native) {
    const n = summary.native.count;
    // A business page mixes stays and services, so it says "reviews".
    parts.push({ key: 'native', avg: summary.native.avg, label: kind === 'property'
      ? t('reviews.verifiedStays', { count: n, defaultValue: '{{count}} verified stays' })
      : kind === 'business'
        ? t('reviews.verifiedReviews', { count: n, defaultValue: '{{count}} verified reviews' })
        : t('reviews.verifiedCustomers', { count: n, defaultValue: '{{count}} verified customers' }) });
  }
  if (summary.google) {
    parts.push({ key: 'google', avg: summary.google.avg,
      label: t('reviews.googleReviews', { count: summary.google.count, defaultValue: '{{count}} Google reviews' }) });
  }
  return (
    // Spacing, not a separator: a "|" is left dangling at a line end when
    // the two averages wrap on a phone.
    <p className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm" data-testid="reviews-summary">
      {parts.map((p) => (
        <React.Fragment key={p.key}>
          <span className="inline-flex items-center gap-1.5" data-testid={`reviews-summary-${p.key}`}>
            <Star size={15} className="fill-[var(--gold)] text-[var(--gold)]" aria-hidden="true" />
            <strong style={{ color: 'var(--ink)' }}>{p.avg.toFixed(1)}</strong>
            <span style={{ color: MUTED }}>· {p.label}</span>
          </span>
        </React.Fragment>
      ))}
    </p>
  );
}

function SourceBadge({ r, t, lang }) {
  if (r.source === 'google') {
    const inner = (
      <>
        <span className="font-semibold">{t('reviews.badgeGoogle', 'From Google')}</span>
        {r.external_url && <ExternalLink size={12} aria-hidden="true" />}
      </>
    );
    return r.external_url ? (
      <a href={r.external_url} target="_blank" rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-1 text-xs underline underline-offset-2" style={{ color: MUTED }}
        data-testid="review-badge-google">{inner}</a>
    ) : <span className="inline-flex items-center gap-1 text-xs" style={{ color: MUTED }} data-testid="review-badge-google">{inner}</span>;
  }
  const label = r.booking_kind === 'stay'
    ? t('reviews.badgeStay', { when: monthYear(r.stay_end || r.stay_start, lang), defaultValue: 'Verified stay · {{when}}' })
    : t('reviews.badgeCustomer', 'Verified customer');
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: 'var(--success-bg)', color: 'var(--success)' }} data-testid="review-badge-verified">
      <BadgeCheck size={13} aria-hidden="true" /> {label}
    </span>
  );
}

function ReportForm({ review, token, onDone, t }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    try {
      await axios.post(`${API}/reviews/${review.id}/report`, { reason, note }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(t('reviews.reportThanks', "Thanks. We'll check it, and it stays up until we decide."));
      onDone(true);
    } catch (err) {
      toast.error(err.response?.status === 429 ? t('reviews.tooMany', 'Too many reports. Try again later.') : t('reviews.reportFailed', 'That did not send. Try again.'));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="mt-3 p-3 rounded-xl border space-y-2" style={{ borderColor: BORDER }} data-testid="review-report-form">
      <label className="block text-sm font-semibold" htmlFor={`report-${review.id}`} style={{ color: 'var(--ink)' }}>
        {t('reviews.reportTitle', 'Why are you reporting this review?')}
      </label>
      <select id={`report-${review.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required
        className="w-full min-h-[44px] px-3 rounded-lg border bg-white text-sm" style={{ borderColor: BORDER }} data-testid="review-report-reason">
        <option value="">{t('reviews.reportPick', 'Choose a reason')}</option>
        {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`reviews.reason_${r}`)}</option>)}
      </select>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
        placeholder={t('reviews.reportNote', 'Anything we should know (optional)')}
        className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: BORDER }} />
      <p className="text-xs" style={{ color: MUTED }}>{t('reviews.reportNotNegative', 'A review is not removed for being negative.')}</p>
      <div className="flex gap-3">
        <button type="submit" disabled={!reason || busy} className="min-h-[44px] px-4 rounded-full text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="review-report-send">
          {t('reviews.reportSend', 'Send report')}
        </button>
        <button type="button" onClick={() => onDone(false)} className="min-h-[44px] px-2 text-sm font-semibold underline" style={{ color: MUTED }}>
          {t('reviews.cancel', 'Cancel')}
        </button>
      </div>
    </form>
  );
}

function RespondForm({ review, token, onSaved, onCancel, t }) {
  const [text, setText] = useState(review.owner_response?.text || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/reviews/${review.id}/response`, { text }, { headers: { Authorization: `Bearer ${token}` } });
      onSaved(data);
    } catch {
      toast.error(t('reviews.respondFailed', 'Your response did not save. Try again.'));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="mt-3 space-y-2" data-testid="review-respond-form">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} required
        aria-label={t('reviews.respondLabel', 'Your public response')}
        placeholder={t('reviews.respondPlaceholder', 'Your public response. Everyone who reads the review will see it.')}
        className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: BORDER }} />
      <div className="flex gap-3">
        <button type="submit" disabled={busy || !text.trim()} className="min-h-[44px] px-4 rounded-full text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>
          {t('reviews.respondSave', 'Post response')}
        </button>
        <button type="button" onClick={onCancel} className="min-h-[44px] px-2 text-sm font-semibold underline" style={{ color: MUTED }}>
          {t('reviews.cancel', 'Cancel')}
        </button>
      </div>
    </form>
  );
}

/** Five stars as a radio group, each a 44px target (the shared
 *  StarRating's buttons are sized for display, about 26px). */
export function StarInput({ value, onChange, size = 30, label, testid }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex" data-testid={testid}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}
          aria-label={t('reviewForm.starsN', { count: n, defaultValue: '{{count}} stars' })}
          className="w-11 h-11 inline-flex items-center justify-center" data-testid={`${testid}-${n}`}>
          <Star size={size} aria-hidden="true" className={n <= value ? 'text-[var(--gold)] fill-[var(--gold)]' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  );
}

function EditForm({ review, token, onSaved, onCancel, t }) {
  const [rating, setRating] = useState(review.rating);
  const [text, setText] = useState(review.text || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.patch(`${API}/reviews/${review.id}`, { rating, text }, { headers: { Authorization: `Bearer ${token}` } });
      onSaved(data);
    } catch (err) {
      toast.error(err.response?.data?.detail?.message || t('reviews.editFailed', 'Your change did not save.'));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="mt-3 space-y-2" data-testid="review-edit-form">
      <StarInput value={rating} onChange={setRating} size={28} label={t('reviewForm.overall', 'Overall')} testid="review-edit-star" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} minLength={20} maxLength={2000} rows={4} required
        aria-label={t('reviewForm.textLabel', 'Your review')} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: BORDER }} />
      <div className="flex gap-3">
        <button type="submit" disabled={busy || text.trim().length < 20} className="min-h-[44px] px-4 rounded-full text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('reviews.save', 'Save')}</button>
        <button type="button" onClick={onCancel} className="min-h-[44px] px-2 text-sm font-semibold underline" style={{ color: MUTED }}>
          {t('reviews.cancel', 'Cancel')}
        </button>
      </div>
    </form>
  );
}

function ReviewCard({ r, kind, token, onChange, t, lang }) {
  const [mode, setMode] = useState(null); // 'report' | 'respond' | 'edit'
  const [reported, setReported] = useState(false);
  const responder = kind === 'property' ? t('reviews.responseHost', 'Response from the host') : t('reviews.responseBusiness', 'Response from the business');
  return (
    <li className="py-5 border-b last:border-b-0" style={{ borderColor: BORDER }} data-testid="review-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }} dir="auto">{r.author_display_name}</span>
        <StarRating value={r.rating} showCount={false} size={14} testidPrefix="review-stars" />
        <span className="text-xs" style={{ color: MUTED }}>{monthYear(r.date, lang)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <SourceBadge r={r} t={t} lang={lang} />
        {r.edited && <span className="text-xs" style={{ color: MUTED }}>{t('reviews.edited', 'Edited')}</span>}
        {r.incentivized && <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t('reviews.incentivized', 'The writer received something for this review')}</span>}
      </div>
      {r.text && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--ink)' }} dir="auto">{r.text}</p>}
      {r.sub_ratings && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: MUTED }}>
          {Object.entries(r.sub_ratings).map(([k, v]) => (
            <div key={k} className="inline-flex gap-1"><dt>{t(`reviews.sub_${k}`)}</dt><dd className="font-semibold" style={{ color: 'var(--ink)' }}>{v}/5</dd></div>
          ))}
        </dl>
      )}
      {r.owner_response?.text && mode !== 'respond' && (
        <div className="mt-3 ps-3 border-s-2" style={{ borderColor: 'var(--gold)' }} data-testid="review-owner-response">
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{responder}</p>
          <p className="text-sm mt-0.5 whitespace-pre-line" style={{ color: 'var(--ink)' }} dir="auto">{r.owner_response.text}</p>
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4">
        {r.can_edit && !mode && (
          <button type="button" onClick={() => setMode('edit')} className="min-h-[44px] text-xs font-semibold underline underline-offset-2"
            style={{ color: 'var(--ink)' }} data-testid="review-edit">
            {t('reviews.edit', 'Edit your review')}
          </button>
        )}
        {r.can_respond && mode !== 'respond' && (
          <button type="button" onClick={() => setMode('respond')} className="min-h-[44px] text-xs font-semibold underline underline-offset-2"
            style={{ color: 'var(--ink)' }} data-testid="review-respond">
            {r.owner_response ? t('reviews.respondEdit', 'Edit your response') : t('reviews.respond', 'Respond publicly')}
          </button>
        )}
        {!reported && mode !== 'report' && (
          <button type="button" className="min-h-[44px] inline-flex items-center gap-1 text-xs underline underline-offset-2" style={{ color: MUTED }}
            onClick={() => (token ? setMode('report') : toast(t('reviews.reportSignIn', 'Sign in to report a review')))} data-testid="review-report">
            <Flag size={12} aria-hidden="true" /> {t('reviews.report', 'Report')}
          </button>
        )}
      </div>
      {mode === 'report' && <ReportForm review={r} token={token} t={t} onDone={(sent) => { setMode(null); if (sent) setReported(true); }} />}
      {mode === 'edit' && <EditForm review={r} token={token} t={t} onCancel={() => setMode(null)}
        onSaved={(fresh) => { setMode(null); onChange({ ...r, ...fresh }); }} />}
      {mode === 'respond' && <RespondForm review={r} token={token} t={t} onCancel={() => setMode(null)}
        onSaved={(fresh) => { setMode(null); onChange({ ...r, owner_response: fresh.owner_response }); }} />}
    </li>
  );
}

export default function ReviewsSection({ listingId, businessId, kind = 'gig', schemaItem = null, fallback = null, className = '' }) {
  const { t, i18n } = useTranslation();
  const { token } = useContext(AuthContext);
  const [state, setState] = useState({ loading: true });
  const [sort, setSort] = useState('newest');
  const [source, setSource] = useState('');
  const [more, setMore] = useState(false);

  const url = listingId ? `${API}/listings/${listingId}/reviews` : `${API}/businesses/${businessId}/reviews`;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    axios.get(url, { params: { sort, source: source || undefined, page: 1 }, headers })
      .then(({ data }) => live && setState({ loading: false, ...data }))
      .catch(() => live && setState({ loading: false, enabled: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, sort, source, token]);

  const loadMore = async () => {
    setMore(true);
    try {
      const { data } = await axios.get(url, { params: { sort, source: source || undefined, page: (state.page || 1) + 1 }, headers });
      setState((s) => ({ ...s, reviews: [...s.reviews, ...data.reviews], has_more: data.has_more, page: data.page }));
    } finally {
      setMore(false);
    }
  };

  if (state.loading && state.enabled === undefined) return null;
  if (!state.enabled) return fallback;
  const summary = state.summary || {};
  const total = (summary.native?.count || 0) + (summary.google?.count || 0);
  if (!total) return null;
  const both = summary.native && summary.google;

  // Structured data for VERIFIED reviews only: Google's guidelines don't
  // allow marking up reviews that came from another site.
  const nativeShown = (state.reviews || []).filter((r) => r.source === 'native');
  const jsonLd = schemaItem && summary.native ? {
    '@context': 'https://schema.org', ...schemaItem,
    aggregateRating: { '@type': 'AggregateRating', ratingValue: summary.native.avg, reviewCount: summary.native.count, bestRating: 5, worstRating: 1 },
    review: nativeShown.slice(0, 5).map((r) => ({
      '@type': 'Review', author: { '@type': 'Person', name: r.author_display_name },
      datePublished: (r.date || '').slice(0, 10), reviewBody: r.text,
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    })),
  } : null;

  return (
    <section id="reviews" className={`scroll-mt-24 ${className}`} aria-labelledby="reviews-heading" data-testid="reviews-section">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <h2 id="reviews-heading" className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
        {t('reviews.title', 'Reviews')}
      </h2>
      <Summary summary={summary} kind={kind} t={t} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {both && ['', 'native', 'google'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setSource(s)} aria-pressed={source === s}
            className="min-h-[44px] px-3 rounded-full border text-sm font-semibold"
            style={source === s ? { background: 'var(--ink)', color: 'var(--surface)', borderColor: 'var(--ink)' } : { borderColor: BORDER, color: 'var(--ink)' }}
            data-testid={`reviews-source-${s || 'all'}`}>
            {s === 'native' ? t('reviews.filterVerified', 'Verified') : s === 'google' ? t('reviews.filterGoogle', 'Google') : t('reviews.filterAll', 'All')}
          </button>
        ))}
        <label className="ms-auto inline-flex items-center gap-2 text-sm" style={{ color: MUTED }}>
          {t('reviews.sortLabel', 'Sort')}
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-[44px] px-2 rounded-lg border bg-white text-sm"
            style={{ borderColor: BORDER, color: 'var(--ink)' }} data-testid="reviews-sort">
            <option value="newest">{t('reviews.sortNewest', 'Newest')}</option>
            <option value="highest">{t('reviews.sortHighest', 'Highest rated')}</option>
            <option value="lowest">{t('reviews.sortLowest', 'Lowest rated')}</option>
          </select>
        </label>
      </div>
      <ul className="mt-2" aria-busy={state.loading}>
        {(state.reviews || []).map((r) => (
          <ReviewCard key={r.id} r={r} kind={kind} token={token} t={t} lang={i18n.language}
            onChange={(fresh) => setState((s) => ({ ...s, reviews: s.reviews.map((x) => (x.id === fresh.id ? fresh : x)) }))} />
        ))}
      </ul>
      {state.has_more && (
        <button type="button" onClick={loadMore} disabled={more} className="mt-3 min-h-[44px] px-5 rounded-full border text-sm font-semibold inline-flex items-center gap-2"
          style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="reviews-more">
          {more && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {t('reviews.showMore', 'Show more reviews')}
        </button>
      )}
    </section>
  );
}
