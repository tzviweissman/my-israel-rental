/**
 * Super Admin → Requests moderation queue (spec N6, closing dead-ends
 * audit 2026-09-08 finding #2).
 *
 * The board's "Report" button has posted into `request_reports` since it
 * shipped, and the toast that follows it — "Thanks — we will take a
 * look" — has been a lie the whole time: nothing anywhere read the
 * collection it wrote into, and the admin console's "Attention" queue
 * counted the backlog (`posts_awaiting_moderation`) without a tab to send
 * an admin to when they clicked it. This tab, and the two endpoints it
 * calls (`GET/POST /admin/request-reports`), already existed and were
 * simply never wired to anything.
 *
 * Same shape as ServicesTab on purpose: a list, and two reversible
 * actions. "Hide" takes a post off the board immediately; "Allow" clears
 * the flag and puts it back. Both are recorded (`moderated_at`,
 * `moderated_by`) so a decision an admin already made does not resurface
 * in the queue tomorrow and retrain them to ignore it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ExternalLink, EyeOff, Eye, Loader2, Flag, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '../../App';
import formatDate from '../../utils/formatDate';

const BORDER = 'var(--brand-border)';

export default function RequestReportsTab({ token }) {
  const [rows, setRows] = useState(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async (resolved) => {
    try {
      const { data } = await axios.get(`${API}/admin/request-reports`, {
        ...auth,
        params: { include_resolved: resolved },
      });
      setRows(data);
    } catch {
      setRows([]);
      toast.error('Could not load reported posts');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(includeResolved); }, [load, includeResolved]);

  const moderate = async (row, action) => {
    setBusyId(row.id);
    try {
      await axios.post(`${API}/admin/request-reports/${row.id}`, { action }, auth);
      if (includeResolved) {
        setRows((prev) => prev.map((r) => (r.id === row.id
          ? { ...r, hidden_by_admin: action === 'hide', needs_review: false, report_count: action === 'hide' ? r.report_count : 0, moderated_at: new Date().toISOString() }
          : r)));
      } else {
        // A decision the admin just made should not still be sitting in
        // an "unresolved" list a moment later.
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      }
      toast.success(action === 'hide' ? 'Hidden from the board' : 'Restored to the board');
    } catch {
      toast.error('That did not work');
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}>
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );
  }

  return (
    <div data-testid="admin-request-reports-tab">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          Reported posts ({rows.length})
        </h2>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
          <input
            type="checkbox"
            checked={includeResolved}
            onChange={(e) => setIncludeResolved(e.target.checked)}
            data-testid="admin-request-reports-include-resolved"
          />
          Show already-decided posts too
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="admin-request-reports-empty">
          {includeResolved ? 'No reported or flagged posts yet.' : 'Nothing waiting on a decision.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const decided = !!r.moderated_at;
            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border p-4"
                style={{ borderColor: BORDER }}
                data-testid={`admin-request-report-${r.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold" style={{ color: 'var(--ink)' }}>{r.title || '(untitled)'}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: '#F3F0E9', color: 'var(--brand-muted)' }}
                      >
                        {r.post_kind === 'have' ? 'Offer' : 'Wanted'} · {r.request_type}
                      </span>
                      {r.report_count > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: '#FBECEC', color: '#B23B3B' }}
                        >
                          <Flag size={11} /> {r.report_count} report{r.report_count === 1 ? '' : 's'}
                        </span>
                      )}
                      {r.needs_review && r.report_count === 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: '#FDF3E3', color: '#8A6A14' }}
                        >
                          <ShieldAlert size={11} /> Flagged on creation
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={r.hidden_by_admin
                          ? { background: '#F3F0E9', color: 'var(--brand-muted)' }
                          : { background: '#E6F4EA', color: '#2E7D4F' }}
                      >
                        {r.hidden_by_admin ? 'Hidden' : 'Visible on board'}
                      </span>
                    </div>
                    <p className="text-sm mb-1" style={{ color: 'var(--brand-muted)' }}>
                      {r.description}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                      {[r.category, r.area].filter(Boolean).join(' · ')}
                      {r.created_at ? ` · posted ${formatDate(String(r.created_at).slice(0, 10))}` : ''}
                    </p>
                  </div>
                  <a
                    href={`/requests/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                    style={{ color: 'var(--brand-primary)' }}
                    data-testid={`admin-request-report-open-${r.id}`}
                  >
                    <ExternalLink size={12} /> Open
                  </a>
                </div>

                {r.reports.length > 0 && (
                  <ul className="mt-2 ps-4 list-disc text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {r.reports.map((rep, i) => (
                      <li key={i}>
                        {rep.reason || '(no reason given)'}
                        {rep.created_at ? ` — ${formatDate(String(rep.created_at).slice(0, 10))}` : ''}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id || (decided && r.hidden_by_admin)}
                    onClick={() => moderate(r, 'hide')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background: '#FBECEC', color: '#B23B3B' }}
                    data-testid={`admin-request-report-hide-${r.id}`}
                  >
                    <EyeOff size={12} /> Hide
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id || (decided && !r.hidden_by_admin && !r.needs_review && !r.report_count)}
                    onClick={() => moderate(r, 'allow')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background: '#E6F4EA', color: '#2E7D4F' }}
                    data-testid={`admin-request-report-allow-${r.id}`}
                  >
                    <Eye size={12} /> Allow
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
