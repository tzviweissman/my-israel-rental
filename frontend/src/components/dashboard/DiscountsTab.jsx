/**
 * Dashboard → Discounts (backend routes/marketplace/discounts.py): the
 * business's discount codes, how often each was used, and how much it gave.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Copy, TicketPercent } from 'lucide-react';
import { money } from '../../utils/currency';
import ReferralSettings from './ReferralSettings';
import GiftCardsPanel from './GiftCardsPanel';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const btnOutline = 'inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border text-sm font-semibold';
const EMPTY = { code: '', kind: 'percent', value: '', applies_to: 'both', starts_on: '', ends_on: '', min_order: '', max_uses: '', once_per_customer: true, first_order_only: false, active: true };

function CodeForm({ initial, onSave, onCancel, saving }) {
  const { t } = useTranslation();
  const [c, setC] = useState(initial);
  const set = (k) => (e) => setC({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...c, code: c.code.trim().toUpperCase(), value: Number(c.value), min_order: num(c.min_order), max_uses: num(c.max_uses),
             starts_on: c.starts_on || null, ends_on: c.ends_on || null });
  };
  const L = ({ children, label }) => <label className="block text-sm" style={{ color: 'var(--ink)' }}>{label}<span className="block mt-1">{children}</span></label>;
  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="code-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <L label={t('discounts.code', 'Discount code')}>
          <input required minLength={3} maxLength={24} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/\s/g, '') })} dir="ltr"
                 className={`${field} tracking-wider`} style={fieldStyle} placeholder="FIRST10" data-testid="code-code" />
        </L>
        <L label={t('discounts.kind', 'Discount')}>
          <select value={c.kind} onChange={set('kind')} className={field} style={fieldStyle} data-testid="code-kind">
            <option value="percent">{t('discounts.percent', 'Percent off (%)')}</option>
            <option value="amount">{t('discounts.amount', 'Amount off (₪)')}</option>
          </select>
        </L>
        <L label={c.kind === 'percent' ? t('discounts.valuePercent', 'How many percent') : t('discounts.valueAmount', 'How many shekels')}>
          <input required type="number" min="1" max={c.kind === 'percent' ? 100 : 100000} step="any" value={c.value} onChange={set('value')} className={field} style={fieldStyle} data-testid="code-value" />
        </L>
        <L label={t('discounts.appliesTo', 'Works on')}>
          <select value={c.applies_to} onChange={set('applies_to')} className={field} style={fieldStyle}>
            <option value="both">{t('discounts.both', 'Orders and memberships')}</option>
            <option value="orders">{t('discounts.orders', 'Orders only')}</option>
            <option value="memberships">{t('discounts.memberships', 'Memberships only')}</option>
          </select>
        </L>
        <L label={t('discounts.startsOn', 'From (optional)')}><input type="date" value={c.starts_on || ''} onChange={set('starts_on')} className={field} style={fieldStyle} /></L>
        <L label={t('discounts.endsOn', 'Until (optional)')}><input type="date" value={c.ends_on || ''} onChange={set('ends_on')} className={field} style={fieldStyle} data-testid="code-ends" /></L>
        <L label={t('discounts.minOrder', 'Minimum order ₪ (optional)')}><input type="number" min="0" step="any" value={c.min_order ?? ''} onChange={set('min_order')} className={field} style={fieldStyle} /></L>
        <L label={t('discounts.maxUses', 'Total uses (optional)')}><input type="number" min="1" step="1" value={c.max_uses ?? ''} onChange={set('max_uses')} className={field} style={fieldStyle} /></L>
      </div>
      <div className="flex flex-wrap gap-x-5 text-sm" style={{ color: 'var(--ink)' }}>
        <label className="inline-flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={c.once_per_customer} onChange={set('once_per_customer')} /> {t('discounts.oncePer', 'Once per customer')}</label>
        <label className="inline-flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={c.first_order_only} onChange={set('first_order_only')} /> {t('discounts.firstOnly', 'New customers only')}</label>
        <label className="inline-flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={c.active} onChange={set('active')} /> {t('discounts.active', 'On')}</label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="code-save">
          {saving && <Loader2 size={14} className="animate-spin" />} {t('discounts.save', 'Save code')}
        </button>
        <button type="button" className={btnOutline} style={fieldStyle} onClick={onCancel}>{t('discounts.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}

export default function DiscountsTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem('orders.business') || ''; } catch { return ''; } });
  const [codes, setCodes] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/my-workplaces`, { ...auth, params: { perm: 'discounts' } }).then(({ data }) => {
      if (!alive) return;
      const active = (data || []).filter((b) => b.active);
      setBusinesses(active);
      if (!active.find((b) => b.id === bizId) && active[0]) setBizId(active[0].id);
    }).catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);
  useEffect(() => { try { if (bizId) localStorage.setItem('orders.business', bizId); } catch { /* private mode */ } }, [bizId]);
  const ready = businesses && businesses.some((b) => b.id === bizId);
  const base = `${API}/marketplace/businesses/${bizId}/discount-codes`;
  const load = useCallback(() => { if (ready) axios.get(base, auth).then(({ data }) => setCodes(data)).catch(() => setCodes([])); }, [ready, base, auth]);
  useEffect(() => { load(); }, [load]);

  if (businesses === null) return <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (businesses.length === 0) return <p className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>{t('discounts.needBusiness', 'Add a business first.')}</p>;
  const biz = businesses.find((b) => b.id === bizId) || businesses[0];
  const fmt = (s) => (s ? new Intl.DateTimeFormat(i18n.language?.startsWith('he') ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${s}T00:00`)) : '');

  const save = async (body) => {
    setSaving(true);
    try {
      if (editing.id) await axios.put(`${base}/${editing.id}`, body, auth); else await axios.post(base, body, auth);
      setEditing(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || t('discounts.saveFailed', 'Could not save. Try again.')); } finally { setSaving(false); }
  };
  const remove = async (c) => {
    if (!window.confirm(t('discounts.removeConfirm', 'Delete the code {{code}}? Orders that used it keep it.', { code: c.code }))) return;
    await axios.delete(`${base}/${c.id}`, auth).catch(() => {});
    load();
  };
  const describe = (c) => {
    const parts = [c.kind === 'percent' ? t('discounts.offPercent', '{{v}}% off', { v: c.value }) : t('discounts.offAmount', '{{v}} off', { v: money(c.value, 'ILS') })];
    if (c.applies_to !== 'both') parts.push(c.applies_to === 'orders' ? t('discounts.orders', 'Orders only') : t('discounts.memberships', 'Memberships only'));
    if (c.min_order) parts.push(t('discounts.minShort', 'from {{v}}', { v: money(c.min_order, 'ILS') }));
    if (c.ends_on) parts.push(t('discounts.until', 'until {{d}}', { d: fmt(c.ends_on) }));
    if (c.first_order_only) parts.push(t('discounts.firstOnly', 'New customers only'));
    return parts.join(' · ');
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div data-testid="discounts-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('discounts.title', 'Discount codes')}</h2>
        <div className="flex items-center gap-2">
          {businesses.length > 1 && (
            <select value={biz.id} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {!editing && <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setEditing({ ...EMPTY })} data-testid="code-new"><Plus size={15} /> {t('discounts.new', 'New code')}</button>}
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('discounts.body', 'Customers type the code on your order form or membership sign-up, and the discount shows on the order. An end date or “new customers only” works better than a discount that never ends.')}
      </p>
      {ready && <ReferralSettings key={bizId} API={API} auth={auth} businessId={bizId} />}
      {ready && <GiftCardsPanel key={`gift-${bizId}`} API={API} auth={auth} businessId={bizId} slug={biz.slug} />}
      {editing && <CodeForm initial={editing} saving={saving} onCancel={() => setEditing(null)} onSave={save} />}
      {codes === null ? <Loader2 className="animate-spin" size={18} /> : codes.length === 0 && !editing ? (
        <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
          <TicketPercent size={22} className="inline mb-2" />
          <p>{t('discounts.none', 'No codes yet. For example: FIRST10 for 10% off a first order.')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {codes.map((c) => {
            const expired = c.ends_on && c.ends_on < today;
            const usedUp = c.max_uses && c.uses >= c.max_uses;
            return (
              <li key={c.id} className="rounded-2xl border bg-white p-3 flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--brand-border)', opacity: c.active && !expired && !usedUp ? 1 : 0.65 }} data-testid="code-row">
                <div className="min-w-0">
                  <p className="font-bold tracking-wider text-sm" dir="ltr" style={{ color: 'var(--ink)' }}>
                    {c.code}
                    {(!c.active || expired || usedUp) && <span className="ms-2 text-xs font-normal tracking-normal" style={{ color: 'var(--brand-muted)' }}>{!c.active ? t('discounts.off', 'Off') : expired ? t('discounts.expired', 'Expired') : t('discounts.usedUp', 'Used up')}</span>}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{describe(c)}</p>
                  <p className="text-xs" style={{ color: 'var(--ink)' }}>
                    {t('discounts.used', 'Used {{n}} times', { n: c.uses })}{c.max_uses ? ` / ${c.max_uses}` : ''}{c.discount_given ? ` · ${t('discounts.given', '{{v}} given', { v: money(c.discount_given, 'ILS') })}` : ''}
                  </p>
                </div>
                <div className="flex">
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('discounts.copy', 'Copy code')} onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast.success(t('discounts.copied', 'Copied')))}><Copy size={15} /></button>
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('discounts.edit', 'Edit')} onClick={() => setEditing({ ...c, min_order: c.min_order ?? '', max_uses: c.max_uses ?? '', starts_on: c.starts_on || '', ends_on: c.ends_on || '' })}><Pencil size={15} /></button>
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('discounts.delete', 'Delete')} onClick={() => remove(c)}><Trash2 size={15} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
