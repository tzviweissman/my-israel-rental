/**
 * Put enough realistic data into the PREVIEW environment to judge the
 * marketplace against.
 *
 * WHY THIS GOES THROUGH THE API AND NOT THE DATABASE
 * --------------------------------------------------
 * Connecting to Mongo directly would need the preview `MONGO_URL`, which
 * is a secret this script has no business handling, and it would write
 * documents that never passed a single validator — so the seeded rows
 * could differ in shape from anything a real provider could create, and
 * the first bug found would be in the seed rather than the product.
 * Everything below goes through the same public endpoints a person uses.
 *
 * SAFE TO RUN TWICE. Accounts, businesses and gigs are all matched on
 * their natural key first; an existing one is reused rather than
 * duplicated. Running it again after adding a listing below adds only
 * that listing.
 *
 * IT REFUSES TO TOUCH PRODUCTION. The target must look like a preview
 * host; `myisraelrental.com` is rejected outright. Seed data on the real
 * site would be indistinguishable from a real business to a visitor, and
 * that is not a mistake worth being one command away from.
 *
 * Usage:
 *   node scripts/seed-preview.mjs                    # dry run, prints the plan
 *   node scripts/seed-preview.mjs --commit           # actually writes
 */
const API = (process.env.PREVIEW_API
  || 'https://backend-preview-production-c9ea.up.railway.app').replace(/\/$/, '');
const COMMIT = process.argv.includes('--commit');

// ---- the guard ------------------------------------------------------------
if (/myisraelrental\.com/i.test(API) || !/preview|localhost|127\.0\.0\.1/i.test(API)) {
  console.error(
    `Refusing to seed ${API}\n`
    + 'This script only targets a preview or local host. Seeded listings on the '
    + 'live site would be indistinguishable from real businesses.',
  );
  process.exit(1);
}

/* A shared password for five throwaway PREVIEW accounts, committed on
   purpose. It is not a secret being leaked: these accounts exist only on
   the preview environment, own nothing real, and being able to sign in as
   one is the point — it is how a person looks at the provider dashboard,
   the setup checklist and the tour without first inventing an account.
   Override with SEED_PASSWORD if that ever stops being true. This script
   refuses to run against production, so these credentials cannot reach it. */
const PASSWORD = process.env.SEED_PASSWORD || 'PreviewSeed!2026';

/* Listing photos, from the site's OWN Cloudinary assets.
   A gig will not publish without one — "a listing without one is very hard
   to book", which is correct and stays correct for seed data too. These are
   images we already host and pay for, so nothing hot-links a stranger and
   nothing 404s later when somebody else's URL rotates. They are scene
   photography rather than per-listing shots, so expect them to look
   generic; that is the honest trade for not inventing assets. */
const CDN = 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504';
const PHOTOS = {
  interior: `${CDN}638/myisraelrental/site/scene3-interior-reveal.png`,
  acPro: `${CDN}645/myisraelrental/site/scene7-ac-pro.png`,
  jerusalem: `${CDN}641/myisraelrental/site/scene5-lister-jerusalem.png`,
  desk: `${CDN}643/myisraelrental/site/scene6-contract-laptop.png`,
};

/* Addresses are on OUR OWN domain with an unmistakable `preview-seed-`
   prefix. Two reasons: reserved TLDs like `.test` and `.invalid` are
   refused by the registration validator, and any address on somebody
   else's domain risks a real stranger receiving a welcome email because
   a seed script picked their name out of the air. If preview has email
   configured, these land with us. */

