/**
 * /staff/join/:token: accept an invite to a business's staff (backend
 * routes/marketplace/staff.py). Staff do sign in (unlike customers): the
 * account is what their access hangs on. Signed out, the page sends them
 * to sign in or create an account and back here.
 */
import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, UserCog } from 'lucide-react';
import { API, AuthContext } from '../App';

export default function StaffJoinPage() {
  const { token: invite } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const here = `/staff/join/${invite}`;

  useEffect(() => {
    axios.get(`${API}/marketplace/staff/invite/${encodeURIComponent(invite)}`).then(({ data }) => setD(data)).catch(() => setD(false));
  }, [invite]);

  const accept = async () => {
    setBusy(true); setError('');
    try {
      await axios.post(`${API}/marketplace/staff/invite/${encodeURIComponent(invite)}/accept`, null, { headers: { Authorization: `Bearer ${token}` } });
      navigate('/dashboard');
    } catch (e) {
      setError(e?.response?.data?.detail || t('staffJoin.failed', 'Could not accept. Try again.'));
    } finally { setBusy(false); }
  };

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  const shell = (children) => (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="staff-join">
      <main className="max-w-md mx-auto px-4 pb-20 text-center" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 48px)' }}>{children}</main>
    </div>
  );
  if (d === false) {
    return shell(<h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('staffJoin.bad', 'This invite is no longer valid. Ask the business to send a new one.')}</h1>);
  }
  const name = (i18n.language?.startsWith('he') && d.business.name_he) || d.business.name;
  return shell(
    <>
      {d.business.logo_url ? <img src={d.business.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover mx-auto mb-3" /> : <UserCog size={30} className="inline mb-3" style={{ color: 'var(--ink)' }} />}
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('staffJoin.title', 'Join the team at {{name}}', { name })}</h1>
      <p className="text-sm mb-1" style={{ color: 'var(--brand-muted)' }}>{t('staffJoin.youCanOpen', 'You will be able to open:')}</p>
      <p className="text-sm font-semibold mb-5" style={{ color: 'var(--ink)' }}>{d.permissions.map((a) => t(`staff.area.${a}`, a)).join(' · ')}</p>
      {d.status === 'active' && user ? (
        <Link to="/dashboard" className="inline-flex items-center px-6 min-h-[52px] rounded-full text-base font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('staffJoin.open', 'Open the dashboard')}</Link>
      ) : user ? (
        <>
          <button type="button" disabled={busy} onClick={accept} className="inline-flex items-center gap-2 px-6 min-h-[52px] rounded-full text-base font-semibold"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="staff-accept">
            {busy && <Loader2 size={16} className="animate-spin" />} {t('staffJoin.accept', 'Accept and join')}
          </button>
          {error && <p className="text-sm mt-3" role="alert" style={{ color: '#B42318' }}>{error}</p>}
        </>
      ) : (
        <>
          <p className="text-sm mb-4" style={{ color: 'var(--ink)' }}>{t('staffJoin.signInFirst', 'Sign in or create an account with {{email}} to accept.', { email: d.email })}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to={`/auth/login?redirect=${encodeURIComponent(here)}`} className="inline-flex items-center px-6 min-h-[52px] rounded-full text-base font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="staff-signin">{t('staffJoin.signIn', 'Sign in')}</Link>
            <Link to={`/signup?redirect=${encodeURIComponent(here)}`} className="inline-flex items-center px-6 min-h-[52px] rounded-full border text-base font-semibold" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}>{t('staffJoin.signUp', 'Create an account')}</Link>
          </div>
        </>
      )}
    </>,
  );
}
