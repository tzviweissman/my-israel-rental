/**
 * Per-category visual theme for the Services Marketplace hub.
 *
 * Each card is a dark solid header carrying the category name in white,
 * above a flat pastel body holding a line icon. No text ever sits on an
 * image — the label's contrast is guaranteed by construction rather than
 * by an overlay that has to be tuned per photo, and a set of categories
 * cannot drift into looking like a random pile of stock photography.
 * There are no images here at all any more; the last one was the
 * unknown-category fallback.
 *
 * Colors are picked to feel intentional as a set (not a rainbow) —
 * warm/earthy for hands-on trades, cool/pastel for creative and
 * professional services, so the row reads coherently at a glance.
 * Every label is verified against its own header by
 * `scripts/check-tile-contrast.mjs`, which is the only way this stays
 * true after somebody adds a category.
 */
import {
  Truck, Key, Map, Wind, Sparkles, Wrench, Hammer, Camera,
  Palette, Scissors, Droplet, Zap,
  Music, Home, Dumbbell, Car, Boxes, Plane, Flower, BookOpen,
  Briefcase, SprayCan, Monitor, GraduationCap, Baby, PawPrint, PartyPopper,
  ShoppingBag,
} from 'lucide-react';

// The icon-name -> component registry used to live inside
// the category carousel that used to sit on this page (deleted Aug 2026,
// unused). It is here now because the hero search dropdown shows
// the same icon for the same category: two registries would drift, and a
// category whose icon resolved in one place and fell back to a generic
// box in the other is exactly what shipped before this moved.
const ICONS = {
  Truck, Key, Map, Wind, Sparkles, Wrench, Hammer, Camera,
  Palette, Scissors, Droplet, Zap,
  Music, Home, Dumbbell, Car, Boxes, Plane, Flower, BookOpen,
  Briefcase, SprayCan, Monitor, GraduationCap, Baby, PawPrint, PartyPopper,
  ShoppingBag,
};

// Slugs match backend/routes/marketplace/shared.py CATEGORIES exactly.
// If you change the taxonomy there, update this map (missing slugs fall
// through to DEFAULT_THEME so nothing renders blank).
const CATEGORY_THEME = {
  // --- Kept as-is from the 2026-07-01 taxonomy ---
  'real-estate-services': {
    header: '#1E4A6A', body: '#C6DAEA',
    icon: 'Home', iconColor: '#1E4A6A',
  },
  'health-fitness': {
    header: '#0F3A3A', body: '#CFE6DE',
    icon: 'Dumbbell', iconColor: '#0F3A3A',
  },
  transportation: {
    header: '#5A3720', body: '#F3D7B5',
    icon: 'Car', iconColor: '#5A3720',
  },
  'personal-care': {
    header: '#6B4A3C', body: '#EBDACF',
    icon: 'Scissors', iconColor: '#6B4A3C',
  },
  // --- Merged / renamed ---
  'home-services-repair': {
    header: '#402A16', body: '#EDCFA4',
    icon: 'Wrench', iconColor: '#402A16',
  },
  'travel-tourism': {
    header: '#134256', body: '#C6DFEE',
    icon: 'Plane', iconColor: '#134256',
  },
  'creative-design': {
    header: '#5D3C2A', body: '#F0CFA8',
    icon: 'Palette', iconColor: '#5D3C2A',
  },
  'business-financial': {
    header: '#22405C', body: '#C6D6E6',
    icon: 'Briefcase', iconColor: '#22405C',
  },
  // --- New categories ---
  'moving-relocation': {
    header: '#3F2E1E', body: '#E6D5BB',
    icon: 'Truck', iconColor: '#3F2E1E',
  },
  'cleaning-services': {
    header: '#1C4A5E', body: '#CFE4EC',
    icon: 'SprayCan', iconColor: '#1C4A5E',
  },
  'it-tech-support': {
    header: '#2A2A3E', body: '#D4D4E1',
    icon: 'Monitor', iconColor: '#2A2A3E',
  },
  'education-tutoring': {
    header: '#3B2D5E', body: '#DBD1E8',
    icon: 'GraduationCap', iconColor: '#3B2D5E',
  },
  'childcare-babysitting': {
    header: '#5B3A5A', body: '#EAD6E5',
    icon: 'Baby', iconColor: '#5B3A5A',
  },
  'pet-services': {
    header: '#3E5A2A', body: '#DCE9B8',
    icon: 'PawPrint', iconColor: '#3E5A2A',
  },
  'events-catering': {
    header: '#4A1D5B', body: '#E4CFEC',
    icon: 'PartyPopper', iconColor: '#4A1D5B',
  },
  // Goods rather than labour. Warm neutral so it reads as part of the set
  // rather than a special case.
  'shops-products': {
    header: '#5A3A2E', body: '#EDD9C8',
    icon: 'ShoppingBag', iconColor: '#5A3A2E',
  },
};

// Neutral fallback so a new category from the backend still renders
// something reasonable even before we add a bespoke theme.
// An ICON, not a photo. This is the theme an unknown category falls back
// to, so it is the tile most likely to appear without anyone deciding it
// should — and it used to render a generic Unsplash office shot: one card
// in a row of sixteen looking like stock, fetched from a third-party host
// that can fail or be blocked, in a style matching nothing around it.
//
// A briefcase on the same flat body panel every other tile uses makes the
// fallback look chosen rather than missing, and keeps the row coherent.
export const DEFAULT_THEME = {
  header: 'var(--brand-primary)', body: '#E7EEE9',
  icon: 'Briefcase', iconColor: '#1E5F8C',
};

export const themeForCategory = (slug) => CATEGORY_THEME[slug] || DEFAULT_THEME;

/** The lucide COMPONENT for a category, or null when the taxonomy has no
 *  icon for it — callers decide what a missing icon looks like. */
export const iconForCategory = (slug) => {
  const name = themeForCategory(slug)?.icon;
  return (name && ICONS[name]) || null;
};
