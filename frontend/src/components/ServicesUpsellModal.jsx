import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Target, Trophy, Megaphone, Gift, DollarSign, Inbox, LineChart, Shield,
} from 'lucide-react';
import { API, AuthContext } from '../App';

/**
 * One-time services marketplace upsell shown to every user on their next
 * login (existing accounts) or right after signup (new accounts). Accept
 * → 30-day $0 provider trial is provisioned via
 * POST /api/user/services-pitch/action. Dismiss just records that they've
 * seen it so we don't show it again.
 *
 * Rendered by App.js when `user && !user.services_pitch_seen_at`.
 */
const BENEFITS = [
  { Icon: Target, title: 'Massive Targeted Exposure', body: 'Shown to thousands of clients actively looking for rentals, movers, cleaners, handymen, interior designers, property managers and more every month.' },
  { Icon: Trophy, title: 'Professional Service Page', body: 'A dedicated page with high-quality photos, detailed description, reviews and direct contact — designed to look premium and convert.' },
  { Icon: Megaphone, title: 'Built-in Advertising', body: 'We promote you across the homepage, search results, popular listings and email newsletters — consistent visibility, no extra effort.' },
  { Icon: Gift, title: 'First Month Completely Free', body: 'Test the platform risk-free. No payment required upfront.' },
  { Icon: DollarSign, title: 'Affordable Growth', body: 'Only $25 / month after the free trial — one of the lowest rates for this level of targeted exposure in Israel.' },
  { Icon: Inbox, title: 'Direct High-Quality Leads', body: 'Inquiries from serious clients who already trust the MyIsraelRental platform.' },
  { Icon: LineChart, title: 'Easy Management', body: 'A simple dashboard to update availability, pricing, photos, and respond to leads quickly.' },
  { Icon: Shield, title: 'Proven Platform Trust', body: 'Leverage our established reputation in the Israel rental community for instant credibility.' },
];

const ServicesUpsellModal = ({ onDone }) => {
  const { token, user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const submit = async (accepted) => {
    setBusy(true);
    try {
      await axios.post(
        `${API}/user/services-pitch/action`,
        { accepted },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Refresh the local user state so App stops rendering the modal
      // and so any downstream trial-based gates immediately unlock.
      try {
        const me = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        login(token, me.data);
      } catch { /* non-fatal */ }
      if (accepted) {
        toast.success('Your 30-day free provider trial is active — set up your service page next.');
        navigate('/dashboard?tab=my-gigs');
      }
      onDone?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="services-upsell-title"
      data-testid="services-upsell-modal"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-[#E5E5E5] shadow-2xl bg-[#FAFAF7]">
        <button
          onClick={() => submit(false)}
          disabled={busy}
          className="absolute top-4 end-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-800 shadow"
          aria-label="Close"
          data-testid="services-upsell-close"
        >
          <X size={16} />
        </button>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-t-3xl px-8 pt-8 pb-7 text-white" style={{ background: 'linear-gradient(135deg,#1E6A6A 0%,#164a4a 100%)' }}>
          <div
            aria-hidden="true"
            className="absolute -top-10 end-[-40px] w-40 h-40 rounded-full"
            style={{ background: 'rgba(212,175,55,0.15)' }}
          />
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3"
            style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}
          >
            Grow your service business
          </span>
          <h2
            id="services-upsell-title"
            className="text-3xl sm:text-4xl leading-tight max-w-lg"
            style={{ fontFamily: 'Playfair Display' }}
          >
            Take Your Services to the Next Level with MyIsraelRental
          </h2>
          <p className="mt-3 text-sm text-white/85 max-w-xl leading-relaxed">
            We don't just list your service — we actively help you grow your client base in Israel's competitive market.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="px-8 pt-6 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Here's exactly how we help you succeed
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
            {BENEFITS.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-3 text-[12.5px] leading-snug">
                <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(30,106,106,0.1)', color: '#1E6A6A' }}>
                  <Icon size={16} />
                </span>
                <span>
                  <strong className="block text-gray-900 text-[13px] mb-0.5">{title}</strong>
                  <span className="text-gray-600">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA row */}
        <div className="px-8 pb-6 pt-2 flex flex-wrap justify-end items-center gap-3">
          <button
            onClick={() => submit(false)}
            disabled={busy}
            className="text-gray-500 hover:text-gray-800 font-semibold text-xs px-3 py-2 disabled:opacity-50"
            data-testid="services-upsell-dismiss"
          >
            Maybe later
          </button>
          <button
            onClick={() => submit(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-extrabold text-[13px] transition-all hover:shadow-lg disabled:opacity-60"
            style={{ background: '#D4AF37', color: '#1E6A6A', boxShadow: '0 6px 20px -8px rgba(212,175,55,0.6)' }}
            data-testid="services-upsell-accept"
          >
            {busy ? 'Setting up…' : 'Start my free month →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServicesUpsellModal;
