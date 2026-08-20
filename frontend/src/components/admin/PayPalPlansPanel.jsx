import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { API } from '../../App';

/**
 * PayPal subscription-plan bootstrap, in the admin UI.
 *
 * The endpoints behind this are admin-only, so they can't be opened in a
 * browser tab — they need an Authorization header. Rather than have someone
 * paste fetch() calls into a devtools console (which also invites reading a
 * token out of storage by hand), the operation lives where the rest of the
 * admin tooling does.
 *
 * Creating a plan is a real write to PayPal. The confirm step names the
 * environment explicitly because a sandbox plan id is useless in live and
 * vice versa, and that is the mistake worth making impossible to stumble
 * into.
 */
const PayPalPlansPanel = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(
        `${API}/marketplace/subscription/plans/status`, { headers },
      );
      setStatus(res.data);
    } catch (e) {
      // Distinguish "not allowed" from "couldn't reach it" — they need
      // different fixes and the generic message sends people hunting.
      const code = e?.response?.status;
      setError(
        code === 403 ? 'Admin access required — sign in as an admin.'
          : code === 404 ? 'Endpoint not found — the backend may not have deployed yet.'
            : "Couldn't load plan status. Try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const isLive = status?.paypal_mode === 'live';
  const missing = status?.missing || [];

  const bootstrap = async () => {
    const what = missing.join(', ');
    const warning = isLive
      ? 'This creates REAL billing plans on your LIVE PayPal account.'
      : 'This creates plans on PayPal SANDBOX. No real money is involved.';
    if (!window.confirm(`${warning}\n\nPlans to create: ${what}\n\nContinue?`)) return;

    setCreating(true);
    try {
      const res = await axios.post(
        `${API}/marketplace/subscription/plans/bootstrap`, {}, { headers },
      );
      setStatus({ ...res.data, missing: (res.data.plans || []).filter((p) => !p.exists).map((p) => p.key) });
      const made = res.data.created?.length || 0;
      const failed = res.data.failed?.length || 0;
      if (failed) toast.error(`${made} created, ${failed} failed — see the list below`);
      else toast.success(made ? `Created ${made} plan${made === 1 ? '' : 's'}` : 'Nothing to create');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Plan creation failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-[#E5E5E5] p-6 max-w-2xl mt-6"
      data-testid="admin-paypal-plans"
    >
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>
          Provider subscription plans
        </h2>
        <button
          onClick={load}
          disabled={loading || creating}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          title="Refresh"
          data-testid="paypal-plans-refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Each commitment tier needs its own plan on PayPal. They&apos;re created once,
        here, so the first provider to subscribe isn&apos;t the one who discovers a
        problem.
      </p>

      {loading && !status ? (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Checking…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600" data-testid="paypal-plans-error">{error}</p>
      ) : status ? (
        <>
          <div
            className={`rounded-lg px-3 py-2 mb-4 text-sm flex items-center gap-2 ${
              isLive ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'
            }`}
            data-testid="paypal-plans-mode"
          >
            {isLive ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>
              PayPal mode: <strong>{status.paypal_mode}</strong>
              {isLive ? ' — changes here affect real billing.' : ' — safe for testing.'}
            </span>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="pb-2 font-medium">Tier</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(status.plans || []).map((p) => (
                <tr key={p.key} className="border-b border-gray-100" data-testid={`paypal-plan-row-${p.key}`}>
                  <td className="py-2">{p.months} months</td>
                  <td className="py-2">${p.monthly_price}/mo</td>
                  <td className="py-2">
                    {p.exists ? (
                      <span className="text-green-700">
                        Ready
                        <span className="text-gray-400 text-xs ms-2">{p.plan_id}</span>
                      </span>
                    ) : (
                      <span className="text-amber-700">Not created yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(status.failed || []).length > 0 && (
            <div className="rounded-lg bg-red-50 px-3 py-2 mb-4 text-sm text-red-800">
              {status.failed.map((f) => (
                <p key={f.key}><strong>{f.key}</strong>: {f.error}</p>
              ))}
            </div>
          )}

          {missing.length > 0 ? (
            <button
              onClick={bootstrap}
              disabled={creating}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60 ${
                isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--brand-primary)] hover:bg-[#0F3A3A]'
              }`}
              data-testid="paypal-plans-create"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              {creating
                ? 'Creating…'
                : `Create ${missing.length} missing plan${missing.length === 1 ? '' : 's'}`}
            </button>
          ) : (
            <p className="text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 size={15} /> All tiers ready — providers can subscribe.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
};

export default PayPalPlansPanel;
