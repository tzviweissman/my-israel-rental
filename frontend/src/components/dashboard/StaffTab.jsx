/**
 * Dashboard → Staff (backend routes/marketplace/staff.py): the owner
 * invites people by email and picks what they can open. Owner only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Pencil, UserCog } from 'lucide-react';

const AREAS = ['orders', 'members', 'customers', 'messages', 'discounts', 'summary'];
const PRESETS = { manager: AREAS, front_desk: ['orders', 'members'] };
const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const btnOutline = 'inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border text-sm font-semibold';

function AreaPicker({ value, onChange }) {
  const { t } = useTranslation();
  const preset = Object.entries(PRESETS).find(([, v]) => v.length === value.length && v.every((a) => value.includes(a)))?.[0] || 'custom';
  const toggle = (a) => {
    let next = value.includes(a) ? value.filter((x) => x !== a) : [...value, a];
    if (a === 'messages' && next.includes('messages') && !next.includes('customers')) next = [...next, 'customers'];
    if (a === 'customers' && !next.includes('customers')) next = next.filter((x) => x !== 'messages');
    onChange(AREAS.filter((x) => next.includes(x)));
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('staff.role', 'Role')}>
        {[['manager', t('staff.manager', 'Manager: everything')], ['front_desk', t('staff.frontDesk', 'Front desk: orders and members')], ['custom', t('staff.custom', 'Choose')]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={preset === k} onClick={() => k !== 'custom' && onChange(PRESETS[k])}
                  className="px-3 min-h-[36px] rounded-full border text-xs font-semibold"
                  style={preset === k ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : fieldStyle}>{l}</button>
        ))}
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {AREAS.map((a) => (
          <label key={a} className="inline-flex items-start gap-2 text-sm min-h-[36px]" style={{ color: 'var(--ink)' }}>
            <input type="checkbox" className="mt-1" checked={value.includes(a)} onChange={() => toggle(a)} data-testid={`staff-area-${a}`} />
            <span>{t(`staff.area.${a}`, a)}<span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{t(`staff.areaHelp.${a}`, '')}</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function StaffTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem('orders.business') || ''; } catch { return ''; } });
  const [rows, setRows] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [areas, setAreas] = useState(PRESETS.front_desk);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/businesses`, auth).then(({ data }) => {
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
  const base = `${API}/marketplace/businesses/${bizId}/staff`;
  const load = useCallback(() => { if (ready) axios.get(base, auth).then(({ data }) => setRows(data)).catch(() => setRows([])); }, [ready, base, auth]);
  useEffect(() => { load(); }, [load]);

  if (businesses === null) return <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (businesses.length === 0) return <p className="rounded-2xl border p-8 text-center text-sm" style={{ ...fieldStyle, color: 'var(--brand-muted)' }}>{t('staff.needBusiness', 'Add a business first.')}</p>;
  const biz = businesses.find((b) => b.id === bizId) || businesses[0];
  const err = (e) => toast.error(e?.response?.data?.detail || t('staff.failed', 'Could not save. Try again.'));

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.post(base, { email: email.trim(), name: name.trim() || null, permissions: areas, lang: i18n.language?.startsWith('he') ? 'he' : 'en' }, auth);
      toast.success(t('staff.invited', 'Invite sent to {{email}}', { email: data.email }));
      setInviting(false); setEmail(''); setName(''); setAreas(PRESETS.front_desk);
      load();
    } catch (x) { err(x); } finally { setBusy(false); }
  };
  const saveAreas = async () => {
    setBusy(true);
    try { await axios.patch(`${base}/${editing.id}`, { permissions: editing.permissions }, auth); setEditing(null); load(); } catch (x) { err(x); } finally { setBusy(false); }
  };
  const remove = async (r) => {
    if (!window.confirm(t('staff.removeConfirm', 'Remove {{who}}? They lose access right away.', { who: r.name || r.email }))) return;
    await axios.delete(`${base}/${r.id}`, auth).catch(err);
    load();
  };

  return (
    <div data-testid="staff-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('staff.title', 'Staff')}</h2>
        <div className="flex items-center gap-2">
          {businesses.length > 1 && (
            <select value={biz.id} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {!inviting && <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setInviting(true)} data-testid="staff-invite-open"><Plus size={15} /> {t('staff.invite', 'Invite someone')}</button>}
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('staff.body', 'Give a manager or someone at the front desk their own sign-in, with only what they need. They never see your business settings or this list.')}
      </p>

      {inviting && (
        <form onSubmit={invite} className="rounded-2xl border bg-white p-4 space-y-3 mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="staff-invite-form">
          <div className="grid gap-2 sm:grid-cols-2">
            <input required type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className={field} style={fieldStyle}
                   placeholder={t('staff.email', 'Their email')} aria-label={t('staff.email', 'Their email')} dir="ltr" data-testid="staff-email" />
            <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} style={fieldStyle}
                   placeholder={t('staff.name', 'Their name (optional)')} aria-label={t('staff.name', 'Their name (optional)')} />
          </div>
          <AreaPicker value={areas} onChange={setAreas} />
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('staff.inviteNote', 'They get an email with a link. They sign in or create an account with this email address, and accept.')}</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !areas.length} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="staff-invite-send">
              {busy && <Loader2 size={14} className="animate-spin" />} {t('staff.send', 'Send the invite')}
            </button>
            <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setInviting(false)}>{t('staff.cancel', 'Cancel')}</button>
          </div>
        </form>
      )}

      {rows === null ? <Loader2 className="animate-spin" size={18} /> : rows.length === 0 && !inviting ? (
        <div className="rounded-2xl border p-8 text-center text-sm" style={{ ...fieldStyle, color: 'var(--brand-muted)' }}>
          <UserCog size={22} className="inline mb-2" />
          <p>{t('staff.none', 'No staff yet. Only you can open your business here.')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="staff-row" data-status={r.status}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{r.name || r.email}
                    {r.status === 'invited' && <span className="ms-2 text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{t('staff.pending', 'Invite not accepted yet')}</span>}
                  </p>
                  {r.name && <p className="text-xs" style={{ color: 'var(--brand-muted)' }} dir="ltr">{r.email}</p>}
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink)' }}>{r.permissions.map((a) => t(`staff.area.${a}`, a)).join(' · ')}</p>
                </div>
                <div className="flex">
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('staff.edit', 'Change what they can open')} onClick={() => setEditing({ ...r })}><Pencil size={15} /></button>
                  <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('staff.remove', 'Remove')} onClick={() => remove(r)} data-testid="staff-remove"><Trash2 size={15} /></button>
                </div>
              </div>
              {editing?.id === r.id && (
                <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--brand-border)' }}>
                  <AreaPicker value={editing.permissions} onChange={(p) => setEditing({ ...editing, permissions: p })} />
                  <div className="flex gap-2">
                    <button type="button" disabled={busy || !editing.permissions.length} onClick={saveAreas} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('staff.save', 'Save')}</button>
                    <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setEditing(null)}>{t('staff.cancel', 'Cancel')}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

