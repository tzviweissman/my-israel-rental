import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';

/* A business's paid plan, with a way to cancel it (Tzvi, 13 Oct 2026: build
   it before anyone pays; the dead-ends audit found the cancel endpoint had no
   caller). Shown only when there is a plan (GET /marketplace/subscription/me
   says state !== "none"), so nobody on the free listing sees billing talk.

   Cancelling stops the next payment; what was paid for runs to the end of the
   period. The confirm step says exactly that, in place, with no guilt copy. */
export default function SubscriptionCard({ API, token }) {
  const { t, i18n } = useTranslation();
  const [sub, setSub] = useState(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    let live = true;
    axios.get(`${API}/marketplace/subscription/me`, auth)
      .then(({ data }) => { if (live) setSub(data); })
      .catch(() => { if (live) setSub(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);

  if (!sub || sub.state === 'none') return null;

  const date = sub.until
    ? new Date(sub.until).toLocaleDateString(i18n.language?.startsWith('he') ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const price = sub.monthly_price ? `$${Number(sub.monthly_price).toFixed(0)}` : null;

  const cancel = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/subscription/cancel`, {}, auth);
      setSub(data.subscription || { ...sub, state: 'cancelled' });
      setAsking(false);
      toast.success(t('plan.cancelled', 'Your plan is cancelled. You will not be charged again.'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('plan.cancelFailed', 'We could not cancel just now. Nothing has changed; please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const line = {
    active: date
      ? t('plan.activeUntil', { defaultValue: 'Active. Renews on {{date}}.', date })
      : t('plan.active', 'Active.'),
    pending: t('plan.pending', 'Waiting for PayPal to confirm. Nothing has been charged yet.'),
    cancelled: date
      ? t('plan.cancelledUntil', { defaultValue: 'Cancelled. Your plan stays active until {{date}} and will not renew.', date })
      : t('plan.cancelledNoDate', 'Cancelled. It will not renew.'),
    ended: t('plan.ended', 'Ended. Listing on MyIsraelRental stays free.'),
  }[sub.state];

  const canCancel = sub.state === 'active' || sub.state === 'pending';

  return (
    <div className="bg-white rounded-2xl border border-[var(--brand-border)] p-6 max-w-2xl mb-6" data-testid="settings-plan">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full" style={{ background: 'var(--surface-muted)' }}>
          <CreditCard size={24} className="text-[var(--brand-primary)]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('plan.title', 'Your plan')}</h3>
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="settings-plan-line">
            {price && sub.plan_months
              ? t('plan.terms', { defaultValue: '{{price}} a month, {{months}} months. ', price, months: sub.plan_months })
              : ''}
            {line}
          </p>
        </div>
      </div>

      {canCancel && !asking && (
        <button type="button" onClick={() => setAsking(true)}
          className="mt-5 min-h-[44px] px-5 rounded-full border border-[var(--brand-border)] text-sm font-semibold hover:bg-[var(--surface-muted)]"
          style={{ color: 'var(--ink)' }} data-testid="settings-plan-cancel">
          {t('plan.cancel', 'Cancel plan')}
        </button>
      )}

      {canCancel && asking && (
        <div className="mt-5 rounded-xl p-4" style={{ background: 'var(--surface-muted)' }} role="group" aria-labelledby="plan-confirm" data-testid="settings-plan-confirm">
          <p id="plan-confirm" className="text-sm" style={{ color: 'var(--ink)' }}>
            {date && sub.state === 'active'
              ? t('plan.confirmUntil', { defaultValue: 'You will not be charged again. Your plan stays active until {{date}}. Your listings stay up either way.', date })
              : t('plan.confirm', 'You will not be charged again. Your listings stay up either way.')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={cancel} disabled={busy}
              className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold disabled:opacity-60"
              data-testid="settings-plan-cancel-confirm">
              {busy ? t('plan.cancelling', 'Cancelling') : t('plan.cancelConfirm', 'Cancel plan')}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={busy}
              className="min-h-[44px] px-5 rounded-full border border-[var(--brand-border)] text-sm font-semibold bg-white"
              style={{ color: 'var(--ink)' }}>
              {t('plan.keep', 'Keep my plan')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
