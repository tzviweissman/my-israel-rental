/**
 * JobRequestsTab — provider dashboard panel.
 *
 * Lists every open job whose category matches at least one of the
 * provider's published gigs. Providers see which they've already
 * applied to (so the CTA flips to "Applied"). Clicking any card
 * navigates to the public job detail page where they can send an
 * application.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, MapPin, Coins, Calendar, Send, BellRing, X } from 'lucide-react';

const JobRequestsTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedSearches, setSavedSearches] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/marketplace/provider/job-matches`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data).catch(() => []),
      axios.get(`${API}/marketplace/job-searches`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data).catch(() => []),
    ]).then(([m, s]) => {
      setRows(m);
      setSavedSearches(s);
    }).finally(() => setLoading(false));
  }, [API, token]);

  const removeSaved = async (id) => {
    try {
      await axios.delete(`${API}/marketplace/job-searches/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedSearches((cur) => cur.filter((s) => s.id !== id));
      toast.success('Saved search removed.');
    } catch {
      toast.error('Could not remove');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--brand-primary)]" /></div>;

  return (
    <div className="space-y-6">
      {savedSearches.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm" data-testid="job-saved-searches">
          <div className="flex items-center gap-2 mb-3">
            <BellRing size={16} className="text-[var(--brand-primary)]" />
            <h3 className="text-sm font-bold text-gray-900">Your saved searches</h3>
            <span className="text-[11px] text-gray-500">daily digest</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 text-[var(--brand-primary)] border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20"
                data-testid={`job-saved-search-${s.id}`}
              >
                {s.category}{s.area ? ` · ${s.area}` : ''}
                <button
                  onClick={() => removeSaved(s.id)}
                  className="rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-500 hover:text-white transition"
                  aria-label="Remove saved search"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center" data-testid="job-requests-empty">
          <p className="text-gray-700 font-semibold mb-1">No open jobs matching your gigs yet.</p>
          <p className="text-sm text-gray-500">
            Whenever a customer posts a job in one of your categories, we&apos;ll email you and show it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="job-requests-list">
          <p className="text-sm text-gray-600">
            {rows.length} open job{rows.length === 1 ? '' : 's'} in your categories. Apply directly — no middleman.
          </p>
          {rows.map((j) => {
            const sym = j.budget_currency === 'USD' ? '$' : '₪';
            const budget = j.budget_type === 'fixed' && j.budget_amount
              ? `${sym}${Number(j.budget_amount).toLocaleString()}`
              : 'Open to offers';
            return (
              <button
                key={j.id}
                onClick={() => navigate(`/services/jobs/${j.id}`)}
                className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 hover:border-[var(--gold)] transition-colors shadow-sm"
                data-testid={`job-request-row-${j.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-gray-900 flex-1">{j.title}</h3>
                  {j.already_applied ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">
                      ✓ Applied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-primary)]">
                      <Send size={11} /> Apply
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{j.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1"><Coins size={12} /> {budget}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={12} /> {j.area}</span>
                  {j.preferred_date && (
                    <span className="inline-flex items-center gap-1"><Calendar size={12} /> {j.preferred_date}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JobRequestsTab;