/** One provider, one business, a handful of listings each. */
const PROVIDERS = [
  {
    email: 'preview-seed-cohen-movers@myisraelrental.com',
    name: 'Daniel Cohen',
    business: 'Cohen Movers',
    photo: PHOTOS.interior,
    area: 'Jerusalem',
    categories: ['moving-relocation'],
    description: 'Two brothers, one truck, fifteen years of Jerusalem staircases. We pack, we carry, we put it back together.',
    gigs: [
      { title: 'Local move, up to 3 rooms', category: 'moving-relocation', price: 1800,
        description: 'Door to door within Jerusalem. Packing materials included, furniture dismantled and reassembled.' },
      { title: 'Single item / piano move', category: 'moving-relocation', price: 650,
        description: 'One heavy or awkward item — piano, safe, wardrobe. Stair charges included up to the fourth floor.' },
      { title: 'Packing service only', category: 'moving-relocation', price: 900,
        description: 'We pack, you move. Boxes, tape and labelling included; typically a day for a three-room flat.' },
    ],
  },
  {
    email: 'preview-seed-shani-clean@myisraelrental.com',
    name: 'Shani Levi',
    business: 'Levi Home Care',
    photo: PHOTOS.interior,
    area: 'Tel Aviv',
    categories: ['cleaning-services'],
    description: 'Home cleaning and post-renovation clean-ups across Tel Aviv. Same team every visit, our own equipment.',
    gigs: [
      { title: 'Full apartment deep clean', category: 'cleaning-services', price: 480,
        description: 'Kitchen, bathrooms, floors and windows — everything, top to bottom.' },
      { title: 'Oven and appliance clean', category: 'cleaning-services', price: 220,
        description: 'Oven, hob and extractor brought back to showroom condition. Fridge inside and out on request.' },
      { title: 'Windows and balconies', category: 'cleaning-services', price: 190,
        description: 'Inside and out where it is safe to reach, tracks and shutters included.' },
      { title: 'Move-out clean', category: 'cleaning-services', price: 590,
        description: 'Handed back spotless, so the deposit conversation is a short one.' },
    ],
  },
  {
    email: 'preview-seed-avi-fix@myisraelrental.com',
    name: 'Avi Mizrahi',
    business: 'Mizrahi Repairs',
    photo: PHOTOS.acPro,
    area: 'Bet Shemesh',
    categories: ['home-services-repair'],
    description: 'Plumbing, electrics and the long list of small things nobody else will come out for.',
    gigs: [
      { title: 'Blocked drain or leaking tap', category: 'home-services-repair', price: 350,
        description: 'Same-week callout across Bet Shemesh and Ramat Beit Shemesh. Parts charged at cost.' },
      { title: 'Air conditioner service', category: 'home-services-repair', price: 280,
        description: 'Filters, gas check and a clean before the summer. Two units for 450.' },
      { title: 'Hang, mount and assemble', category: 'home-services-repair', price: 200,
        description: 'Shelves, TVs, blinds, flat-pack furniture. Priced by the hour after the first.' },
    ],
  },
  {
    email: 'preview-seed-noa-photo@myisraelrental.com',
    name: 'Noa Adler',
    business: 'Noa Adler Photography',
    photo: PHOTOS.jerusalem,
    area: 'Jerusalem',
    categories: ['creative-design'],
    description: 'Family and event photography in and around Jerusalem. Natural light, no stiff poses.',
    gigs: [
      { title: 'Family session, one hour', category: 'creative-design', price: 750,
        description: 'On location, around forty edited images delivered within a week.' },
      { title: 'Bar mitzvah coverage', category: 'creative-design', price: 2400,
        description: 'Ceremony and party, two photographers, full gallery plus a short highlight reel.' },
    ],
  },
  {
    email: 'preview-seed-yael-tutor@myisraelrental.com',
    name: 'Yael Barak',
    business: 'Barak Tutoring',
    photo: PHOTOS.desk,
    area: 'Modiin',
    categories: ['education-tutoring'],
    description: 'Maths and English for olim kids catching up with the Israeli curriculum.',
    gigs: [
      { title: 'Maths, one-to-one hour', category: 'education-tutoring', price: 180,
        description: 'Primary through bagrut. In your home or online, whichever suits.' },
      { title: 'English for new olim', category: 'education-tutoring', price: 160,
        description: 'Conversational and written, aimed at kids who arrived mid-year.' },
    ],
  },
];

// ---- plumbing -------------------------------------------------------------
const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, json, text };
};

/** Sign in, or register first if the account is not there yet. */
async function ensureAccount(p) {
  const login = await call('/api/auth/login', {
    method: 'POST', body: { email: p.email, password: PASSWORD },
  });
  if (login.status === 200) {
    return { token: login.json.access_token || login.json.token, created: false };
  }
  const reg = await call('/api/auth/register', {
    method: 'POST',
    body: { name: p.name, email: p.email, password: PASSWORD, role: 'provider', phone: '' },
  });
  if (reg.status !== 200) throw new Error(`register ${p.email}: ${reg.status} ${reg.text.slice(0, 160)}`);
  return { token: reg.json.token || reg.json.access_token, created: true };
}

