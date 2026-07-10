/**
 * JobsBoard — public /services/jobs listing.
 *
 * Anyone can browse. Poster identity is anonymised beyond a display
 * name + member-since year so the board reads more like a job board
 * than a personal ad. Filters: category + area (server-side).
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, MapPin, Coins, Calendar, Plus, MessageSquare, Bell, BellRing } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const JobsBoard = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeCat = params.get('category') || '';
  const activeArea = params.get('area') || '';
  const [savedSearches, setSavedSearches] = useState([]);
  const [savingSearch, setSavingSearch] = useState(false);

  // Refresh the saved-search list any time we mount or the filter
  // context changes — so the toggle button can flip between "Save this
  // search" and "✓ Subscribed".
  const refreshSavedSearches = useCallback(() => {
    if (!token) return;
    axios.get(`${API}/marketplace/job-searches`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => setSavedSearches(r.data)).catch(() => {});
  }, [token]);

  useEffect(() => { refreshSavedSearches(); }, [refreshSavedSearches]);

  const matchedSaved = useMemo(() => {
    if (!activeCat) return null;
    const norm = (activeArea || '').trim().toLowerCase();
    return savedSearches.find((s) => s.category === activeCat
      && ((s.area || '').toLowerCase() === norm)) || null;
  }, [savedSearches, activeCat, activeArea]);

  const toggleSaveSearch = async () => {
    if (!token) { navigate('/auth'); return; }
    if (!activeCat) return;
    setSavingSearch(true);
    try {
      if (matchedSaved) {
        await axios.delete(`${API}/marketplace/job-searches/${matchedSaved.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Search unsaved — per-post pings will resume.');
      } else {
        await axios.post(`${API}/marketplace/job-searches`,
          { category: activeCat, area: activeArea || null },
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Search saved. You\'ll get a daily digest of new matches.');
      }
      refreshSavedSearches();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setSavingSearch(false);
    }
  };

  useEffect(() => {
    axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data));
  }, []);
  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (activeCat) q.set('category', activeCat);
    axios.get(`${API}/marketplace/jobs?${q.toString()}`)
      .then((r) => setJobs(r.data))
      .finally(() => setLoading(false));
  }, [activeCat]);

  const setCat = (slug) => {
    const p = new URLSearchParams(params);
    if (slug) p.set('category', slug); else p.delete('category');
    setParams(p, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="jobs-board-page">
      <PageMeta title="Open jobs · MyIsraelRental" description="Browse jobs posted by renters and owners on MyIsraelRental — apply directly to reach customers." path="/services/jobs" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
              Open jobs
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Real people looking for real work — apply directly, no middleman.
            </p>
          </div>
          <button
            onClick={() => navigate(token ? '/services/post-job' : '/auth')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E6A6A] text-white text-sm font-semibold hover:bg-[#0F3A3A]"
            data-testid="jobs-post-cta"
          >
            <Plus size={14} /> Post a job
          </button>
        </div>

        {/* Save this search — only surface when a category filter is
            active (an empty subscription for "all categories" would be
            spammy). Flips into an unsubscribe pill once saved so the
            provider can toggle it back off without leaving the page. */}
        {activeCat && token && (
          <div className="mb-4 rounded-2xl border border-[#1E6A6A]/15 bg-[#1E6A6A]/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap" data-testid="jobs-save-search-strip">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              {matchedSaved ? <BellRing size={16} className="text-[#1E6A6A]" /> : <Bell size={16} className="text-gray-500" />}
              <span>
                {matchedSaved
                  ? <>You&apos;ll get a <b>daily digest</b> of new matches in this filter.</>
                  : <>Save this search to get a <b>daily email digest</b> instead of one email per post.</>}
              </span>
            </div>
            <button
              onClick={toggleSaveSearch}
              disabled={savingSearch}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                matchedSaved
                  ? 'bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:text-red-600'
                  : 'bg-[#1E6A6A] text-white border-[#1E6A6A] hover:bg-[#0F3A3A]'
              } disabled:opacity-60`}
              data-testid="jobs-save-search-btn"
            >
              {savingSearch ? '…' : matchedSaved ? 'Unsubscribe' : 'Save this search'}
            </button>
          </div>
        )}

        {/* Category strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          <button
            onClick={() => setCat('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
              !activeCat ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
            }`}
            data-testid="jobs-cat-all"
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
                activeCat === c.slug ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
              }`}
              data-testid={`jobs-cat-${c.slug}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1E6A6A]" /></div>
        ) : jobs.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-semibold mb-1">No open jobs in this category right now.</p>
            <p className="text-gray-500 text-sm mb-5">Be the first to post — matching providers will reach out.</p>
            <button
              onClick={() => navigate(token ? '/services/post-job' : '/auth')}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A]"
              data-testid="jobs-empty-cta"
            >
              Post a job
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map((j) => <JobRow key={j.id} job={j} onClick={() => navigate(`/services/jobs/${j.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const JobRow = ({ job, onClick }) => {
  const sym = job.budget_currency === 'USD' ? '$' : '₪';
  const budget = job.budget_type === 'fixed' && job.budget_amount
    ? `${sym}${Number(job.budget_amount).toLocaleString()}`
    : 'Open to offers';
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 hover:border-[#D4AF37] transition-colors shadow-sm"
      data-testid={`jobs-row-${job.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 flex-1">{job.title}</h3>
        <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(job.created_at)}</span>
      </div>
      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{job.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1"><Coins size={12} /> {budget}</span>
        <span className="inline-flex items-center gap-1"><MapPin size={12} /> {job.area}</span>
        {job.preferred_date && (
          <span className="inline-flex items-center gap-1"><Calendar size={12} /> {job.preferred_date}</span>
        )}
      </div>
    </button>
  );
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default JobsBoard;
