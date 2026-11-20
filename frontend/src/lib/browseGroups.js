/**
 * The rows and chips of /businesses (Tzvi, 20 Nov 2026: "right now its just a big mix ... i want it more
 * organized"; preview https://claude.ai/artifact/9qtcEt5YgtqwypVxMQCbBx, study docs/inspo/directory-2026-11-20).
 *
 * PRESENTATION ONLY, like categoryGroups.js: a listing's data is still its category slug and optional
 * subcategory. These groups put food first because it is the biggest group (about 20 of 78 on 20 Nov 2026),
 * and pull bakers and caterers out of "Events" into Food, where a hungry visitor looks.
 *
 * A listing in a group but in no chip (a shop with no subcategory yet) still shows in the group's "All" and in
 * its row. scripts/check-shop-subcategories.mjs lists the shops that have none.
 */
const sub = (cat, slug) => (g) => g.category === cat && g.subcategory === slug;
const cat = (c) => (g) => g.category === c;
const any = (...fs) => (g) => fs.some((f) => f(g));

export const BROWSE_GROUPS = [
  { id: 'food', icon: 'food', label: 'Food & Treats', line: 'Baked, boarded and brewed by local kitchens',
    chips: [
      { id: 'bakery', label: 'Bakery & cakes', test: any(sub('shops-products', 'bakery'), sub('events-catering', 'cakes-desserts')) },
      { id: 'boards', label: 'Boards & platters', test: sub('shops-products', 'boards-platters') },
      { id: 'meals', label: 'Meals & Shabbos food', test: any(sub('shops-products', 'meals'), sub('events-catering', 'catering')) },
      { id: 'drinks', label: 'Coffee & drinks', test: sub('shops-products', 'coffee-drinks') },
      { id: 'pantry', label: 'Dips, spreads & dough', test: sub('shops-products', 'pantry') },
    ] },
  { id: 'style', icon: 'style', label: 'Fashion & Beauty', line: 'Wigs, nails, makeup and modest wear',
    chips: [
      { id: 'hair', label: 'Hair & wigs', test: any(sub('shops-products', 'hair-wigs'), sub('personal-care', 'hair')) },
      { id: 'makeup', label: 'Makeup', test: sub('personal-care', 'makeup') },
      { id: 'nails', label: 'Nails', test: sub('personal-care', 'nails') },
      { id: 'clothing', label: 'Clothing', test: sub('shops-products', 'clothing') },
      { id: 'jewelry', label: 'Jewelry', test: sub('shops-products', 'jewelry') },
      { id: 'accessories', label: 'Accessories', test: sub('shops-products', 'accessories') },
    ] },
  { id: 'home', icon: 'home', label: 'Home & Cleaning', line: 'Cleaners, painters and kitchen kashering',
    chips: [
      { id: 'cleaning', label: 'Cleaning', test: cat('cleaning-services') },
      { id: 'repairs', label: 'Repairs & painting', test: (g) => g.category === 'home-services-repair' && !['kashering', 'interior-design'].includes(g.subcategory) },
      { id: 'kashering', label: 'Kitchen kashering', test: sub('home-services-repair', 'kashering') },
      { id: 'organising', label: 'Organising & styling', test: sub('home-services-repair', 'interior-design') },
      { id: 'moving', label: 'Moving', test: cat('moving-relocation') },
    ] },
  { id: 'gifts', icon: 'gifts', label: 'Gifts', line: 'Boxes and Judaica made to give',
    chips: [
      { id: 'boxes', label: 'Gift boxes', test: sub('shops-products', 'gift-boxes') },
      { id: 'judaica', label: 'Judaica & holidays', test: sub('shops-products', 'judaica') },
      { id: 'personal', label: 'Personalised & art', test: sub('shops-products', 'personalised') },
      { id: 'toys', label: 'Toys', test: sub('shops-products', 'toys') },
    ] },
  { id: 'health', icon: 'health', label: 'Health & Wellness', line: 'Trainers, nutrition and therapy', chips: [] },
  { id: 'events', icon: 'events', label: 'Events', line: 'Balloons and music for your simcha',
    chips: [
      { id: 'decor', label: 'Balloons & decor', test: sub('events-catering', 'balloons-decor') },
      { id: 'music', label: 'Music & entertainment', test: sub('events-catering', 'music-entertainment') },
    ] },
  { id: 'more', icon: 'more', label: 'More', line: 'Concierge, travel, pets and more', chips: [] },
];

const FOOD_SUBS = ['bakery', 'boards-platters', 'meals', 'coffee-drinks', 'pantry'];
const GIFT_SUBS = ['gift-boxes', 'judaica', 'personalised', 'toys'];
const STYLE_SUBS = ['clothing', 'jewelry', 'hair-wigs', 'accessories'];

/** The group id a listing belongs to. Every listing lands in exactly one; unknown ones in "more". */
export function groupOf(g) {
  const c = g?.category, s = g?.subcategory;
  if (c === 'shops-products') {
    if (FOOD_SUBS.includes(s)) return 'food';
    if (GIFT_SUBS.includes(s)) return 'gifts';
    if (STYLE_SUBS.includes(s)) return 'style';
    return 'more';
  }
  if (c === 'events-catering') return ['catering', 'cakes-desserts'].includes(s) ? 'food' : 'events';
  if (c === 'personal-care') return 'style';
  if (['cleaning-services', 'home-services-repair', 'moving-relocation'].includes(c)) return 'home';
  if (['health-fitness', 'medical-health'].includes(c)) return 'health';
  return 'more';
}

export const groupById = (id) => BROWSE_GROUPS.find((x) => x.id === id) || null;