async function ensureBusiness(token, p) {
  const mine = await call('/api/marketplace/businesses', { token });
  const found = (mine.json || []).find((b) => b.name === p.business);
  if (found) return { id: found.id, created: false };

  const made = await call('/api/marketplace/businesses', {
    method: 'POST', token, body: { name: p.business },
  });
  if (made.status !== 200) throw new Error(`business ${p.business}: ${made.status} ${made.text.slice(0, 160)}`);
  // Categories, areas and the description are a PATCH — creation takes a
  // name only, which is the same thing the dashboard form does.
  await call(`/api/marketplace/businesses/${made.json.id}`, {
    method: 'PATCH', token,
    body: { description: p.description, categories: p.categories, areas: [p.area] },
  });
  return { id: made.json.id, created: true };
}

/** Every gig this provider already has. `/my-gigs`, NOT `/gigs/mine` —
 *  the latter matches the `/gigs/{gig_id}` route, 404s with an object, and
 *  a `.find?.()` on an object is silently undefined. That is exactly how
 *  the first run of this script duplicated all fourteen listings: the
 *  guard did not throw, it just never found anything. */
async function myGigs(token) {
  const res = await call('/api/marketplace/my-gigs', { token });
  if (res.status !== 200) throw new Error(`my-gigs: ${res.status} ${res.text.slice(0, 120)}`);
  const list = Array.isArray(res.json) ? res.json : res.json?.gigs;
  if (!Array.isArray(list)) {
    throw new Error(`my-gigs returned no array — refusing to guess and duplicate: ${res.text.slice(0, 120)}`);
  }
  return list;
}

async function ensureGig(token, businessId, p, g, existingTitles) {
  if (existingTitles.has(g.title)) return false;

  const res = await call('/api/marketplace/gigs', {
    method: 'POST', token,
    body: {
      title: g.title,
      category: g.category,
      business_id: businessId,
      description: g.description,
      area: p.area,
      gallery: [p.photo],
      gig_type: 'deliverable',
      status: 'published',
      /* `in_platform`, not `whatsapp`. WhatsApp mode requires a number,
         and inventing one would put a dead wa.me link on a public listing
         — the site's own rule is real data or none. Contact therefore
         goes through site chat, which also means every seeded listing is
         actually reachable rather than pointing at nobody. */
      booking_mode: 'in_platform',
      tiers: [{ name: 'Standard', price: g.price, currency: 'ILS', description: g.description }],
    },
  });
  if (res.status !== 200) throw new Error(`gig "${g.title}": ${res.status} ${res.text.slice(0, 200)}`);
  return true;
}

// ---- run ------------------------------------------------------------------
console.log(`target: ${API}`);
console.log(COMMIT ? 'MODE: writing\n' : 'MODE: dry run — pass --commit to write\n');

if (!COMMIT) {
  let n = 0;
  for (const p of PROVIDERS) {
    console.log(`  ${p.business} (${p.area}) — ${p.gigs.length} listing(s)`);
    p.gigs.forEach((g) => { n += 1; console.log(`      ${g.title}  ₪${g.price}`); });
  }
  console.log(`\n${PROVIDERS.length} businesses, ${n} listings. Nothing written.`);
  process.exit(0);
}

let madeGigs = 0;
let madeBiz = 0;
for (const p of PROVIDERS) {
  try {
    const { token, created } = await ensureAccount(p);
    const biz = await ensureBusiness(token, p);
    if (biz.created) madeBiz += 1;
    // Fetched ONCE per provider, then updated locally — one round trip
    // instead of one per listing, and no window between the check and the
    // create for a second run to slip through.
    const existingTitles = new Set((await myGigs(token)).map((x) => x.title));
    let added = 0;
    for (const g of p.gigs) {
      if (await ensureGig(token, biz.id, p, g, existingTitles)) {
        existingTitles.add(g.title);
        added += 1;
        madeGigs += 1;
      }
    }
    console.log(`  ${p.business}: account ${created ? 'created' : 'reused'}, business ${biz.created ? 'created' : 'reused'}, ${added} new listing(s)`);
  } catch (e) {
    console.error(`  ${p.business}: FAILED — ${e.message}`);
  }
}

const check = await call('/api/marketplace/gigs?limit=200');
console.log(`\n${madeBiz} business(es) and ${madeGigs} listing(s) created.`);
console.log(`the board now returns ${(check.json || []).length} published listing(s).`);
