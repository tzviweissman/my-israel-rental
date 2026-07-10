import React, { useState } from 'react';
import { Search } from 'lucide-react';

/**
 * Temporary preview page — lets the owner compare candidate hero videos
 * for /services before we commit to one. Delete this file (and its route)
 * once a video is chosen.
 */

const OPTIONS = [
  {
    id: 'A',
    label: 'Young woman happily cleaning her house',
    fit: 'Cleaners, home services — energetic & bright',
    src: '/videos/hero-previews/A-cleaner.mp4',
    poster: '/videos/hero-previews/A-cleaner-poster.jpg',
  },
  {
    id: 'B',
    label: 'Plumber doing installations in a home',
    fit: 'Plumbers, handymen, installers',
    src: '/videos/hero-previews/B-plumber.mp4',
    poster: '/videos/hero-previews/B-plumber-poster.jpg',
  },
  {
    id: 'C',
    label: 'Designer working at home / laptop',
    fit: 'Digital services, designers — versatile',
    src: '/videos/hero-previews/C-designer.mp4',
    poster: '/videos/hero-previews/C-designer-poster.jpg',
  },
  {
    id: 'D',
    label: 'Painter repairing external wall of a building',
    fit: 'Painters, exterior maintenance',
    src: '/videos/hero-previews/D-painter.mp4',
    poster: '/videos/hero-previews/D-painter-poster.jpg',
  },
  {
    id: 'E',
    label: 'Delivery man carrying a large box',
    fit: 'Movers, deliveries, logistics',
    src: '/videos/hero-previews/E-mover.mp4',
    poster: '/videos/hero-previews/E-mover-poster.jpg',
  },
  {
    id: 'F',
    label: 'Professional woman working in home office',
    fit: 'Freelancers, remote pros, consultants',
    src: '/videos/hero-previews/F-freelancer.mp4',
    poster: '/videos/hero-previews/F-freelancer-poster.jpg',
  },
];

function HeroPreview({ opt, overlay }) {
  return (
    <section
      className="relative overflow-hidden text-white py-14 md:py-20 px-4"
      style={{ minHeight: 380 }}
      data-testid={`hero-preview-${opt.id}`}
    >
      {/* Video layer */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={opt.src}
        poster={opt.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      {/* Teal overlay to preserve brand color + text legibility */}
      <div
        className="absolute inset-0"
        style={{
          background: overlay,
        }}
      />
      {/* Content */}
      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-block mb-3 px-3 py-1 text-xs rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
          Option {opt.id} — {opt.label}
        </div>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          style={{ fontFamily: 'Playfair Display' }}
        >
          Find &amp; book trusted local services
        </h1>
        <p className="text-white/85 max-w-2xl mx-auto mb-6 text-sm md:text-base">
          From apartment cleaners to plumbers, movers to interior designers —
          everything you need for living and hosting in Israel, in one place.
        </p>
        <div className="flex bg-white rounded-full overflow-hidden shadow-lg max-w-xl mx-auto">
          <div className="flex items-center flex-1 ps-4">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              placeholder="Search cleaners, movers, plumbers…"
              className="flex-1 px-3 py-3 text-sm text-gray-800 focus:outline-none"
              readOnly
            />
          </div>
          <button className="px-5 py-3 bg-[#D4AF37] text-white text-sm font-semibold">
            Become a provider
          </button>
        </div>
        <p className="mt-4 text-xs text-white/70">Best fit: {opt.fit}</p>
      </div>
    </section>
  );
}

export default function ServicesHeroPreview() {
  // Overlay strength lets you compare "video-forward" vs "brand-forward" looks.
  const [overlayMode, setOverlayMode] = useState('gradient'); // 'gradient' | 'dark' | 'light'

  const overlays = {
    gradient:
      'linear-gradient(135deg, rgba(30,106,106,0.72) 0%, rgba(15,58,58,0.85) 100%)',
    dark: 'linear-gradient(135deg, rgba(15,58,58,0.55) 0%, rgba(15,58,58,0.75) 100%)',
    light:
      'linear-gradient(135deg, rgba(30,106,106,0.35) 0%, rgba(15,58,58,0.55) 100%)',
  };

  return (
    <div
      className="min-h-screen bg-[#FAFAF7]"
      style={{ paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="services-hero-preview-page"
    >
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#0F3A3A] mb-2">
          Services hero video — preview
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          6 candidate background videos rendered exactly as they'd appear on
          the /services page. Pick the option ID you prefer (A–F). Toggle the
          overlay strength to compare how "video-forward" vs "brand-forward"
          each one looks.
        </p>

        <div className="flex flex-wrap gap-2 mb-6" data-testid="overlay-toggle">
          {[
            { k: 'gradient', label: 'Brand overlay (default)' },
            { k: 'dark', label: 'Dark overlay (video-forward)' },
            { k: 'light', label: 'Light overlay (video most visible)' },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setOverlayMode(o.k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                overlayMode === o.k
                  ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-[#1E6A6A]'
              }`}
              data-testid={`overlay-${o.k}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {OPTIONS.map((opt) => (
          <HeroPreview key={opt.id} opt={opt} overlay={overlays[overlayMode]} />
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 text-center text-sm text-gray-500">
        Reply with the letter (A–F) of your favourite and I'll wire it into the
        real /services page.
      </div>
    </div>
  );
}
