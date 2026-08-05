/**
 * AuthDeeplink — consumes a signed JWT from job-match notification
 * email CTAs ("View & Bid") and mints a fresh 30-day session so the
 * provider lands on the job post already logged-in.
 *
 * URL shape: /auth/deeplink?t=<signed_jwt>&goto=/services/jobs/<id>
 *
 * Failure modes (expired, wrong purpose, deleted account) drop the
 * visitor to /auth/login with a friendly reason toast — they can log
 * in the normal way and still reach the destination.
 */
import React, { useContext, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthContext, API } from '../App';

const AuthDeeplink = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const ran = useRef(false);

  useEffect(() => {
    // StrictMode double-mount guard so we don't burn the token twice.
    if (ran.current) return;
    ran.current = true;

    const token = params.get('t');
    const goto = params.get('goto') || '/dashboard';

    if (!token) {
      toast.error('This link is missing its token. Please log in.');
      navigate('/auth/login', { replace: true });
      return;
    }

    axios
      .post(`${API}/auth/deeplink-consume`, { token })
      .then(({ data }) => {
        // login() persists to sessionStorage and updates context state.
        login(data.token, data.user);
        toast.success(`Welcome back, ${data.user?.name?.split(' ')[0] || ''}!`);
        navigate(goto, { replace: true });
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || 'This link is no longer valid.';
        toast.error(detail);
        // Keep the destination so a manual login can still forward the
        // provider where they wanted to go.
        navigate(`/auth/login?redirect=${encodeURIComponent(goto)}`, { replace: true });
      });
  }, [params, navigate, login]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-white"
      data-testid="auth-deeplink-loader"
    >
      <div className="text-center">
        <Loader2 className="mx-auto animate-spin text-[var(--brand-primary)]" size={32} />
        <p className="mt-3 text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  );
};

export default AuthDeeplink;
