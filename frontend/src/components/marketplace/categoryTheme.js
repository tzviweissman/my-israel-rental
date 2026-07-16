/**
 * Per-category visual theme for the Services Marketplace hub.
 *
 * Mirrors Fiverr's tall-card "Popular services" carousel — each card has
 * a dark solid header (with the category name in white) sitting above a
 * pastel body with a category-representative photo.
 *
 * Colors are picked to feel intentional as a set (not a rainbow) —
 * warm/earthy for hands-on trades, cool/pastel for creative and
 * professional services, so the row reads coherently at a glance.
 *
 * Images are stable Unsplash CDN URLs served with `f=auto&q=70&w=400`
 * for fast card thumbnails.
 */
const un = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=520&q=75`;

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
};

// Neutral fallback so a new category from the backend still renders
// something reasonable even before we add a bespoke theme.
export const DEFAULT_THEME = {
  header: '#1E6A6A', body: '#E7EEE9',
  image: un('photo-1497366216548-37526070297c'),
};

export const themeForCategory = (slug) => CATEGORY_THEME[slug] || DEFAULT_THEME;
