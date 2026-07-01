/**
 * MyGigsTab — provider hub for the Services Marketplace.
 *
 * Surfaces the provider's current gigs, subscription/trial state, and
 * a primary CTA to create a new gig. The Upgrade button hits the
 * `/subscription/upgrade` endpoint (Phase 1a: just flips the flag —
 * real Stripe/PayPal billing lands in Phase 1b).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Loader2, ExternalLink, Trash2, BadgeCheck, Clock, Sparkles,
} from 'lucide-react';

const StatusPill = ({ provider }) => {
  if (provider.subscription_status === 'active') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold"
        data-testid="my-gigs-status-active"
      >
        <BadgeCheck size={12} /> Pro — active
      </span>
    );
  }
  if (provider.active) {
    const daysLeft = provider.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(provider.trial_ends_at) - new Date()) / 86400000))
      : null;
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold"
        data-testid="my-gigs-status-trial"
      >
        <Clock size={12} /> Free trial{daysLeft != null ? ` — ${daysLeft} days left` : ''}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold"
      data-testid="my-gigs-status-expired"
    >
      Trial expired
    </span>
  );
};

const MyGigsTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState([]);
  const [provider, setProvider] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/marketplace/my-gigs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGigs(res.data.gigs || []);
      setProvider(res.data.provider || null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load your gigs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deleteGig = async (id) => {
    if (!window.confirm('Delete this gig? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/marketplace/gigs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Gig deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const upgrade = async () => {
    setUpgrading(true);
    try {
      await axios.post(`${API}/marketplace/subscription/upgrade`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Upgraded to Pro — active for 30 days');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" data-testid="my-gigs-loading">
        <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="my-gigs-tab">
      {/* Header row: status + primary CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-gray-900">Your services</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {provider && <StatusPill provider={provider} />}
            <span className="text-xs text-gray-500">
              {gigs.length} {gigs.length === 1 ? 'gig' : 'gigs'} listed
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {provider && provider.subscription_status !== 'active' && (
            <button
              onClick={upgrade}
              disabled={upgrading}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#D4AF37] hover:bg-[#c19f2c] flex items-center gap-1.5 disabled:opacity-60"
              data-testid="my-gigs-upgrade-btn"
            >
              {upgrading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              Upgrade to Pro
            </button>
          )}
          <button
            onClick={() => navigate('/services/create-gig')}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] flex items-center gap-1.5"
            data-testid="my-gigs-create-btn"
          >
            <Plus size={14} /> Create new gig
          </button>
        </div>
      </div>

      {gigs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center" data-testid="my-gigs-empty">
          <p className="text-gray-700 font-semibold mb-2">You haven&apos;t listed a service yet</p>
          <p className="text-gray-500 text-sm mb-5">
            Publish your first gig — a free 30-day trial starts on your first listing.
          </p>
          <button
            onClick={() => navigate('/services/create-gig')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] inline-flex items-center gap-1.5"
            data-testid="my-gigs-empty-cta"
          >
            <Plus size={14} /> Create your first gig
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gigs.map((g) => {
            const cover = g.gallery?.[0];
            const cheap = (g.tiers || []).reduce(
              (a, t) => (a == null || t.price < a ? t.price : a),
              null,
            );
            const sym = g.tiers?.[0]?.currency === 'USD' ? '$' : '₪';
            return (
              <div
                key={g.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`my-gigs-item-${g.id}`}
              >
                <button
                  onClick={() => navigate(`/services/gig/${g.id}`)}
                  className="block w-full aspect-video bg-gray-100 text-left"
                  style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                >
                  {!cover && (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      No image
                    </div>
                  )}
                </button>
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">{g.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {g.category}{g.area ? ` · ${g.area}` : ''}
                  </p>
                  {cheap != null && (
                    <p className="text-xs text-gray-900">
                      <span className="text-gray-500">from </span>
                      <span className="font-semibold">{sym}{cheap.toLocaleString()}</span>
                    </p>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/services/gig/${g.id}`)}
                      className="text-xs font-semibold text-[#1E6A6A] hover:underline flex items-center gap-1"
                      data-testid={`my-gigs-view-${g.id}`}
                    >
                      View <ExternalLink size={11} />
                    </button>
                    <button
                      onClick={() => deleteGig(g.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      data-testid={`my-gigs-delete-${g.id}`}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyGigsTab;
