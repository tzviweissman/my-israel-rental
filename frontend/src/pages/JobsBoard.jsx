/**
 * JobsBoard — public /businesses/jobs listing.
 *
 * Anyone can browse. Poster identity is anonymised beyond a display
 * name + member-since year so the board reads more like a job board
 * than a personal ad. Filters: category + area (server-side).
 *
 * Every string here was hardcoded English until 28 Aug 2026 — the whole
 * page, including the toasts and the empty state. A Hebrew visitor got
 * an English page, which is the thing Tzvi called out: an Israeli reading
 * it would be turned off.
 *
 * Two details worth keeping:
 *
 * The relative times use i18next plurals with `count`, so Hebrew gets its
 * DUAL — "לפני שעתיים", not "לפני 2 שעות". A literal translation of the
 * English gets this wrong every time, and it is one of the tells that a
 * page was written in English first.
 *
 * The heading reads `var(--font-head)`, never the literal face. Playfair
 * has no Hebrew glyphs, and an inline `fontFamily: 'var(--font-head)'`
 * beats the RTL stylesheet — so the Hebrew heading silently fell back to
 * a system serif. That was the state here.
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupCategories, flattenGrouped } from '../lib/categoryGroups';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, MapPin, Coins, Calendar, Plus, MessageSquare, Bell, BellRing } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import { saveReturnPath } from '../hooks/useBackNavigation';

const JobsBoard = () => {
  const { t, i18n } = useTranslation();
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const orderedCategories = useMemo(
    () => flattenGrouped(groupCategories(categories, t)),
    [categories, t],
  );
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
        toast.success(t('jobsBoard.unsaved', "Search unsaved — you'll go back to one email per post."));
      } else {
        await axios.post(`${API}/marketplace/job-searches`,
          { category: activeCat, area: activeArea || null },
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success(t('jobsBoard.saved', "Search saved. You'll get a daily digest of new matches."));
      }
      refreshSavedSearches();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('jobsBoard.error', 'Something went wrong'));
    } finally {
      setSavingSearch(false);
    }
  };

  useEffect(() => {
    axios.get(`${API}/marketplace/categories`)
      .then((r) => setCategories(r.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (activeCat) q.set('category', activeCat);
    axios.get(`${API}/marketplace/jobs?${q.toString()}`)
      .then((r) => setJobs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCat]);

  const setCat = (slug) => {
    const p = new URLSearchParams(params);
    if (slug) p.set('category', slug); else p.delete('category');
    setParams(p, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="jobs-board-page">
      <PageMeta
        title={t('jobsBoard.metaTitle', 'Open jobs · MyIsraelRental')}
        description={t('jobsBoard.metaDescription', 'Browse jobs posted by renters and owners on MyIsraelRental — apply directly to reach customers.')}
        path="/businesses/jobs"
      />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>
              {t('jobsBoard.title', 'Open jobs')}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('jobsBoard.subtitle', 'Real people looking for real work — apply directly, no middleman.')}
            </p>
          </div>
          <button
            onClick={() => { saveReturnPath(); navigate(token ? '/businesses/post-job' : '/auth'); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-semibold hover:bg-[#0F3A3A]"
            data-testid="jobs-post-cta"
          >
            <Plus size={14} /> {t('jobsBoard.post', 'Post a job')}
          </button>
        </div>

        {/* Save this search — only surface when a category filter is
            active (an empty subscription for "all categories" would be
            spammy). Flips into an unsubscribe pill once saved so the
            provider can toggle it back off without leaving the page. */}
        {activeCat && token && (
          <div className="mb-4 rounded-2xl border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/15 bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap" data-testid="jobs-save-search-strip">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              {matchedSaved ? <BellRing size={16} className="text-[var(--brand-primary)]" /> : <Bell size={16} className="text-gray-500" />}
              {/* Bold LEAD, not a bold phrase mid-sentence. The codebase
                  has no <Trans> idiom, and splitting a sentence around a
                  tag forces the Hebrew into English word order — which is
                  exactly the tell this page is being fixed for. */}
              <span>
                <b>{t('jobsBoard.digestLabel', 'Daily digest')}</b>
                {' — '}
                {matchedSaved
                  ? t('jobsBoard.digestOn', "you'll get one email a day with new matches in this filter.")
                  : t('jobsBoard.digestOff', 'save this search and get one email a day instead of one per post.')}
              </span>
            </div>
            <button
              onClick={toggleSaveSearch}
              disabled={savingSearch}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                matchedSaved
                  ? 'bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:text-red-600'
                  : 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] hover:bg-[#0F3A3A]'
              } disabled:opacity-60`}
              data-testid="jobs-save-search-btn"
            >
              {savingSearch
                ? '…'
                : matchedSaved
                  ? t('jobsBoard.unsubscribe', 'Unsubscribe')
                  : t('jobsBoard.save', 'Save this search')}
            </button>
          </div>
        )}

        {/* Category strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          <button
            onClick={() => setCat('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
              !activeCat ? 'bg-black text-[var(--gold)] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
            }`}
            data-testid="jobs-cat-all"
          >
            {t('jobsBoard.allCategories', 'All categories')}
          </button>
          {/* Grouped ORDER, not grouped headings (spec N2). A row that
              scrolls sideways has nowhere to put a heading, but it can
              still put related categories next to each other instead of
              in whatever order the API returned. */}
          {orderedCategories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
                activeCat === c.slug ? 'bg-black text-[var(--gold)] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
              }`}
              data-testid={`jobs-cat-${c.slug}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--brand-primary)]" /></div>
        ) : jobs.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-semibold mb-1">
              {t('jobsBoard.emptyTitle', 'No open jobs in this category right now.')}
            </p>
            <p className="text-gray-500 text-sm mb-5">
              {t('jobsBoard.emptyBody', 'Be the first to post — matching providers will reach out.')}
            </p>
            <button
              onClick={() => { saveReturnPath(); navigate(token ? '/businesses/post-job' : '/auth'); }}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A]"
              data-testid="jobs-empty-cta"
            >
              {t('jobsBoard.post', 'Post a job')}
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map((j) => (
              <JobRow
                key={j.id}
                job={j}
                t={t}
                locale={i18n.language}
                onClick={() => { saveReturnPath(); navigate(`/businesses/jobs/${j.id}`); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const JobRow = ({ job, onClick, t, locale }) => {
  const sym = job.budget_currency === 'USD' ? '$' : '₪';
  const budget = job.budget_type === 'fixed' && job.budget_amount
    ? `${sym}${Number(job.budget_amount).toLocaleString(locale)}`
    : t('jobsBoard.openToOffers', 'Open to offers');
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 hover:border-[var(--gold)] transition-colors shadow-sm"
      data-testid={`jobs-row-${job.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* dir="auto" on both: a job is posted in Hebrew or English and
            the board shows them side by side, so the direction has to
            follow the text rather than the page. */}
        <h3 className="text-base sm:text-lg font-bold text-gray-900 flex-1" dir="auto">{job.title}</h3>
        <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(job.created_at, t, locale)}</span>
      </div>
      <p className="text-sm text-gray-600 mt-1 line-clamp-2" dir="auto">{job.description}</p>
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

/**
 * "3h ago" / "לפני שעתיים".
 *
 * Minute-and-hour granularity, which is why this is not
 * `utils/listedAgo.js` — that one buckets by DAY for property cards,
 * where "posted this morning" is not the point. On a jobs board it is:
 * a provider deciding whether it is worth applying wants to know if
 * twenty others already have.
 *
 * Counts go through i18next as `count`, not interpolated into a
 * sentence, so Hebrew gets its dual — "לפני שעתיים" rather than the
 * "לפני 2 שעות" that a direct translation of the English produces. The
 * plural categories for Hebrew are one/two/other; English collapses to
 * one/other and the extra key is simply unused.
 */
const timeAgo = (iso, t, locale) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t('jobsBoard.ago.justNow', 'just now');
  if (mins < 60) return t('jobsBoard.ago.minutes', { count: mins, defaultValue_one: '1 min ago', defaultValue_other: '{{count}} min ago' });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('jobsBoard.ago.hours', { count: hrs, defaultValue_one: '1h ago', defaultValue_other: '{{count}}h ago' });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('jobsBoard.ago.days', { count: days, defaultValue_one: '1d ago', defaultValue_other: '{{count}}d ago' });
  // Past a week the exact date is more use than a growing count, and it
  // follows the APP's language rather than the browser's — those differ
  // for anyone who set the site to Hebrew on an English machine.
  return new Date(iso).toLocaleDateString(locale || undefined, { month: 'short', day: 'numeric' });
};

export default JobsBoard;
