/**
 * "Use your own domain" under the business's web address (backend
 * routes/marketplace/custom_domains.py). Folded to one line until opened;
 * opens by itself once a domain is set, so its records and status show.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp, Globe, Copy, CheckCircle2 } from 'lucide-react';
import { apiErrorMessage } from '../../utils/apiError';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function OwnDomainField({ business, API, token }) {
  const { t } = useTranslation();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const url = `${API}/marketplace/businesses/${business.id}/custom-domain`;
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    axios.get(url, auth).then(({ data }) => { setD(data); if (data.domain) { setOpen(true); setValue(data.domain); } }).catch(() => setD(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token]);
  if (d === false) return null;

  const run = async (kind, fn) => {
    setBusy(kind);
    try { setD((await fn()).data); } catch (e) { toast.error(apiErrorMessage(e, t('auto.failed', 'Could not save. Try again.'))); } finally { setBusy(''); }
  };
  const save = () => run('save', () => axios.put(url, { domain: value }, auth));
  const check = () => run('check', () => axios.post(`${url}/check`, null, auth));
  const remove = () => run('remove', async () => { await axios.delete(url, auth); setValue(''); return { data: { domain: null, records: [] } }; });
  const copy = async (s) => { try { await navigator.clipboard.writeText(s); toast.success(t('referrals.copied', 'Copied')); } catch { /* blocked */ } };

  const status = d && d.domain ? d.status : null;
  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--brand-border)' }} data-testid="own-domain">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-start">
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <Globe size={15} aria-hidden="true" /> {t('domain.title', 'Use your own domain')}
          {status === 'live' && <span className="text-xs font-normal" style={{ color: '#2E7D4F' }}>{d.domain}</span>}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-sm" style={{ color: 'var(--ink)' }}>
          {d === null ? <Loader2 size={15} className="animate-spin" /> : (
            <>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t('domain.body', 'If you own a web address, your page can open on it. Use the www form, like www.mybakery.co.il. You add two records where you bought the address; we do the rest.')}
              </p>
              <div className="flex flex-wrap gap-2">
                <input value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" placeholder="www.mybakery.co.il" autoCapitalize="none" autoComplete="off"
                       className={`${box} flex-1 min-w-[12rem]`} style={boxStyle} aria-label={t('domain.label', 'Your domain')} data-testid="own-domain-input" />
                <button type="button" onClick={save} disabled={!!busy || !value.trim() || value.trim().toLowerCase() === d.domain}
                        className="px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="own-domain-save">
                  {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : t('domain.save', 'Save')}
                </button>
              </div>

              {status === 'live' && (
                <p className="flex items-center gap-2 font-semibold" style={{ color: '#2E7D4F' }} data-testid="own-domain-live">
                  <CheckCircle2 size={16} /> {t('domain.live', 'Live: your page opens at {{d}}', { d: d.domain })}
                </p>
              )}
              {status === 'setting_up' && (
                <p data-testid="own-domain-setting-up">{t('domain.settingUp', 'We are connecting {{d}} on our side. The two records to add will show here, usually within a day.', { d: d.domain })}</p>
              )}
              {status !== 'live' && d.records && d.records.length > 0 && (
                <div data-testid="own-domain-records">
                  <p className="font-semibold">{t('domain.addRecords', 'Add these two records where you bought the address (the DNS settings):')}</p>
                  <ul className="mt-2 space-y-2">
                    {d.records.map((r) => (
                      <li key={`${r.type}-${r.name}`} className="rounded-lg p-2 text-xs grid gap-1" style={{ background: '#F9FAFB' }} dir="ltr">
                        <span><b>{t('domain.type', 'Type')}:</b> {r.type} {r.ok ? '✓' : ''}</span>
                        <span><b>{t('domain.name', 'Name')}:</b> {r.name}</span>
                        <span className="flex items-center gap-2 min-w-0"><b>{t('domain.value', 'Value')}:</b> <span className="truncate">{r.value}</span>
                          <button type="button" onClick={() => copy(r.value)} className="grid place-content-center w-9 h-9 shrink-0" aria-label={t('referrals.copy', 'Copy')}><Copy size={13} /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>{t('domain.wait', 'Changes can take up to a few hours to reach everyone. Then press Check.')}</p>
                </div>
              )}
              {d.domain && (
                <div className="flex flex-wrap gap-2">
                  {status !== 'live' && (
                    <button type="button" onClick={check} disabled={!!busy} className="px-4 min-h-[44px] rounded-full border text-sm font-semibold disabled:opacity-50" style={boxStyle} data-testid="own-domain-check">
                      {busy === 'check' ? <Loader2 size={14} className="animate-spin" /> : t('domain.check', 'Check now')}
                    </button>
                  )}
                  <button type="button" onClick={remove} disabled={!!busy} className="px-3 min-h-[44px] text-sm underline" style={{ color: 'var(--brand-muted)' }} data-testid="own-domain-remove">
                    {t('domain.remove', 'Stop using this address')}
                  </button>
                </div>
              )}
              {d.checked_at && status !== 'live' && (
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('domain.notYet', 'Not reaching your page yet. Check again after the records are in.')}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
