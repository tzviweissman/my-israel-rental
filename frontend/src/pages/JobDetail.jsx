/**
 * JobDetail — public page for a single posted job.
 *
 * Anyone can view. Signed-in users who are not the poster can Apply
 * (submits a message + optional price quote in-platform). The poster
 * sees a list of every applicant with their message + quote.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Coins, MapPin, Calendar, Send, User } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const JobDetail = () => {
  const { id } = useParams();
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ message: '', quoted_price: '', quoted_currency: 'ILS' });
  const [applying, setApplying] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/marketplace/jobs/${id}`)
      .then((r) => setJob(r.data))
      .catch(() => toast.error('Job not found'))
      .finally(() => setLoading(false));
  }, [id]);

  // Poster-only: fetch full applicant list.
  const isMine = job && user && (job.poster_user_id === user.user_id || job.poster_user_id === user.id);
  useEffect(() => {
    if (!isMine || !token) return;
    axios.get(`${API}/marketplace/jobs/${id}/applications`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => setApplications(r.data)).catch(() => {});
  }, [isMine, id, token]);

  const submitApply = async () => {
    if (applyForm.message.trim().length < 10) {
      return toast.error('Message must be at least 10 characters.');
    }
    setApplying(true);
    try {
      const payload = {
        message: applyForm.message.trim(),
        quoted_price: applyForm.quoted_price ? parseFloat(applyForm.quoted_price) : null,
        quoted_currency: applyForm.quoted_currency,
      };
      await axios.post(`${API}/marketplace/jobs/${id}/apply`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Application sent — the poster has been notified by email.');
      setApplyOpen(false);
      setAlreadyApplied(true);
      setJob((j) => ({ ...j, applications_count: (j?.applications_count || 0) + 1 }));
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to apply';
      if (msg.toLowerCase().includes('already')) setAlreadyApplied(true);
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!job) return null;

  const sym = job.budget_currency === 'USD' ? '$' : '₪';
  const budget = job.budget_type === 'fixed' && job.budget_amount
    ? `${sym}${Number(job.budget_amount).toLocaleString()}`
    : 'Open to offers';

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="job-detail-page">
      <PageMeta title={`${job.title} · MyIsraelRental`} description={(job.description || '').slice(0, 160)} path={`/services/jobs/${id}`} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/services/jobs')} className="text-sm text-gray-500 flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> All jobs
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900" data-testid="job-detail-title">
                {job.title}
              </h1>
              {job.poster?.display_name && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <User size={11} /> Posted by <b className="text-gray-700">{job.poster.display_name}</b>
                  {job.poster.member_since && <span> · member since {job.poster.member_since.slice(0, 4)}</span>}
                </p>
              )}
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {job.status === 'open' ? 'Open' : job.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
            <span className="inline-flex items-center gap-1"><Coins size={14} /> {budget}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={14} /> {job.area}</span>
            {job.preferred_date && <span className="inline-flex items-center gap-1"><Calendar size={14} /> {job.preferred_date}</span>}
          </div>

          <p className="text-gray-700 whitespace-pre-line" data-testid="job-detail-description">{job.description}</p>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              {job.applications_count || 0} {job.applications_count === 1 ? 'applicant' : 'applicants'} so far
            </p>
            {isMine ? (
              <span className="text-xs text-gray-500 italic">You posted this job.</span>
            ) : job.status !== 'open' ? (
              <span className="text-xs text-gray-500 italic">Not accepting applications.</span>
            ) : alreadyApplied ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Applied
              </span>
            ) : (
              <button
                onClick={() => token ? setApplyOpen(true) : navigate('/auth')}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] inline-flex items-center gap-1"
                data-testid="job-apply-btn"
              >
                <Send size={14} /> Apply to this job
              </button>
            )}
          </div>
        </div>

        {isMine && applications.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-3">Applicants ({applications.length})</h2>
            <div className="space-y-3">
              {applications.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm" data-testid={`job-application-${a.id}`}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{a.provider?.display_name}</p>
                    {a.quoted_price && (
                      <p className="text-sm font-bold text-[#1E6A6A]">
                        {a.quoted_currency === 'USD' ? '$' : '₪'}{Number(a.quoted_price).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{a.message}</p>
                  {a.provider?.response_bucket && (
                    <p className="text-[11px] text-emerald-700 mt-2">⚡ Replies in {a.provider.response_bucket}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {applyOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setApplyOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">Apply to this job</h2>
            <p className="text-sm text-gray-600">
              Introduce yourself and explain how you&apos;d handle it. If you know your price, add a quote.
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Message to the poster</label>
              <textarea
                rows={5}
                value={applyForm.message}
                onChange={(e) => setApplyForm({ ...applyForm, message: e.target.value })}
                placeholder="Hi! I'm a moving company based in Tel Aviv and can help with your move on July 20th. My team of 4 handles about 3-4 moves per week, and we've been in business since 2010…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                data-testid="job-apply-message"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Your price quote (optional)</label>
              <div className="flex gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-semibold text-sm">
                    {applyForm.quoted_currency === 'USD' ? '$' : '₪'}
                  </span>
                  <select value={applyForm.quoted_currency} onChange={(e) => setApplyForm({ ...applyForm, quoted_currency: e.target.value })}
                    className="appearance-none pl-7 pr-6 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer">
                    <option value="ILS">ILS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <input type="number" value={applyForm.quoted_price} onChange={(e) => setApplyForm({ ...applyForm, quoted_price: e.target.value })}
                  placeholder="Amount" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  data-testid="job-apply-price" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setApplyOpen(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200">
                Cancel
              </button>
              <button
                onClick={submitApply}
                disabled={applying || applyForm.message.trim().length < 10}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-40 inline-flex items-center justify-center gap-1"
                data-testid="job-apply-submit"
              >
                {applying ? <><Loader2 className="animate-spin" size={14} /> Sending…</> : <>Send application</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
