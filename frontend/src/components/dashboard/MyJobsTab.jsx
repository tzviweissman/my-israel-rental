/**
 * MyJobsTab — poster-side dashboard for the Jobs board.
 *
 * Anyone who has posted a job (renter, owner, or provider) sees their
 * jobs here with an application count. Clicking a job expands its
 * applicants inline so the poster can read every provider's pitch +
 * quoted price + response-time band in one place.
 *
 * Actions:
 *   • Awarded   — PATCH status:awarded (someone got the job). The model
 *                 has allowed this since jobs shipped, it had a badge
 *                 colour waiting for it, and nothing ever set it: a
 *                 poster who had hired somebody could only "close", which
 *                 says the job is over without saying it was filled.
 *                 (Dead-ends audit 2026-09-03, #11.)
 *   • Close     — PATCH status:closed (job is hidden from the board and
 *                 stops accepting applications; keeps the applicant list
 *                 visible so the poster can still review history).
 *   • Reopen    — PATCH status:open (re-lists on the board).
 *   • View      — public detail page (helpful sanity-check of what
 *                 providers actually see).
 *   • Post new  — CTA to /businesses/post-job.
 *
 * v1 intentionally does NOT include per-applicant "Award" or in-platform
 * messaging — those flows need a backend Award endpoint + job-scoped
 * chat threads. See PRD/Roadmap for planned v2.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { saveReturnPath } from '../../hooks/useBackNavigation';
import axios from 'axios';
import { toast } from 'sonner';
import EditJobModal from './EditJobModal';
import { Loader2, MapPin, Coins, Calendar, Plus, ChevronDown, ChevronRight, ExternalLink, Zap, Users, ArrowRight, MessageCircle, Pencil, Award, RotateCcw } from 'lucide-react';

const StatusPill = ({ status }) => {
  // Its own, because this is a module-level component: a `t` from the
  // card below would be a ReferenceError at render.
  const { t } = useTranslation();
  const styles = {
    open: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    awarded: 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)] border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20',
    closed: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${styles[status] || styles.closed}`}
      data-testid={`my-job-status-${status}`}
    >
      {t(`myJobs.status_${status}`, status?.[0]?.toUpperCase() + status?.slice(1))}
    </span>
  );
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Response bucket comes straight off the provider profile — same source
// as the gig cards. We add a Zap icon to align visually with the "fast
// responders" badges elsewhere in the marketplace UI.
const ResponseBadge = ({ bucket }) => {
  if (!bucket) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--brand-primary)]" data-testid="applicant-response-badge">
      <Zap size={10} /> {bucket}
    </span>
  );
};

const ApplicationRow = ({ app, jobId, onMessage }) => {
  const sym = app.quoted_currency === 'USD' ? '$' : '₪';
  const price =
    app.quoted_price != null
      ? `${sym}${Number(app.quoted_price).toLocaleString()}`
      : null;
  return (
    <div className="border-t border-gray-100 pt-3 pb-3" data-testid={`applicant-${app.id}`}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate" data-testid={`applicant-name-${app.id}`}>
            {app.provider?.display_name || 'Provider'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <ResponseBadge bucket={app.provider?.response_bucket} />
            <span className="text-[10px] text-gray-400">{timeAgo(app.created_at)}</span>
          </div>
        </div>
        {price && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500">Quoted</p>
            <p className="text-sm font-bold text-[var(--brand-primary)]" data-testid={`applicant-quote-${app.id}`}>{price}</p>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-2" data-testid={`applicant-message-${app.id}`}>
        {app.message}
      </p>
      <button
        onClick={() => onMessage(app)}
        disabled={!app.provider?.user_id}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/25 text-[var(--brand-primary)] bg-white hover:bg-[var(--brand-primary)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[var(--brand-primary)]"
        data-testid={`applicant-message-btn-${app.id}`}
      >
        <MessageCircle size={11} /> Message
      </button>
    </div>
  );
};

const JobCard = ({ job, API, token, onStatusChange, onJobUpdated }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [applications, setApplications] = useState(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [editing, setEditing] = useState(false);

  const sym = job.budget_currency === 'USD' ? '$' : '₪';
  const budget =
    job.budget_type === 'fixed' && job.budget_amount
      ? `${sym}${Number(job.budget_amount).toLocaleString()}`
      : 'Open to offers';

  const loadApplications = useCallback(async () => {
    if (applications) return;
    setLoadingApps(true);
    try {
      const { data } = await axios.get(`${API}/marketplace/jobs/${job.id}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApplications(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load applicants');
      setApplications([]);
    } finally {
      setLoadingApps(false);
    }
  }, [API, applications, job.id, token]);

  const toggleOpen = () => {
    if (!open && job.applications_count > 0) loadApplications();
    setOpen(!open);
  };

  const patchStatus = async (nextStatus) => {
    setMutating(true);
    try {
      await axios.patch(
        `${API}/marketplace/jobs/${job.id}`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        {
          closed: t('myJobs.toastClosed', 'Job closed. Businesses can no longer apply.'),
          awarded: t('myJobs.toastAwarded', 'Marked as awarded. It stays on your list and leaves the board.'),
          open: t('myJobs.toastReopened', 'Job reopened.'),
        }[nextStatus] || t('myJobs.toastUpdated', 'Updated'),
      );
      onStatusChange?.(job.id, nextStatus);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('myJobs.updateFailed', 'Could not update that job'));
    } finally {
      setMutating(false);
    }
  };

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
      data-testid={`my-job-card-${job.id}`}
    >
      <button
        onClick={toggleOpen}
        className="w-full text-left px-4 sm:px-5 py-4 hover:bg-gray-50/60 transition-colors"
        data-testid={`my-job-toggle-${job.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{job.title}</h3>
              <StatusPill status={job.status} />
            </div>
            <p className="text-sm text-gray-600 line-clamp-1">{job.description}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1"><Coins size={12} /> {budget}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {job.area}</span>
              {job.preferred_date && (
                <span className="inline-flex items-center gap-1"><Calendar size={12} /> {job.preferred_date}</span>
              )}
              <span className="text-gray-400">· posted {timeAgo(job.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                job.applications_count > 0
                  ? 'bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 text-[#8A6A15] border border-[rgb(var(--gold-rgb)/<alpha-value>)]/30'
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
              data-testid={`my-job-app-count-${job.id}`}
            >
              <Users size={12} />
              {job.applications_count}
            </div>
            {open ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 sm:px-5 py-4" data-testid={`my-job-body-${job.id}`}>
          {/* Full description + actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Full description</p>
            <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{job.description}</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              data-testid={`my-job-edit-${job.id}`}
            >
              <Pencil size={12} /> Edit job
            </button>
            <button
              onClick={() => navigate(`/businesses/jobs/${job.id}`)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              data-testid={`my-job-view-${job.id}`}
            >
              <ExternalLink size={12} /> View public page
            </button>
            {job.status === 'open' && (
              <>
                {/* "Awarded" and "closed" are different facts, and the
                    model has carried both since jobs shipped. Closing says
                    the job is over; awarding says somebody got it. A
                    poster who had hired could only say the first. */}
                <button
                  onClick={() => patchStatus('awarded')}
                  disabled={mutating}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:opacity-60"
                  data-testid={`my-job-award-${job.id}`}
                >
                  <Award size={12} aria-hidden="true" /> {t('myJobs.markAwarded', 'Mark as awarded')}
                </button>
                <button
                  onClick={() => patchStatus('closed')}
                  disabled={mutating}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  data-testid={`my-job-close-${job.id}`}
                >
                  {t('myJobs.closeJob', 'Close job')}
                </button>
              </>
            )}
            {job.status !== 'open' && (
              <button
                onClick={() => patchStatus('open')}
                disabled={mutating}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:bg-[#0F3A3A] disabled:opacity-60"
                data-testid={`my-job-reopen-${job.id}`}
              >
                <RotateCcw size={12} aria-hidden="true" /> {t('myJobs.reopen', 'Reopen')}
              </button>
            )}
          </div>

          {editing && (
            <EditJobModal
              job={job}
              API={API}
              token={token}
              onClose={() => setEditing(false)}
              onSaved={(updated) => onJobUpdated?.(updated)}
            />
          )}

          {/* Applications list */}
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {job.applications_count} application{job.applications_count === 1 ? '' : 's'}
          </p>
          {loadingApps ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="animate-spin" size={14} /> Loading applicants…
            </div>
          ) : job.applications_count === 0 ? (
            <div className="text-sm text-gray-500 bg-white rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center" data-testid={`my-job-no-apps-${job.id}`}>
              No applications yet. Matching providers were notified by email — usually the first replies come in within a few hours.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 px-3">
              {(applications || []).map((a) => (
                <ApplicationRow
                  key={a.id}
                  app={a}
                  jobId={job.id}
                  onMessage={(app) => navigate(`/chat/${job.id}?with=${app.provider?.user_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MyJobsTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API}/marketplace/my-jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [API, token]);

  useEffect(() => { refresh(); }, [refresh]);

  const onStatusChange = (jobId, nextStatus) => {
    setRows((cur) => cur.map((j) => (j.id === jobId ? { ...j, status: nextStatus } : j)));
  };

  // Merged in place rather than refetching: a refetch collapses every
  // expanded card and throws the reader back to the top of the list,
  // right after they finished editing one of them.
  const onJobUpdated = (updated) => {
    if (!updated || !updated.id) return;
    setRows((cur) => cur.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="my-jobs-tab">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My posted jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Track every job you&apos;ve posted and review who&apos;s applied.
          </p>
        </div>
        <button
          onClick={() => { saveReturnPath(); navigate('/businesses/post-job'); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-semibold hover:bg-[#0F3A3A]"
          data-testid="my-jobs-post-cta"
        >
          <Plus size={14} /> Post a job
        </button>
      </div>

      {rows.length === 0 ? (
        <div
          className="bg-white border border-gray-100 rounded-2xl p-10 text-center"
          data-testid="my-jobs-empty"
        >
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-800 font-semibold mb-1">You haven&apos;t posted any jobs yet.</p>
          <p className="text-sm text-gray-500 mb-5">
            Tell us what you need — matching providers will apply directly.
          </p>
          <button
            onClick={() => { saveReturnPath(); navigate('/businesses/post-job'); }}
            className="inline-flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A]"
            data-testid="my-jobs-empty-cta"
          >
            Post your first job <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="my-jobs-list">
          {rows.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              API={API}
              token={token}
              onStatusChange={onStatusChange}
              onJobUpdated={onJobUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyJobsTab;
