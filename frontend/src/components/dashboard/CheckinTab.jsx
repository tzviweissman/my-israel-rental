/**
 * Dashboard → Check-in: the screen for staff who only check members in
 * (backend utils/business_access.py "checkin"). Open the door screen, or
 * find a member by name or code and check them in. No phone numbers,
 * emails or plans to edit: the server leaves them out for this role.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, DoorOpen, Search } from 'lucide-react';
import { stateLabel } from '../members/memberText';

const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function CheckinTab({ API, token }) {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState('');
  const [members, setMembers] = useState(null);
  const [door, setDoor] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    axios.get(`${API}/marketplace/my-workplaces`, { ...auth, params: { perm: 'checkin' } }).then(({ data }) => {
      const list = (data || []).filter((b) => b.active);
      setBusinesses(list);
      if (list[0]) setBizId(list[0].id);
    }).catch(() => setBusinesses([]));
  }, [API, auth]);
  const base = `${API}/marketplace/businesses/${bizId}`;
  const load = useCallback(() => {
    if (!bizId) return;
    axios.get(`${base}/members`, { ...auth, params: { status: 'active' } }).then(({ data }) => setMembers(data.members)).catch(() => setMembers([]));
    axios.get(`${base}/members-door-link`, auth).then(({ data }) => setDoor(data.token)).catch(() => setDoor(null));
  }, [bizId, base, auth]);
  useEffect(() => { load(); }, [load]);

  if (businesses === null) return <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (!businesses.length) return <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('checkin.none', 'You are not on a check-in team.')}</p>;

  const checkIn = async (m) => {
    setBusy(m.id);
    try {
      const { data } = await axios.post(`${base}/members/${m.id}/checkin`, {}, auth);
      if (data.ok) toast.success(t('members.checkedIn', 'Checked in: {{name}}', { name: m.name }));
      else toast.error(stateLabel(t, data.reason));
      load();
    } finally { setBusy(null); }
  };
  const needle = q.trim().toLowerCase();
  const shown = (members || []).filter((m) => !needle || m.name.toLowerCase().includes(needle) || (m.short_code || '').toLowerCase() === needle);

  return (
    <div data-testid="checkin-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('checkin.title', 'Check-in')}</h2>
        {businesses.length > 1 && (
          <select value={bizId} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      {door ? (
        <Link to={`/members/door/${door}`} className="inline-flex items-center gap-2 px-5 min-h-[52px] rounded-full text-base font-semibold mb-2" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="checkin-door">
          <DoorOpen size={18} /> {t('checkin.openDoor', 'Open the door screen')}
        </Link>
      ) : (
        <p className="text-sm mb-2" style={{ color: 'var(--brand-muted)' }}>{t('checkin.noDoor', 'The door screen is not set up yet. Ask the owner or a manager to make the door link in Members.')}</p>
      )}
      <p className="text-xs mb-5" style={{ color: 'var(--brand-muted)' }}>{t('checkin.doorHow', 'On the device at the entrance: open the door screen once, then scan members’ passes with its camera.')}</p>

      <div className="relative mb-3">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full ps-9 px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle}
               placeholder={t('checkin.searchPh', 'Find a member by name or code')} aria-label={t('checkin.search', 'Find a member')} data-testid="checkin-search" />
      </div>
      {members === null ? <Loader2 className="animate-spin" size={18} /> : (
        <ul className="space-y-2">
          {shown.slice(0, 50).map((m) => (
            <li key={m.id} className="rounded-2xl border bg-white p-3 flex items-center justify-between gap-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="checkin-row">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{m.name} <span className="font-normal text-xs" style={{ color: 'var(--brand-muted)' }}>· {m.short_code}</span></p>
                <p className="text-xs" style={{ color: m.state.ok ? '#2E7D4F' : 'var(--ink)' }}>
                  {m.plan.name} · {m.state.ok ? t('members.okToEnter', 'Active') : stateLabel(t, m.state.reason)}
                  {m.visits_left != null && ` · ${t('members.visitsLeft', '{{n}} visits left', { n: m.visits_left })}`}
                </p>
              </div>
              {m.state.ok && (
                <button type="button" disabled={busy === m.id} onClick={() => checkIn(m)} className="shrink-0 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                        style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="checkin-button">
                  {t('members.checkIn', 'Check in')}
                </button>
              )}
            </li>
          ))}
          {shown.length === 0 && <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('members.noneHere', 'No one here.')}</p>}
        </ul>
      )}
    </div>
  );
}
