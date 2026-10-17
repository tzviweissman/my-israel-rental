/**
 * Discount codes → Referrals (backend routes/marketplace/referrals.py):
 * on or off, what the friend gets and what the sender gets. One line
 * until opened.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp, Gift } from 'lucide-react';

const field = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

function Amount({ label, kind, value, onKind, onValue, testid }) {
  const { t } = useTranslation();
  return (
    <label className="block text-sm" style={{ color: 'var(--ink)' }}>
      {label}
      <span className="flex gap-2 mt-1">
        <input type="number" min="1" step="any" value={value} onChange={(e) => onValue(e.target.value)} className={`${field} w-24`} style={fieldStyle} data-testid={testid} />
        <select value={kind} onChange={(e) => onKind(e.target.value)} className={field} style={fieldStyle}>
          <option value="percent">%</option>
          <option value="amount">{t('referrals.shekels', '₪ off')}</option>
        </select>
      </span>
    </label>
  );
}

export default function ReferralSettings({ API, auth, businessId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const url = `${API}/marketplace/businesses/${businessId}/referrals`;

  useEffect(() => {
    axios.get(url, auth).then(({ data }) => { setS(data); }).catch(() => setS(false));
  }, [url, auth]);
  if (s === false) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await axios.put(url, {
        on: s.on, friend_kind: s.friend_kind, friend_value: Number(s.friend_value),
        reward_kind: s.reward_kind, reward_value: Number(s.reward_value),
      }, auth);
      setS(data);
      toast.success(t('auto.saved', 'Saved'));
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : t('auto.failed', 'Could not save. Try again.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border bg-white mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="referral-settings">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 p-4 text-start min-h-[44px]">
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <Gift size={16} aria-hidden="true" /> {t('referrals.settingsTitle', 'Referrals: customers invite friends')}
          {s && s.on && <span className="text-xs font-normal" style={{ color: '#2E7D4F' }}>{t('referrals.isOn', 'On')}</span>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {s === null ? <Loader2 size={16} className="animate-spin" /> : (
            <>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('referrals.settingsBody', 'Each customer and member gets their own link on their order page or membership pass. A friend who uses it gets a discount on their first time, and the person who sent them gets a one-time thank-you code.')}
              </p>
              <label className="flex items-center gap-2 text-sm min-h-[44px]" style={{ color: 'var(--ink)' }}>
                <input type="checkbox" checked={!!s.on} onChange={(e) => setS({ ...s, on: e.target.checked })} data-testid="referral-on" /> {t('referrals.turnOn', 'Turn on referrals')}
              </label>
              {s.on && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Amount label={t('referrals.friendGets', 'The friend gets')} kind={s.friend_kind} value={s.friend_value}
                          onKind={(v) => setS({ ...s, friend_kind: v })} onValue={(v) => setS({ ...s, friend_value: v })} testid="referral-friend" />
                  <Amount label={t('referrals.senderGets', 'The person who sent them gets')} kind={s.reward_kind} value={s.reward_value}
                          onKind={(v) => setS({ ...s, reward_kind: v })} onValue={(v) => setS({ ...s, reward_value: v })} testid="referral-reward" />
                </div>
              )}
              {(s.friends > 0) && (
                <p className="text-sm" style={{ color: 'var(--ink)' }} data-testid="referral-stats">
                  {t('referrals.stats', '{{friends}} friends came through {{senders}} customers', { friends: s.friends, senders: s.senders })}
                </p>
              )}
              <button type="button" onClick={save} disabled={busy} className="mt-2 flex items-center gap-1.5 px-5 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="referral-save">
                {busy && <Loader2 size={14} className="animate-spin" />} {t('auto.save', 'Save')}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
