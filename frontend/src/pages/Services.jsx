/**
 * Services page — monetization placeholder.
 *
 * The user's vision: businesses (cleaners, locksmiths, photographers,
 * key handoff services, etc.) pay a monthly subscription to be featured
 * on MyIsraelRental. This page is the renter-facing discovery surface +
 * the business-facing "get listed" CTA.
 *
 * For this iteration the page ships as a marketing landing with an
 * email-capture form. The actual subscription billing + business-profile
 * CRUD is deferred (a whole separate flow involving Stripe Subscriptions
 * + a business dashboard). Captured emails go into a Mongo waitlist
 * collection so the user can reach out the moment that infra lands.
 *
 * Already-active businesses (once the full flow ships) would render
 * below the hero as a category-grouped grid; for now we just preview
 * the categories as a teaser so renters see the value prop.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Briefcase, Sparkles, Camera, Key, Wrench, Car, Brush, Loader2, Mail, CheckCircle } from 'lucide-react';
import PageMeta from '../components/PageMeta';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = [
  { icon: Brush, name: 'Cleaning', desc: 'Pre-checkin / turnover cleans' },
  { icon: Key, name: 'Key handoff', desc: 'Greet guests, hand over keys' },
  { icon: Camera, name: 'Photography', desc: 'Listing-quality apartment shoots' },
  { icon: Wrench, name: 'Maintenance', desc: 'Plumbers, electricians, handymen' },
  { icon: Car, name: 'Airport pickup', desc: 'Door-to-door for arriving guests' },
  { icon: Sparkles, name: 'Concierge', desc: 'Tours, reservations, custom requests' },
];

const Services = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !businessName.trim()) {
      toast.error('Business name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/services/waitlist`, {
        email: email.trim(),
        business_name: businessName.trim(),
        category: category || null,
      });
      setSubmitted(true);
      toast.success("You're on the list! We'll reach out as soon as bookings open.");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong, please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#FAFAF7]"
      style={{ paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="services-page"
    >
      <PageMeta
        title="Local services for hosts & guests in Israel | MyIsraelRental Services"
        description="Trusted local services for Israeli rentals — cleaning, key handoff, photography, maintenance, airport pickup and concierge. List your business on MyIsraelRental."
        path="/services"
      />
      {/* Hero */}
      <div className="relative py-16 md:py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E6A6A] to-[#0F3A3A]" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #D4AF37 0%, transparent 40%)' }} />
        <div className="relative max-w-3xl mx-auto text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#D4AF37]/20 mb-6">
            <Briefcase size={32} className="text-[#D4AF37]" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
            Local services for hosts &amp; guests
          </h1>
          <p className="text-base md:text-lg text-white/80 leading-relaxed max-w-2xl mx-auto">
            Cleaners, photographers, key handoff, concierge — every service a short-term host or long-term renter needs,
            from vetted Israeli businesses. Coming soon.
          </p>
        </div>
      </div>

      {/* Categories teaser */}
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center" style={{ fontFamily: 'Playfair Display' }}>
          What you&apos;ll find here
        </h2>
        <p className="text-gray-500 text-center mb-10">A preview of the service categories we&apos;re onboarding right now.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map(({ icon: Icon, name, desc }) => (
            <div
              key={name}
              className="bg-white rounded-xl border border-[#E5E5E5] p-5 hover:border-[#D4AF37] hover:shadow-md transition-all"
              data-testid={`services-category-${name.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div className="w-10 h-10 rounded-lg bg-[#1E6A6A] flex items-center justify-center mb-3">
                <Icon size={20} className="text-[#D4AF37]" />
              </div>
              <p className="font-bold text-sm mb-0.5">{name}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Get-listed CTA — captures interest from local businesses */}
      <div className="max-w-3xl mx-auto px-4 pb-16 md:pb-24">
        <div className="bg-white rounded-2xl shadow-xl border border-[#E5E5E5] p-8 md:p-10">
          <div className="text-center mb-6">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#D4AF37] mb-2">For local businesses</p>
            <h3 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
              Get listed on MyIsraelRental
            </h3>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              We charge a small monthly subscription so featured businesses get full visibility to thousands of Israeli renters
              and short-term hosts. No commission on jobs — flat fee, transparent pricing.
            </p>
          </div>
          {submitted ? (
            <div className="flex flex-col items-center text-center py-6" data-testid="services-waitlist-success">
              <CheckCircle size={40} className="text-green-500 mb-3" />
              <p className="font-bold text-gray-900 mb-1">You&apos;re on the list 🎉</p>
              <p className="text-sm text-gray-600 max-w-md">
                We&apos;ll reach out the moment subscriptions open. In the meantime, feel free to keep building your business profile —
                we&apos;ll prioritize early signups in the first wave.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3" data-testid="services-waitlist-form">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business name"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="services-waitlist-business"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37] bg-white"
                  data-testid="services-waitlist-category"
                >
                  <option value="">Service category</option>
                  {CATEGORIES.map(({ name }) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contact email"
                  className="px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                  data-testid="services-waitlist-email"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1E6A6A' }}
                data-testid="services-waitlist-submit"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                {submitting ? 'Submitting…' : 'Notify me when subscriptions open'}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-2">
                We&apos;ll only use your email to let you know when the marketplace launches.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Services;
