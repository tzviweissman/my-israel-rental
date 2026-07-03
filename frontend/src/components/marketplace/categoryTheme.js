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

const CATEGORY_THEME = {
  'tours-activities': {
    header: '#3E5A2A', body: '#DCE9B8',
    icon: 'Map', iconColor: '#3E5A2A',
  },
  'musicians-entertainment': {
    header: '#4A1D5B', body: '#E4CFEC',
    icon: 'Music', iconColor: '#4A1D5B',
  },
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
  'home-organizers': {
    header: '#2A3A4A', body: '#CFDBE7',
    icon: 'Boxes', iconColor: '#2A3A4A',
  },
  'hotels-travel': {
    header: '#134256', body: '#C6DFEE',
    icon: 'Plane', iconColor: '#134256',
  },
  'home-repair': {
    header: '#402A16', body: '#EDCFA4',
    icon: 'Wrench', iconColor: '#402A16',
  },
  'womens-spa': {
    header: '#5B2A3A', body: '#EED0DC',
    icon: 'Flower', iconColor: '#5B2A3A',
  },
  bookkeeping: {
    header: '#22405C', body: '#C6D6E6',
    icon: 'BookOpen', iconColor: '#22405C',
  },
  renovation: {
    header: '#3B2312', body: '#EDCBA6',
    icon: 'Hammer', iconColor: '#3B2312',
  },
  photography: {
    header: '#1A1A1A', body: '#EAE3D7',
    image: un('photo-1502920917128-1aa500764cbd'),
  },
  'graphic-design': {
    header: '#5D3C2A', body: '#F0CFA8',
    icon: 'Palette', iconColor: '#5D3C2A',
  },
};

// Neutral fallback so a new category from the backend still renders
// something reasonable even before we add a bespoke theme.
export const DEFAULT_THEME = {
  header: '#1E6A6A', body: '#E7EEE9',
  image: un('photo-1497366216548-37526070297c'),
};

export const themeForCategory = (slug) => CATEGORY_THEME[slug] || DEFAULT_THEME;
