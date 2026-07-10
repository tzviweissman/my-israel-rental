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
import { Loader2, MapPin, Coins, Calendar, Send } from 'lucide-react';

const JobRequestsTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/marketplace/provider/job-matches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [API, token]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1E6A6A]" /></div>;

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center" data-testid="job-requests-empty">
        <p className="text-gray-700 font-semibold mb-1">No open jobs matching your gigs yet.</p>
        <p className="text-sm text-gray-500">
          Whenever a customer posts a job in one of your categories, we&apos;ll email you and show it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="job-requests-list">
      <p className="text-sm text-gray-600 mb-3">
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
            className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 hover:border-[#D4AF37] transition-colors shadow-sm"
            data-testid={`job-request-row-${j.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-gray-900 flex-1">{j.title}</h3>
              {j.already_applied ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">
                  ✓ Applied
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E6A6A]">
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
  );
};

export default JobRequestsTab;
