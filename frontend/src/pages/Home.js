import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { API } from '../App';
import { Search, Bed, Bath, Home as HomeIcon, MapPin, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import HeroSlideshow from '../components/HeroSlideshow';
import DefaultImageBadge from '../components/property/DefaultImageBadge';
import VideoCoverBadge from '../components/property/VideoCoverBadge';
import WhenPicker from '../components/search/WhenPicker';
import WherePicker from '../components/search/WherePicker';
import { getCoverImage } from '../utils/coverImage';
import { sizedImage } from '../utils/cdnImage';

// Hero background rotation. Keep widths consistent so the cross-fade is
// imperceptible at the image edges (browser caches the second slide while
// the first is showing).
const HERO_IMAGES = [
  // Tel Aviv coastline at sunset (original hero)
  'https://images.unsplash.com/photo-1547483036-24bc77c79804?auto=format&fit=crop&w=1920&q=80',
  // Kotel + Dome of the Rock — wide majestic view, golden hour
  'https://images.pexels.com/photos/2087387/pexels-photo-2087387.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80',
  // Haifa coastline aerial — Mediterranean + Mount Carmel, sunny day
  'https://images.pexels.com/photos/27638436/pexels-photo-27638436.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80',
  // Modern open-plan apartment living + kitchen with urban skyline view
  'https://images.pexels.com/photos/32178051/pexels-photo-32178051.png?auto=compress&cs=tinysrgb&w=1920&q=80',
];

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollerRef = useRef(null);
  // Track which scroll directions are still possible so we can dim/hide
  // the "Scroll" pills when the user has reached either end.
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    fetchFeaturedProperties();
  }, []);

  const fetchFeaturedProperties = async () => {
    try {
      // The backend stamps `is_featured` on every property based on
      // site_settings.featured_property_ids — surface every admin-curated
      // pick, and only top up with recent non-featured listings when
      // the admin has selected fewer than the minimum (so the strip
      // never looks empty on a fresh install).
      const response = await axios.get(`${API}/properties`);
      const all = response.data || [];
      const featured = all.filter((p) => p.is_featured);
      const others = all.filter((p) => !p.is_featured);
      const MIN_FILLER = 6; // top up when there's almost nothing featured
      const combined =
        featured.length >= MIN_FILLER
          ? featured
          : [...featured, ...others.slice(0, MIN_FILLER - featured.length)];
      setFeaturedProperties(combined);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  // Where + When — power the new home search bar. Tapping the search
  // button passes them as URL params to /stays so the listing page
  // hydrates with the same filters the user just typed.
  const [whereArea, setWhereArea] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');

  const [areaOptions, setAreaOptions] = useState([]);
  useEffect(() => {
    // Populate the area dropdown from real listings — never show an
    // option the renter can't actually click through to.
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/properties`, { params: { limit: 1000 } })
      .then((r) => {
        const set = new Set();
        (r.data || []).forEach((p) => {
          if (p.area && p.rental_type !== 'storage') set.add(p.area);
        });
        setAreaOptions(Array.from(set).sort());
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    const qs = new URLSearchParams();
    if (whereArea) qs.set('area', whereArea);
    if (checkin) qs.set('checkin', checkin);
    if (checkout) qs.set('checkout', checkout);
    if (searchQuery.trim()) qs.set('q', searchQuery.trim());
    navigate(`/stays?${qs.toString()}`);
  };

  // Scroller helpers — used by the desktop "Scroll" pills. Mobile users can
  // just swipe; we hide the pills below md.
  const scrollByCards = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    // One screenful at a time feels more useful than 1 card; falls back to
    // the container width so it adapts to whatever card size is in effect.
    const distance = el.clientWidth * 0.9 * (direction === 'left' ? -1 : 1);
    el.scrollBy({ left: distance, behavior: 'smooth' });
  };

  // Recalculate which directions are scrollable whenever the user scrolls,
  // the strip is resized, or the property list changes. Using a small
  // tolerance (4px) avoids flicker at the exact edge.
  const updateScrollEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener('scroll', updateScrollEdges, { passive: true });
    window.addEventListener('resize', updateScrollEdges);
    return () => {
      el.removeEventListener('scroll', updateScrollEdges);
      window.removeEventListener('resize', updateScrollEdges);
    };
  }, [featuredProperties]);

  return (
    <div className="min-h-screen">
      {/* Search bar — pinned directly under the Stays/Services pills in the
          nav (per user request). Frosted-glass band that overlays the very
          top of the slideshow so the 3-segment pill is the first thing a
          renter sees AFTER the category pills. The slideshow image continues
          to fill the hero behind it.

          Top padding clears the global Navigation which is ~157px on
          mobile (logo + Stays/Services tab strip), ~190px on sm screens
          (taller logo), and ~200px on md+ (largest logo, no tab strip).
          Without this clearance the white pill visibly covers the
          Stays/Services icons in the nav above. */}
      <div
        className="relative z-20 pt-[170px] sm:pt-[200px] md:pt-[210px] pb-4 px-4 backdrop-blur-md border-b border-white/10"
        style={{ background: 'linear-gradient(180deg, rgba(15,58,58,0.85) 0%, rgba(15,58,58,0.55) 60%, rgba(15,58,58,0) 100%)' }}
        data-testid="home-search-band"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-stretch gap-2" data-testid="hero-search-bar">
            <div className="flex-1 flex items-stretch bg-white rounded-full shadow-lg">
              {/* Where — typeable text input with area suggestions.
                  Note: the parent wrapper deliberately omits
                  `overflow-hidden` so the suggestion dropdown can extend
                  below the pill. The rounded children clip themselves. */}
              <div className="flex-1 min-w-0 rounded-l-full overflow-visible">
                <WherePicker
                  value={whereArea}
                  onChange={setWhereArea}
                  options={areaOptions}
                  testidPrefix="hero-where"
                />
              </div>
              <div className="w-px bg-gray-200 my-2" />
              {/* When — single segment opening a range calendar popover.
                  Replaces the previous two native date inputs so the bar
                  matches the Airbnb-style screenshot the user shared. */}
              <div className="flex-1 min-w-0">
                <WhenPicker
                  checkin={checkin}
                  checkout={checkout}
                  onChange={({ checkin: ci, checkout: co }) => {
                    setCheckin(ci);
                    setCheckout(co);
                  }}
                  testidPrefix="hero-when"
                />
              </div>
            </div>
            <button
              onClick={handleSearch}
              className="primary-btn flex flex-shrink-0 items-center justify-center gap-1.5 sm:gap-2 px-5 sm:px-7 py-3 sm:py-4 text-sm sm:text-base rounded-full shadow-lg"
              style={{ color: '#FFFFFF' }}
              data-testid="hero-search-button"
            >
              <Search size={18} className="flex-shrink-0" />
              <span className="hidden sm:inline">{t('hero.search')}</span>
            </button>
          </div>
        </div>
      </div>

      <HeroSlideshow
        images={HERO_IMAGES}
        holdMs={6000}
        fadeMs={1500}
        className="h-[560px] flex items-center justify-center -mt-[140px]"
      >
        <div data-testid="hero-section" className="h-full flex items-center justify-center">
          <div className="relative z-10 text-center text-white px-6 max-w-4xl mt-32 sm:mt-28 md:mt-20">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-2" style={{ fontFamily: 'Playfair Display', color: 'white' }}>
              {t('hero.title')}
            </h1>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8" style={{ fontFamily: 'Playfair Display', color: '#D4AF37' }}>
              {t('hero.anyDuration')}
            </p>

            {/* No-fees badge stays in the hero, but the search bar moved
                up into its own band directly under the Stays/Services
                pills (per user request, matches Airbnb screenshot). */}
            <div className="flex flex-col items-center" data-testid="no-fees-badge">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md border"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: 'rgba(212, 175, 55, 0.55)',
                }}
              >
                <Check size={14} strokeWidth={3} style={{ color: '#D4AF37' }} />
                <span
                  className="text-xs sm:text-sm font-semibold uppercase tracking-wider"
                  style={{ color: '#D4AF37', letterSpacing: '0.12em' }}
                >
                  {t('hero.noFeesTagline')}
                </span>
              </div>
              <p
                className="mt-2 text-xs sm:text-sm text-white/85"
                style={{ fontWeight: 400 }}
              >
                {t('hero.noFeesDetail')}
              </p>
            </div>
          </div>
        </div>
      </HeroSlideshow>

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Title row — on desktop we anchor labeled "Scroll" pills to the
            right of the title so users immediately see how to advance the
            carousel. Mobile users swipe, so the pills stay hidden. */}
        <div className="flex items-center justify-between mb-8 md:mb-10 gap-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center md:text-left flex-1 md:flex-none" style={{ fontFamily: 'Playfair Display' }}>
            {t('home.featuredProperties')}
          </h2>
          <div className="hidden md:flex items-center gap-2" data-testid="featured-scroll-controls">
            <button
              type="button"
              onClick={() => scrollByCards('left')}
              disabled={!canScrollLeft}
              aria-label={t('home.scrollToPrevAria')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md"
              style={{ borderColor: '#1E6A6A', color: '#1E6A6A', backgroundColor: 'white' }}
              data-testid="featured-scroll-left"
            >
              <ArrowLeft size={16} />
              <span>{t('home.previous')}</span>
            </button>
            <button
              type="button"
              onClick={() => scrollByCards('right')}
              disabled={!canScrollRight}
              aria-label={t('home.scrollToMoreAria')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg"
              style={{ backgroundColor: '#1E6A6A', color: 'white' }}
              data-testid="featured-scroll-right"
            >
              <span>{t('home.scrollForMore')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Horizontal scroller — every admin-curated featured listing is
            kept in the strip. Desktop users click the labeled "Scroll" pills
            above; mobile users swipe. snap-x keeps cards from stopping
            mid-image. A gradient fade on the right edge hints that there's
            more content when more cards exist offscreen. */}
        <div className="relative" data-testid="featured-strip">
          <div
            ref={scrollerRef}
            className="flex gap-3 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-6 px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-testid="featured-scroller"
          >
            {featuredProperties.map((property) => {
              const cover = getCoverImage(property.images, 600, '', property.videos, property.id);
              return (
              <div
                key={property.id}
                className="property-card snap-start shrink-0 w-[78vw] sm:w-[44vw] md:w-[340px] lg:w-[360px]"
                onClick={() => {
                  sessionStorage.setItem('previousPath', window.location.pathname);
                  navigate(`/property/${property.id}`);
                }}
                data-testid={`property-card-${property.id}`}
              >
                <div className="relative h-44 md:h-60 bg-gray-200" style={{
                  backgroundImage: `url(${cover.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}>
                  {cover.isDefault && <DefaultImageBadge />}
                  {cover.fromVideo && <VideoCoverBadge />}
                </div>
                <div className="p-3 md:p-5">
                  <h3 className="text-sm md:text-lg font-bold mb-1 md:mb-2 line-clamp-1">{property.title}</h3>
                  <div className="flex items-center gap-2 text-gray-600 mb-2 md:mb-3">
                    <MapPin size={14} className="md:w-4 md:h-4 shrink-0" />
                    <span className="text-xs md:text-sm truncate">{property.area}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-4 mb-4 text-sm text-gray-700">
                    {property.bedrooms && (
                      <div className="flex items-center gap-1">
                        <Bed size={16} />
                        <span>{property.bedrooms}</span>
                      </div>
                    )}
                    {property.bathrooms && (
                      <div className="flex items-center gap-1">
                        <Bath size={16} />
                        <span>{property.bathrooms}</span>
                      </div>
                    )}
                    {property.square_meters && (
                      <div className="flex items-center gap-1">
                        <HomeIcon size={16} />
                        <span>{property.square_meters} m²</span>
                      </div>
                    )}
                  </div>
                <div className="flex items-center justify-between">
                  <span className="text-base md:text-2xl font-bold" style={{ color: "#D4AF37" }}>
                    ₪{property.monthly_price || property.nightly_price}
                    <span className="text-[10px] md:text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </span>
                  </span>
                  <span className="hidden md:inline text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
                    {{'long-term': t('property.longTerm'), 'short-term': t('property.shortTerm'), 'vacation': t('property.vacationType'), 'storage': t('property.storageType')}[property.rental_type] || property.rental_type}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* About Us Section */}
      <div className="py-20" style={{ backgroundColor: '#F5F5F5' }}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8 text-center" style={{ fontFamily: 'Playfair Display', color: '#1E6A6A' }}>
            {t('home.aboutUs')}
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-gray-700">
            <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('home.aboutPara1')) }} />
            <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('home.aboutPara2')) }} />
          </div>
        </div>
      </div>

      <div className="py-16" style={{ backgroundColor: '#1E6A6A' }}>
        <div className="max-w-7xl mx-auto px-6 text-center" style={{ color: '#D4AF37' }}>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
            {t('footer.contact')}
          </h2>
          <p className="text-lg mb-2">
            {t('home.whatsapp')}: <a href="https://wa.me/972553225141" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" data-testid="contact-whatsapp">+972 55 322 5141</a>
          </p>
          <p className="text-lg">
            {t('home.email')}: <a href="mailto:support@myisraelrental.com" className="font-bold hover:underline">support@myisraelrental.com</a>
          </p>
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(212,175,55,0.25)' }}>
            <a
              href="/faq"
              onClick={(e) => { e.preventDefault(); navigate('/faq'); }}
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline transition-opacity hover:opacity-80"
              data-testid="footer-faq-link"
            >
              {t('footer.faq')} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;