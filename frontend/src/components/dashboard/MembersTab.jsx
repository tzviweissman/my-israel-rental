/**
 * Dashboard → Members (routes/marketplace/memberships.py).
 *
 * For a gym, studio or anyone who sells by the month: the plans they
 * offer, who signed up, who is active or due to renew, and the door link
 * for checking members in. Payment is not taken on the site yet; a new
 * sign-up waits here until the business marks it paid with "Activate".
 *
 * Same frame as OrdersTab: one business at a time, a picker only when
 * there is a choice, 44px targets, works at 375px.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Users, Copy, Check, DoorOpen, Link2, X, Pencil, Trash2 } from 'lucide-react';
import { money } from '../../utils/currency';
import { planPrice, planVisits, stateLabel } from '../members/memberText';
import CustomFieldsEditor from './CustomFieldsEditor';
import { AnswersList } from '../forms/CustomFieldInputs';

const FILTERS = ['pending', 'active', 'due', 'paused', 'cancelled'];
const EMPTY_PLAN = { name: '', description: '', period: 'month', price: '', visits: '', valid_months: '', active: true };

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const btnOutline = 'inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border text-sm font-semibold';
const btnSolid = 'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60';
const solidStyle = { background: 'var(--action)', color: 'var(--action-ink)' };

function CopyButton({ text, label, testid }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btnOutline}
      style={fieldStyle}
      data-testid={testid}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error(t('members.copyFailed', 'Could not copy. Select the link and copy it.')); }
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? t('members.copied', 'Copied') : label}
    </button>
  );
}

function PlanForm({ initial, onCancel, onSave, saving }) {
  const { t } = useTranslation();
  const [p, setP] = useState(initial);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSave({
      name: p.name.trim(),
      description: (p.description || '').trim() || null,
      period: p.period,
      price: Number(p.price || 0),
      visits: p.visits === '' || p.visits === null ? null : Number(p.visits),
      valid_months: p.period === 'pack' && p.valid_months ? Number(p.valid_months) : null,
      active: !!p.active,
    });
  };
  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="plan-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm" style={{ color: 'var(--ink)' }}>
          {t('members.planName', 'Plan name')}
          <input required maxLength={80} value={p.name} onChange={set('name')} className={`${field} mt-1`} style={fieldStyle}
                 placeholder={t('members.planNamePh', 'e.g. Monthly unlimited')} data-testid="plan-name" />
        </label>
        <label className="block text-sm" style={{ color: 'var(--ink)' }}>
          {t('members.planType', 'Type')}
          <select value={p.period} onChange={set('period')} className={`${field} mt-1`} style={fieldStyle} data-testid="plan-period">
            <option value="month">{t('members.period.month', 'Monthly')}</option>
            <option value="year">{t('members.period.year', 'Yearly')}</option>
            <option value="pack">{t('members.period.pack', 'Class pack')}</option>
          </select>
        </label>
        <label className="block text-sm" style={{ color: 'var(--ink)' }}>
          {t('members.price', 'Price (₪)')}
          <input required type="number" min="0" step="1" inputMode="numeric" value={p.price} onChange={set('price')}
                 className={`${field} mt-1`} style={fieldStyle} data-testid="plan-price" />
        </label>
        <label className="block text-sm" style={{ color: 'var(--ink)' }}>
          {p.period === 'pack' ? t('members.visitsPack', 'Visits in the pack') : t('members.visitsPeriod', 'Visits included (leave empty for unlimited)')}
          <input type="number" min="1" step="1" inputMode="numeric" required={p.period === 'pack'} value={p.visits ?? ''} onChange={set('visits')}
                 className={`${field} mt-1`} style={fieldStyle} data-testid="plan-visits" />
        </label>
        {p.period === 'pack' && (
          <label className="block text-sm" style={{ color: 'var(--ink)' }}>
            {t('members.validMonths', 'Expires after (months, optional)')}
            <input type="number" min="1" max="36" step="1" inputMode="numeric" value={p.valid_months ?? ''} onChange={set('valid_months')}
                   className={`${field} mt-1`} style={fieldStyle} />
          </label>
        )}
      </div>
      <label className="block text-sm" style={{ color: 'var(--ink)' }}>
        {t('members.planDesc', 'What is included (optional)')}
        <textarea maxLength={400} rows={2} value={p.description || ''} onChange={set('description')} className={`${field} mt-1`} style={fieldStyle} />
      </label>
      <label className="inline-flex items-center gap-2 text-sm min-h-[44px]" style={{ color: 'var(--ink)' }}>
        <input type="checkbox" checked={!!p.active} onChange={set('active')} /> {t('members.planActive', 'Open for sign-up')}
      </label>
      <div className="flex gap-2">
        <button type="submit" className={btnSolid} style={solidStyle} disabled={saving} data-testid="plan-save">
          {saving && <Loader2 size={15} className="animate-spin" />} {t('members.savePlan', 'Save plan')}
        </button>
        <button type="button" className={btnOutline} style={fieldStyle} onClick={onCancel}>{t('members.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}

function AddMemberForm({ plans, onCancel, onSave, saving }) {
  const { t } = useTranslation();
  const [m, setM] = useState({ plan_id: plans[0]?.id || '', name: '', phone: '', email: '' });
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave({ ...m, email: m.email.trim() || null, active: true }); }}
      className="rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="member-form"
    >
      <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('members.addBody', 'For someone who joined at the desk and has paid. They start today, active.')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required minLength={2} maxLength={80} value={m.name} onChange={set('name')} className={field} style={fieldStyle} placeholder={t('members.name', 'Full name')} />
        <input required type="tel" minLength={7} maxLength={20} value={m.phone} onChange={set('phone')} className={field} style={fieldStyle} placeholder={t('members.phone', 'Phone')} />
        <input type="email" maxLength={200} value={m.email} onChange={set('email')} className={field} style={fieldStyle} placeholder={t('members.emailOptional', 'Email (optional)')} />
        <select value={m.plan_id} onChange={set('plan_id')} className={field} style={fieldStyle} aria-label={t('members.plan', 'Plan')}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnSolid} style={solidStyle} disabled={saving}>
          {saving && <Loader2 size={15} className="animate-spin" />} {t('members.addMember', 'Add member')}
        </button>
        <button type="button" className={btnOutline} style={fieldStyle} onClick={onCancel}>{t('members.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}

export default function MembersTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const lang = String(i18n.language || 'en').split('-')[0];
  const fmtDate = (s) => (s ? new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${s.slice(0, 10)}T00:00`)) : '');

  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem('orders.business') || ''; } catch { return ''; } });
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState(null);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('');
  const [planForm, setPlanForm] = useState(null);     // null | {..plan, id?}
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [door, setDoor] = useState(null);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/my-workplaces`, { ...auth, params: { perm: 'members' } })
      .then(({ data }) => {
        if (!alive) return;
        const active = (data || []).filter((b) => b.active);
        setBusinesses(active);
        if (!active.find((b) => b.id === bizId) && active[0]) setBizId(active[0].id);
      })
      .catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);

  // Same key as OrdersTab: the business you work on stays picked across both.
  useEffect(() => {
    try { if (bizId) localStorage.setItem('orders.business', bizId); } catch { /* private mode */ }
  }, [bizId]);

  const ready = businesses && businesses.some((b) => b.id === bizId);
  const base = `${API}/marketplace/businesses/${bizId}`;

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      const [p, m, d] = await Promise.all([
        axios.get(`${base}/membership-plans`, auth),
        axios.get(`${base}/members`, { ...auth, params: filter ? { status: filter } : {} }),
        axios.get(`${base}/members-door-link`, auth),
      ]);
      setPlans(p.data);
      setMembers(m.data.members);
      setCounts(m.data.counts || {});
      setDoor(d.data.url);
    } catch {
      toast.error(t('members.loadFailed', 'Could not load your members. Try again.'));
      setMembers([]);
    }
  }, [ready, base, auth, filter, t]);

  useEffect(() => { load(); }, [load]);

  if (businesses === null) {
    return <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={18} /></div>;
  }
  if (businesses.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} data-testid="members-no-business">
        <Users size={22} className="inline mb-2" />
        <p className="text-sm">{t('members.needBusiness', 'Add a business first. Members belong to a business.')}</p>
      </div>
    );
  }
  const biz = businesses.find((b) => b.id === bizId) || businesses[0];
  const signupUrl = `${window.location.origin}/memberships/${biz.slug || biz.id}`;

  const savePlan = async (body) => {
    setSaving(true);
    try {
      if (planForm.id) await axios.put(`${base}/membership-plans/${planForm.id}`, body, auth);
      else await axios.post(`${base}/membership-plans`, body, auth);
      setPlanForm(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('members.saveFailed', 'Could not save. Try again.'));
    } finally { setSaving(false); }
  };
  const removePlan = async (p) => {
    if (!window.confirm(t('members.removePlanConfirm', 'Stop offering this plan? Members already on it keep it.'))) return;
    await axios.delete(`${base}/membership-plans/${p.id}`, auth).catch(() => {});
    load();
  };
  const addMember = async (body) => {
    setSaving(true);
    try {
      await axios.post(`${base}/members`, body, auth);
      setAdding(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('members.saveFailed', 'Could not save. Try again.'));
    } finally { setSaving(false); }
  };
  const act = async (m, action) => {
    if (action === 'cancel' && !window.confirm(t('members.cancelConfirm', 'Cancel this membership?'))) return;
    setBusy(m.id);
    try {
      await axios.post(`${base}/members/${m.id}/action`, { action }, auth);
      await load();
    } catch { toast.error(t('members.saveFailed', 'Could not save. Try again.')); } finally { setBusy(null); }
  };
  const checkIn = async (m) => {
    setBusy(m.id);
    try {
      const { data } = await axios.post(`${base}/members/${m.id}/checkin`, {}, auth);
      if (data.ok) toast.success(t('members.checkedIn', 'Checked in: {{name}}', { name: m.name }));
      else toast.error(stateLabel(t, data.reason));
      await load();
    } finally { setBusy(null); }
  };
  const sendLink = async (m) => {
    const { data } = await axios.get(`${base}/members/${m.id}/link`, auth);
    try { await navigator.clipboard.writeText(data.url); toast.success(t('members.passCopied', 'Pass link copied. Send it to them on WhatsApp.')); } catch { window.prompt('', data.url); }
  };
  const makeDoor = async (rotate) => {
    if (rotate && !window.confirm(t('members.rotateConfirm', 'Make a new door link? The old one stops working right away.'))) return;
    const { data } = await axios.post(`${base}/members-door-link`, null, { ...auth, params: rotate ? { rotate: true } : {} });
    setDoor(data.url);
  };

  return (
    <div data-testid="members-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('members.title', 'Members')}</h2>
        {businesses.length > 1 && (
          <select value={biz.id} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--brand-muted)' }}>
        {t('members.body', 'Set your plans, share the sign-up link, and check members in at the door. Payment is arranged with each member directly for now: mark them active once they have paid.')}
      </p>

      {/* Plans */}
      <section className="mb-6" data-testid="members-plans">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('members.plans', 'Plans')}</h3>
          {!planForm && (
            <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setPlanForm({ ...EMPTY_PLAN })} data-testid="plan-new">
              <Plus size={15} /> {t('members.newPlan', 'New plan')}
            </button>
          )}
        </div>
        {planForm && <div className="mb-3"><PlanForm initial={planForm} saving={saving} onCancel={() => setPlanForm(null)} onSave={savePlan} /></div>}
        {plans.length === 0 && !planForm ? (
          <p className="text-sm rounded-2xl border p-4" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
            {t('members.noPlans', 'No plans yet. Add your first: a monthly membership, a yearly one, or a pack of classes.')}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => (
              <li key={p.id} className="rounded-2xl border bg-white p-3 flex items-start justify-between gap-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="plan-row">
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{p.name}{!p.active && <span className="ms-2 text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{t('members.closed', 'Not open for sign-up')}</span>}</p>
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{planPrice(t, p)}</p>
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{planVisits(t, p)}</p>
                </div>
                <div className="flex shrink-0">
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('members.editPlan', 'Edit plan')} onClick={() => setPlanForm({ ...p, visits: p.visits ?? '', valid_months: p.valid_months ?? '' })}><Pencil size={15} /></button>
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('members.removePlan', 'Stop offering')} onClick={() => removePlan(p)}><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-6"><CustomFieldsEditor API={API} auth={auth} businessId={biz.id} form="membership" /></div>

      {/* Links */}
      {plans.some((p) => p.active) && (
        <section className="mb-6 rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface-muted, #F9FAFB)' }} data-testid="members-links">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}><Link2 size={15} /> {t('members.signupLink', 'Sign-up link')}</p>
            <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>{t('members.signupLinkBody', 'Put it in your Instagram bio or send it on WhatsApp. People join without making an account.')}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <code className="text-xs break-all px-2 py-1 rounded bg-white border" style={fieldStyle}>{signupUrl}</code>
              <CopyButton text={signupUrl} label={t('members.copy', 'Copy')} testid="copy-signup" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}><DoorOpen size={15} /> {t('members.doorLink', 'Door check-in')}</p>
            <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>{t('members.doorBody', 'Open this link once on the phone or tablet at your entrance. Then scan a member’s pass with that device’s camera, or type the 5-letter code on their pass.')}</p>
            {door ? (
              <div className="flex flex-wrap gap-2 items-center">
                <code className="text-xs break-all px-2 py-1 rounded bg-white border" style={fieldStyle}>{door}</code>
                <CopyButton text={door} label={t('members.copy', 'Copy')} testid="copy-door" />
                <button type="button" className={btnOutline} style={fieldStyle} onClick={() => makeDoor(true)}>{t('members.newDoorLink', 'New link')}</button>
              </div>
            ) : (
              <button type="button" className={btnOutline} style={fieldStyle} onClick={() => makeDoor(false)} data-testid="make-door">{t('members.makeDoorLink', 'Make the door link')}</button>
            )}
          </div>
        </section>
      )}

      {/* Members */}
      <section data-testid="members-list">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('members.list', 'Members')}</h3>
          {plans.length > 0 && !adding && (
            <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setAdding(true)} data-testid="member-new">
              <Plus size={15} /> {t('members.addMember', 'Add member')}
            </button>
          )}
        </div>
        {adding && <div className="mb-3"><AddMemberForm plans={plans} saving={saving} onCancel={() => setAdding(false)} onSave={addMember} /></div>}
        <div className="flex flex-wrap gap-2 mb-3" role="tablist">
          {['', ...FILTERS].map((f) => (
            <button
              key={f || 'all'}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className="px-3 min-h-[36px] rounded-full border text-xs font-semibold"
              style={filter === f ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : fieldStyle}
            >
              {f ? t(`members.filter.${f}`, f) : t('members.filter.all', 'All')}
              {f && counts[f] ? ` ${counts[f]}` : ''}
            </button>
          ))}
        </div>
        {members === null ? (
          <div className="py-8 text-center"><Loader2 className="animate-spin inline" size={18} /></div>
        ) : members.length === 0 ? (
          <p className="text-sm rounded-2xl border p-4" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
            {filter ? t('members.noneHere', 'No one here.') : t('members.none', 'No members yet. Share your sign-up link, or add someone who joined at the desk.')}
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="member-row" data-status={m.status}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{m.name} <span className="font-normal text-xs" style={{ color: 'var(--brand-muted)' }}>· {m.short_code}</span></p>
                    <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                      {m.plan.name} · {money(m.plan.price, m.plan.currency)}
                      {m.discount && <span style={{ color: '#1F5F3A' }}> · {t('discounts.memberLine', 'code {{code}}: {{price}} to pay', { code: m.discount.code, price: money(m.discount.price_after, m.plan.currency) })}</span>}
                      {' · '}<a href={`tel:${m.phone}`} dir="ltr">{m.phone}</a>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: m.state.ok ? 'var(--status-open, #2E7D4F)' : 'var(--ink)' }}>
                      {m.state.ok ? t('members.okToEnter', 'Active') : stateLabel(t, m.state.reason)}
                      {m.renews_on && ` · ${m.plan.period === 'pack' ? t('members.expires', 'Expires') : t('members.renews', 'Renews')} ${fmtDate(m.renews_on)}`}
                      {m.visits_left !== null && m.visits_left !== undefined && ` · ${t('members.visitsLeft', '{{n}} visits left', { n: m.visits_left })}`}
                      {m.last_visit_at && ` · ${t('members.lastVisit', 'Last visit')} ${fmtDate(m.last_visit_at)}`}
                    </p>
                    <AnswersList answers={m.answers} t={t} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.status === 'pending' && <button type="button" disabled={busy === m.id} className={btnSolid} style={solidStyle} onClick={() => act(m, 'activate')} data-testid="member-activate">{t('members.activate', 'Paid, activate')}</button>}
                    {m.status === 'active' && m.state.ok && <button type="button" disabled={busy === m.id} className={btnSolid} style={solidStyle} onClick={() => checkIn(m)} data-testid="member-checkin">{t('members.checkIn', 'Check in')}</button>}
                    {(m.status === 'active' || m.status === 'expired') && <button type="button" disabled={busy === m.id} className={btnOutline} style={fieldStyle} onClick={() => act(m, 'renew')} data-testid="member-renew">{t('members.renew', 'Paid, renew')}</button>}
                    {m.status === 'active' && <button type="button" disabled={busy === m.id} className={btnOutline} style={fieldStyle} onClick={() => act(m, 'pause')}>{t('members.pause', 'Pause')}</button>}
                    {m.status === 'paused' && <button type="button" disabled={busy === m.id} className={btnOutline} style={fieldStyle} onClick={() => act(m, 'resume')}>{t('members.resume', 'Resume')}</button>}
                    <button type="button" className={btnOutline} style={fieldStyle} onClick={() => sendLink(m)}>{t('members.passLink', 'Pass link')}</button>
                    {m.status !== 'cancelled' && <button type="button" aria-label={t('members.cancelMembership', 'Cancel membership')} className="grid place-content-center w-11 h-11" onClick={() => act(m, 'cancel')}><X size={16} /></button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
