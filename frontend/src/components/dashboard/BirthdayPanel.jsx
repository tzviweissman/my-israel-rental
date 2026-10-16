/**
 * Discounts → Birthday treat (backend birthdays.py). Folded to one line.
 * Inside: the switch, the gift (percent or ₪, and for how many days), and
 * how many birthdays are saved, treats sent this year, and codes used.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Cake, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function BirthdayPanel({ API, auth, businessId }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const url = `${API}/marketplace/businesses/${businessId}/birthday-settings`;
  useEffect(() => { axios.get(url, auth).then(({ data }) => setD(data)).catch(() => setD(false)); }, [url, auth]);
  if (!d) return null;

  const save = async (patch) => {
    const next = { ...d, ...patch };
    setD(next);
    setSaving(true);
    try {
      await axios.put(url, { on: next.on, kind: next.kind, value: Number(next.value) || 10, days: Number(next.days) || 7 }, auth);
      toast.success(t('giftBiz.saved', 'Saved'));
    } catch (err) {
      toast.error(err?.response?.status === 403 ? t('feedbackBiz.ownerOnly', 'Only the owner can change this.') : t('auto.failed', 'Could not save. Try again.'));
    } finally { setSaving(false); }
  };

  return (
    <section className="rounded-2xl border bg-white mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="birthday-panel">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 p-3 text-start">
        <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <Cake size={16} /> {t('birthdayBiz.title', 'Birthday treat')}
          <span className="font-normal text-xs" style={{ color: 'var(--brand-muted)' }}>
            {d.on ? t('birthdayBiz.onShort', 'On, {{n}} birthdays saved', { n: d.saved }) : t('giftBiz.offShort', 'Off')}
          </span>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-3 pb-4 space-y-4 text-sm" style={{ color: 'var(--ink)' }}>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('birthdayBiz.body', 'Your order form, membership sign-up and booking form ask for a birthday (day and month, optional). Three days before it, the customer gets an email from you with a personal code, good once.')}</p>
          <label className="flex items-center justify-between gap-3">
            <span>{t('birthdayBiz.switch', 'Send a birthday treat')}</span>
            <button type="button" role="switch" aria-checked={!!d.on} disabled={saving} onClick={() => save({ on: !d.on })} data-testid="birthday-switch"
                    className="relative w-10 h-6 rounded-full shrink-0" style={{ background: d.on ? 'var(--ink)' : '#D1D5DB' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ insetInlineStart: d.on ? '18px' : '2px' }} />
            </button>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span>{t('birthdayBiz.gift', 'The gift:')}</span>
            <input type="number" min="1" max={d.kind === 'percent' ? 100 : 1000} value={d.value} onChange={(e) => setD({ ...d, value: e.target.value })} className={`${box} w-20`} style={boxStyle} data-testid="birthday-value" />
            <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value })} className={box} style={boxStyle}>
              <option value="percent">{t('birthdayBiz.percent', '% off')}</option>
              <option value="amount">{t('birthdayBiz.amount', '₪ off')}</option>
            </select>
            <span>{t('birthdayBiz.for', 'for')}</span>
            <select value={d.days} onChange={(e) => setD({ ...d, days: Number(e.target.value) })} className={box} style={boxStyle}>
              {[3, 7, 14, 30].map((n) => <option key={n} value={n}>{t('quotes.days', '{{n}} days', { n })}</option>)}
            </select>
            <button type="button" disabled={saving} onClick={() => save({})} className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-sm font-semibold disabled:opacity-60"
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="birthday-save">
              {saving && <Loader2 size={13} className="animate-spin" />} {t('giftBiz.save', 'Save')}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('birthdayBiz.counts', '{{saved}} birthdays saved · {{sent}} treats sent this year · {{used}} used', { saved: d.saved, sent: d.sent_this_year, used: d.used })}
          </p>
        </div>
      )}
    </section>
  );
}
