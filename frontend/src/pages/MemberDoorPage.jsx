/**
 * The door. Two routes, one page:
 *
 *   /members/door/:token    The business opens this once on the device at
 *                           its entrance. It remembers the door token on
 *                           that device, and offers a box for the 5-letter
 *                           code a member reads out.
 *   /members/checkin/:code  What a member's QR opens. Scanned with the door
 *                           device's own camera, it checks the member in
 *                           using the remembered door token. Scanned by any
 *                           other phone it does nothing but explain.
 *
 * No scanner library: the phone's camera app already reads QR codes and
 * opens the link, which is the scanner every staff member knows.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, DoorOpen, CheckCircle2, XCircle } from 'lucide-react';
import { API } from '../lib/apiBase';
import { stateLabel } from '../components/members/memberText';

const KEY = 'members.door';
const readDoor = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };

function Result({ r, onNext }) {
  const { t } = useTranslation();
  const ok = r.ok;
  return (
    <div className="rounded-2xl p-6 text-center" data-testid="door-result" data-ok={ok ? '1' : '0'}
         style={{ background: ok ? '#E6F4EA' : '#FDECEC', color: ok ? '#1F5F3A' : '#8A1C1C' }}>
      {ok ? <CheckCircle2 size={56} className="inline" /> : <XCircle size={56} className="inline" />}
      <p className="text-2xl font-bold mt-2">{ok ? t('members.welcome', 'Welcome') : t('members.notIn', 'Not checked in')}</p>
      {r.name && <p className="text-xl mt-1">{r.name}</p>}
      {r.plan && <p className="text-sm mt-1">{r.plan}</p>}
      {r.class && <p className="text-base font-semibold mt-1" data-testid="door-class">{t('classes.forClass', 'For {{c}}', { c: r.class })}</p>}
      {!ok && <p className="text-base font-semibold mt-2">{stateLabel(t, r.reason)}</p>}
      {r.visits_left !== null && r.visits_left !== undefined && <p className="text-sm mt-1">{t('members.visitsLeft', '{{n}} visits left', { n: r.visits_left })}</p>}
      {r.reward && <p className="text-xl font-bold mt-2" data-testid="door-reward">{t('members.rewardEarned', 'Reward earned: {{reward}}', { reward: r.reward })}</p>}
      {r.stamps_needed && !r.reward && <p className="text-sm mt-1">{t('members.stampsOf', '{{n}} of {{total}} stamps', { n: r.stamps, total: r.stamps_needed })}</p>}
      {onNext && (
        <button type="button" onClick={onNext} className="mt-5 inline-flex items-center justify-center min-h-[52px] px-8 rounded-full text-base font-semibold"
                style={{ background: '#000', color: '#fff' }} data-testid="door-next">
          {t('members.next', 'Next member')}
        </button>
      )}
    </div>
  );
}

export function MemberCheckinPage() {
  const { code } = useParams();
  const { t } = useTranslation();
  const [r, setR] = useState(null);
  const door = readDoor();
  const done = useRef(false);

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);
  useEffect(() => {
    if (!door || done.current) return;
    done.current = true;   // StrictMode runs effects twice; one visit is one check-in
    axios.post(`${API}/marketplace/memberships/door/${encodeURIComponent(door)}/checkin`, { code })
      .then(({ data }) => setR(data))
      .catch(() => setR({ ok: false, reason: 'not_found' }));
  }, [door, code]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="member-checkin">
      <main className="max-w-md mx-auto px-4 py-10">
        {!door ? (
          <div className="text-center">
            <DoorOpen size={28} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('members.memberCode', 'This is a member’s check-in code')}</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('members.memberCodeBody', 'Staff: open your door link on this device first, then scan again.')}</p>
          </div>
        ) : r === null ? (
          <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={24} /></div>
        ) : (
          <>
            <Result r={r} />
            <div className="text-center mt-5"><Link to={`/members/door/${door}`} className="text-base font-semibold underline" style={{ color: 'var(--ink)' }}>{t('members.backToDoor', 'Back to the door screen')}</Link></div>
          </>
        )}
      </main>
    </div>
  );
}

export default function MemberDoorPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const [biz, setBiz] = useState(null);
  const [count, setCount] = useState(0);
  const [code, setCode] = useState('');
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);
  const load = useCallback(() => axios.get(`${API}/marketplace/memberships/door/${encodeURIComponent(token)}`)
    .then(({ data }) => {
      setBiz(data.business);
      setCount(data.checkins_today);
      try { localStorage.setItem(KEY, token); } catch { /* private mode: QR scans won't work, typing still does */ }
    })
    .catch(() => setBiz(false)), [token]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/memberships/door/${encodeURIComponent(token)}/checkin`, { code: code.trim() });
      setR(data);
      if (data.ok) setCount((n) => n + 1);
    } catch { setR({ ok: false, reason: 'not_found' }); } finally { setBusy(false); }
  };
  const next = () => { setR(null); setCode(''); setTimeout(() => input.current?.focus(), 0); };

  if (biz === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (biz === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="door-bad-link">
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('members.badLink', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('members.doorBadBody', 'Ask the business owner for the new door link.')}</p>
      </div>
    );
  }
  const bizName = (lang === 'he' && biz.name_he) || biz.name;
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="member-door">
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{t('members.doorTitle', 'Door check-in')}</p>
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{bizName}</h1>
          </div>
          <p className="text-sm text-end shrink-0" style={{ color: 'var(--brand-muted)' }}>{t('members.today', 'Today')}<br /><b className="text-lg" style={{ color: 'var(--ink)' }} data-testid="door-count">{count}</b></p>
        </div>
        {r ? <Result r={r} onNext={next} /> : (
          <form onSubmit={submit} className="rounded-2xl border bg-white p-5 space-y-4" style={{ borderColor: 'var(--brand-border)' }}>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('members.doorHow', 'Scan the member’s QR code with this device’s camera, or type the 5-letter code from their pass.')}</p>
            <input ref={input} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" autoComplete="off"
                   dir="ltr" className="w-full px-3 rounded-xl border text-center text-2xl tracking-[0.3em] min-h-[60px]" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                   placeholder="ABC23" aria-label={t('members.code', 'Member code')} data-testid="door-code" />
            <button type="submit" disabled={busy || code.trim().length < 4} className="w-full inline-flex justify-center items-center gap-2 min-h-[52px] rounded-full text-base font-semibold disabled:opacity-60"
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="door-submit">
              {busy && <Loader2 size={16} className="animate-spin" />} {t('members.checkIn', 'Check in')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
