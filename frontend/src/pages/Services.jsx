/**
 * Services Marketplace hub — Phase 1a MVP.
 *
 * Fiverr-style category grid + gig cards on the left, "How it works"
 * + provider CTA on the right. Filtering (search + category chip)
 * happens in-memory over the initial `/api/marketplace/gigs` fetch
 * to keep the UX snappy without a second round-trip per keystroke.
 *
 * When no gigs exist yet (fresh install), the page still shows the
 * 12 categories and the "Become a provider" CTA so the funnel is
 * intact from day 1.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Truck, Key, Wrench, Camera, Palette, Map, Hammer,
  Scissors, Wind, Droplet, Zap, Search, ArrowRight, Loader2,
} from 'lucide-react';
import { API } from '../App';
import PageMeta from '../components/PageMeta';

const ICON_BY_SLUG = {
  sparkles: Sparkles, truck: Truck, key: Key, wrench: Wrench,
  camera: Camera, palette: Palette, map: Map, hammer: Hammer,
  scissors: Scissors, wind: Wind, droplet: Droplet, zap: Zap,
};

const CategoryTile = ({ slug, label, icon, active, onClick }) => {
  const Icon = ICON_BY_SLUG[icon] || Wrench;
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
        active
          ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
          : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:shadow-sm'
      }`}
      data-testid={`services-category-${slug}`}
    >
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-white/15' : 'bg-[#FAFAF7]'}`}>
        <Icon size={20} className={active ? 'text-white' : 'text-[#1E6A6A]'} />
      </span>
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </button>
  );
};

const GigCard = ({ gig, onClick }) => {
  const cover = gig.gallery?.[0];
  const cheapest = (gig.tiers || []).reduce(
    (acc, t) => (acc == null || t.price < acc ? t.price : acc),
    null,
  );
  const currency = gig.tiers?.[0]?.currency || 'ILS';
  const sym = currency === 'ILS' ? '₪' : '$';
  return (
    <button
      onClick={onClick}
      className="text-left group"
      data-testid={`services-gig-${gig.id}`}
    >
      <div
        className="aspect-square w-full bg-gray-100 rounded-xl overflow-hidden mb-2"
        style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!cover && (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No image
          </div>
        )}
      </div>
      <p className="font-semibold text-sm text-gray-900 truncate">{gig.title}</p>
      <p className="text-xs text-gray-500 truncate">
        {gig.provider?.name}{gig.area ? ` · ${gig.area}` : ''}
      </p>
      {cheapest != null && (
        <p className="text-xs mt-0.5 text-gray-900">
          <span className="text-gray-500">from </span>
          <span className="font-semibold">{sym}{cheapest.toLocaleString()}</span>
        </p>
      )}
    </button>
  );
};

const Services = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data)),
      axios.get(`${API}/marketplace/gigs`).then((r) => setGigs(r.data)),
    ]).catch((e) => {
      console.error(e); toast.error('Failed to load marketplace');
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => gigs.filter((g) => {
    if (selectedCat && g.category !== selectedCat) return false;
    if (q && !(`${g.title} ${g.description}`).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [gigs, selectedCat, q]);

  return (
    <div
      className="min-h-screen bg-[#FAFAF7]"
      style={{ paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="services-page"
    >
      <PageMeta
        title="Services Marketplace in Israel — Cleaners, Movers, Plumbers & more | MyIsraelRental"
        description="Book trusted local services in Israel — cleaning, movers, plumbers, electricians, photographers, barbers, tour guides and more. Zero booking fees, direct chat, WhatsApp-ready."
        path="/services"
      />

      {/* Hero + search */}
      <div className="relative bg-gradient-to-br from-[#1E6A6A] to-[#0F3A3A] text-white py-14 md:py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
            {t('services.heroTitle', 'Find & book trusted local services')}
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto mb-8">
            {t('services.heroSubtitle', 'From apartment cleaners to plumbers, movers to interior designers — everything you need for living and hosting in Israel, in one place.')}
          </p>
          <div className="flex bg-white rounded-full overflow-hidden shadow-lg max-w-xl mx-auto" data-testid="services-search-bar">
            <div className="flex items-center flex-1 ps-4">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('services.searchPlaceholder', 'Search cleaners, movers, plumbers…')}
                className="flex-1 px-3 py-3 text-sm text-gray-800 focus:outline-none"
                data-testid="services-search-input"
              />
            </div>
            <button
              onClick={() => navigate('/dashboard?tab=my-gigs')}
              className="px-5 py-3 bg-[#D4AF37] text-white text-sm font-semibold hover:bg-[#c19f2c] transition-colors"
              data-testid="services-become-provider"
            >
              {t('services.becomeProvider', 'Become a provider')}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('services.browse', 'Browse by category')}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          <button
            onClick={() => setSelectedCat('')}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
              !selectedCat ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
            }`}
            data-testid="services-category-all"
          >
            <span className="text-xs font-semibold">{t('services.all', 'All')}</span>
          </button>
          {categories.map((c) => (
            <CategoryTile
              key={c.slug}
              slug={c.slug}
              label={c.label}
              icon={c.icon}
              active={selectedCat === c.slug}
              onClick={() => setSelectedCat(c.slug === selectedCat ? '' : c.slug)}
            />
          ))}
        </div>
      </div>

      {/* Gigs grid */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {selectedCat
              ? categories.find((c) => c.slug === selectedCat)?.label
              : t('services.allServices', 'All services')}
            <span className="text-sm text-gray-500 font-normal ms-2">({filtered.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold mb-2">
              {t('services.emptyTitle', 'No services listed here yet')}
            </p>
            <p className="text-gray-500 text-sm mb-5">
              {t('services.emptyBody', 'Be the first to list your service in this category — free 30-day trial.')}
            </p>
            <button
              onClick={() => navigate('/dashboard?tab=my-gigs')}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A]"
              data-testid="services-empty-cta"
            >
              {t('services.listYourService', 'List your service')} <ArrowRight size={14} className="inline-block ms-1" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
            {filtered.map((gig) => (
              <GigCard key={gig.id} gig={gig} onClick={() => navigate(`/services/gig/${gig.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;
