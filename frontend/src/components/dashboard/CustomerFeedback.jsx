/**
 * Overview → Sales summary → "Private feedback" (backend
 * routes/marketplace/feedback.py): the average of the day-after "How did we
 * do?" answers and the latest comments, with the switch that turns the
 * email off. Private to the business; never shown on the site.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, Lock } from 'lucide-react';
import { Section } from './BusinessInsights';

export default function CustomerFeedback({ API, auth, businessId, days, show }) {
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setD(null);
    axios.get(`${API}/marketplace/businesses/${businessId}/feedback`, { ...auth, params: { days } }).then(({ data }) => setD(data)).catch(() => setD(false));
  }, [API, auth, businessId, days]);
  if (!d || (!show && !d.sent)) return null;

  const toggle = async () => {
    const on = !d.on;
    setD({ ...d, on });
    setSaving(true);
    try {
      await axios.put(`${API}/marketplace/businesses/${businessId}/feedback-setting`, { on }, auth);
    } catch (err) {
      setD((x) => ({ ...x, on: !on }));
      toast.error(err?.response?.status === 403 ? t('feedbackBiz.ownerOnly', 'Only the owner can change this.') : t('auto.failed', 'Could not save. Try again.'));
    } finally { setSaving(false); }
  };
  const when = (iso) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });

  return (
    <Section title={t('feedbackBiz.title', 'Private feedback')} testid="summary-feedback">
      {d.answered ? (
        <p className="text-sm inline-flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
          <Star size={15} fill="#F5B301" stroke="#F5B301" aria-hidden="true" />
          <b className="tabular-nums">{d.average}</b>
          <span style={{ color: 'var(--brand-muted)' }}>{t('feedbackBiz.counts', 'from {{a}} answers, {{s}} asked', { a: d.answered, s: d.sent })}</span>
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
          {d.sent ? t('feedbackBiz.noneYet', '{{s}} customers asked, no answers yet.', { s: d.sent })
            : t('feedbackBiz.explain', 'The day after a visit or a finished order, customers get one email: "How did we do?". Answers come only to you.')}
        </p>
      )}
      {d.latest.filter((r) => r.comment || r.rating <= 3).length > 0 && (
        <ul className="mt-3 space-y-2">
          {d.latest.filter((r) => r.comment || r.rating <= 3).slice(0, 5).map((r, i) => (
            <li key={i} className="text-sm rounded-lg p-2.5" style={{ background: '#F9FAFB', color: 'var(--ink)' }}>
              <span className="flex flex-wrap justify-between gap-x-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                <span><span style={{ color: '#B7791F' }} aria-label={`${r.rating}/5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> · {r.name || r.email}{r.what ? ` · ${r.what}` : ''}</span>
                <span>{when(r.at)}</span>
              </span>
              {r.comment && <span className="block mt-1 whitespace-pre-line" dir="auto">{r.comment}</span>}
              {r.rating <= 3 && r.email && <a className="block mt-1 text-xs underline" href={`mailto:${r.email}`} style={{ color: 'var(--gold)' }}>{t('feedbackBiz.reply', 'Reply to {{e}}', { e: '' })}<bdi dir="ltr">{r.email}</bdi></a>}
            </li>
          ))}
        </ul>
      )}
      <label className="mt-3 flex items-center justify-between gap-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
        <span className="inline-flex items-center gap-1.5"><Lock size={12} aria-hidden="true" /> {t('feedbackBiz.switch', 'Ask customers the day after')}</span>
        <button type="button" role="switch" aria-checked={d.on} disabled={saving} onClick={toggle} data-testid="feedback-switch"
                className="relative w-10 h-6 rounded-full shrink-0" style={{ background: d.on ? 'var(--ink)' : '#D1D5DB' }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ insetInlineStart: d.on ? '18px' : '2px' }} />
        </button>
      </label>
    </Section>
  );
}
