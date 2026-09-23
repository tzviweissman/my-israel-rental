/**
 * Super Admin → reported reviews (backend routes/reviews.py).
 *
 * A reported review stays on the page, marked under review, until a
 * decision here. Two actions: Keep (back to published) and Remove, which
 * needs one of the listed reasons. "Negative" is not one of them, and the
 * server refuses anything not on the list whatever this page sends.
 * Every decision is written to the review's audit log.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { API } from '../../App';
import StarRating from '../marketplace/StarRating';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';

export default function ReviewsModerationTab({ token }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [reason, setReason] = useState({});
  const [busy, setBusy] = useState(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const { data: cfg } = await axios.get(`${API}/reviews/config`);
      if (!cfg.native && !cfg.google) return setData({ off: true, items: [] });
      const { data: q } = await axios.get(`${API}/admin/reviews/queue`, auth);
      setData(q);
    } catch {
      setData({ items: [], reasons: [] });
      toast.error(t('adminReviews.loadFailed', 'Could not load reported reviews'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const act = async (item, action) => {
    setBusy(item.id);
    try {
      if (action === 'approve') await axios.post(`${API}/admin/reviews/${item.id}/approve`, {}, auth);
      else await axios.post(`${API}/admin/reviews/${item.id}/remove`, { reason: reason[item.id] }, auth);
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== item.id) }));
      toast.success(action === 'approve' ? t('adminReviews.kept', 'Kept on the page') : t('adminReviews.removed', 'Removed'));
    } catch (e) {
      toast.error(e.response?.data?.detail?.message || t('adminReviews.failed', 'That did not work'));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <div className="py-16 text-center" style={{ color: MUTED }}><Loader2 className="animate-spin inline" size={18} /></div>;
  if (data.off) return <p className="py-10 text-sm" style={{ color: MUTED }} data-testid="admin-reviews-off">{t('adminReviews.off', 'Verified reviews are switched off.')}</p>;
  if (!data.items.length) {
    return (
      <p className="py-10 inline-flex items-center gap-2 text-sm" style={{ color: MUTED }} data-testid="admin-reviews-empty">
        <ShieldCheck size={16} aria-hidden="true" /> {t('adminReviews.empty', 'No reported reviews waiting.')}
      </p>
    );
  }
  const listingHref = (x) => (x.listing_kind === 'property' ? `/property/${x.listing_id}` : x.listing_kind === 'gig' ? `/services/gig/${x.listing_id}` : null);

  return (
    <div data-testid="admin-reviews-queue">
      <p className="text-sm mb-4" style={{ color: MUTED }}>
        {t('adminReviews.rule', 'Remove only for a listed reason. A review is never removed for being negative. Each decision is logged.')}
      </p>
      <ul className="space-y-4">
        {data.items.map((x) => (
          <li key={x.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }} data-testid="admin-review-item">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <strong style={{ color: 'var(--ink)' }}>{x.author_display_name}</strong>
              <StarRating value={x.rating} showCount={false} size={13} />
              <span style={{ color: MUTED }}>{x.source === 'google' ? t('reviews.badgeGoogle', 'From Google') : t('reviews.filterVerified', 'Verified')}</span>
              {listingHref(x) && (
                <a href={listingHref(x)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline" style={{ color: MUTED }}>
                  {t('adminReviews.open', 'Open page')} <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </div>
            <p className="mt-2 text-sm whitespace-pre-line" style={{ color: 'var(--ink)' }} dir="auto">{x.text}</p>
            <ul className="mt-2 text-xs space-y-0.5" style={{ color: MUTED }}>
              {x.reports.map((r, i) => (
                <li key={i}>{t('adminReviews.reported', 'Reported:')} {t(`reviews.reason_${r.reason}`)}{r.note ? `: ${r.note}` : ''}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy === x.id} onClick={() => act(x, 'approve')}
                className="min-h-[44px] px-4 rounded-full border text-sm font-semibold" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}
                data-testid="admin-review-keep">{t('adminReviews.keep', 'Keep it up')}</button>
              <select value={reason[x.id] || ''} onChange={(e) => setReason((r) => ({ ...r, [x.id]: e.target.value }))}
                aria-label={t('adminReviews.reasonLabel', 'Reason for removal')}
                className="min-h-[44px] px-2 rounded-lg border bg-white text-sm" style={{ borderColor: BORDER }} data-testid="admin-review-reason">
                <option value="">{t('adminReviews.pickReason', 'Reason for removal')}</option>
                {data.reasons.map((r) => <option key={r} value={r}>{t(`reviews.reason_${r}`)}</option>)}
              </select>
              <button type="button" disabled={busy === x.id || !reason[x.id]} onClick={() => act(x, 'remove')}
                className="min-h-[44px] px-4 rounded-full text-sm font-bold disabled:opacity-40"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="admin-review-remove">
                {t('adminReviews.remove', 'Remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
