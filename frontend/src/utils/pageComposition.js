/**
 * The composition document, on the reading side.
 *
 * Phase 1 + 2 of `docs/ai-page-builder-spec.md`. The authority is
 * `backend/utils/page_composition.py`; this is the half that has to draw
 * the result, and `scripts/check-page-builder.mjs` asserts the two agree
 * by fetching `/marketplace/page-vocabulary` rather than trusting them to.
 *
 * THE ASYMMETRY THAT MATTERS, and it is the whole design:
 *
 *   WRITING rejects. An unknown block type, an unknown variant, an
 *   unexpected prop, anything URL-shaped in an image slot: 422, naming
 *   the field. Nothing is quietly repaired, because a repaired document
 *   is one nobody reviewed.
 *
 *   READING tolerates. A block type retired after a page was saved, a
 *   service that has since been deleted, a dial value from a build that
 *   knew one more position than this one: skipped, defaulted, rendered
 *   around. A business must never be able to open its own page and find
 *   nothing there because of something we changed.
 *
 * Those are not in tension. The first stops bad documents being created;
 * the second stops good documents rotting. Confusing them is how you get
 * either a page that breaks on a deploy or a validator with a hole in it.
 */

// Mirrors DIALS in backend/utils/page_composition.py.
export const DIALS = {
  palette: ['stone', 'sea', 'deep', 'gold'],
  type: ['serif', 'grotesque', 'geometric'],
  density: ['airy', 'balanced', 'packed'],
  imagery: ['full-bleed', 'grid', 'thumbnail'],
  price_prominence: ['quiet', 'normal', 'loud'],
  motion: ['still', 'subtle'],
};

export const DIAL_DEFAULTS = {
  palette: 'stone',
  type: 'serif',
  density: 'balanced',
  imagery: 'grid',
  price_prominence: 'normal',
  motion: 'subtle',
};

export const DIAL_NAMES = Object.keys(DIALS);

// type -> the variants that exist. Mirrors BLOCKS.
export const BLOCK_TYPES = {
  hero: ['band', 'compact'],
  rule: ['skyline', 'hairline'],
  facts: ['list'],
  services: ['grid', 'list'],
  providers: ['rows'],
  cover: ['photo', 'tint'],
  gallery: ['carousel'],
  contact: ['stack'],
};

export const MAX_BLOCKS = 24;

/** The six questions of P7b, and the answers each accepts. */
export const BRIEF = {
  showing: ['services', 'catalogue', 'one-thing', 'place', 'properties'],
  action: ['message', 'book', 'visit', 'order', 'understand'],
  audience: ['locals', 'olim', 'tourists', 'businesses', 'everyone'],
  pricing: ['premium', 'fair', 'value', 'quote'],
  strengths: ['quality', 'speed', 'price', 'experience', 'kosher', 'english', 'family', 'licensed'],
};
export const MAX_STRENGTHS = 2;
export const MAX_NOTE = 200;

/**
 * A theme with every dial set to something this build can render.
 *
 * Unknown values fall back rather than throwing. This is the READ side:
 * a document written by a newer build, or one whose dial we later
 * retired, still draws a page. The write path already refused anything
 * invalid, so a value arriving here that is not in DIALS means the two
 * sides are at different versions, which is a reason to degrade and not
 * a reason to show an owner a blank page.
 */
export function normalizeTheme(theme) {
  const out = {};
  DIAL_NAMES.forEach((dial) => {
    const value = theme && theme[dial];
    out[dial] = DIALS[dial].includes(value) ? value : DIAL_DEFAULTS[dial];
  });
  return out;
}

/**
 * The theme as DOM attributes, which is how it reaches the CSS.
 *
 * Attributes and not inline styles, and not class names either. A dial is
 * a position on an axis, so `[data-density="airy"]` lets one stylesheet
 * hold every consequence of that position in one place
 * (`styles/page-theme.css`) instead of scattering the numbers across
 * components. It also means the whole theme is legible in devtools and
 * assertable from a check without reading computed styles for every rule.
 */
export function themeAttrs(theme) {
  const t = normalizeTheme(theme);
  return {
    'data-page-theme': t.palette,
    'data-type': t.type,
    'data-density': t.density,
    'data-imagery': t.imagery,
    'data-price': t.price_prominence,
    'data-motion': t.motion,
  };
}

/**
 * An image reference resolved against what this business actually owns.
 *
 * References, never URLs, and this function is the only place they turn
 * into one. `cover` and `logo` are the business's own; `listing:<id>` is
 * the cover of one of its services. Anything that does not resolve
 * returns null and the caller draws nothing, which is what makes a
 * deleted service a missing picture rather than a broken page.
 */
export function resolveImage(business, ref, coverOf) {
  if (!ref || !business) return null;
  if (ref === 'cover') return business.cover_url || null;
  if (ref === 'logo') return business.logo_url || null;
  if (ref.startsWith('listing:')) {
    const id = ref.slice('listing:'.length);
    const gig = (business.listings || []).find((g) => g && g.id === id);
    if (!gig) return null;
    return (coverOf ? coverOf(gig) : null) || null;
  }
  return null;
}

let seq = 0;
const block = (type, variant, props = {}, id = null) => ({
  id: id || `${type}-${(seq += 1)}`,
  type,
  variant,
  props,
});

/**
 * The document that describes the page a business already has.
 *
 * This is phase 1's actual test: if the existing page cannot be written
 * down in this vocabulary, the vocabulary is wrong, and it is far cheaper
 * to find that out here than after a model is emitting it.
 *
 * It is also what every business gets before anyone touches a dial, so it
 * has to be a good page rather than a demonstration of the machinery.
 * Nothing here is invented from a preference: it is the order the page
 * has always drawn, written as data.
 */
export function composeDefault(business) {
  const b = business || {};
  const blocks = [
    // Facts before services. The band is self-hiding, so a business that
    // has filled in none of it loses nothing by the block being here, and
    // one that has filled it in gets the most persuasive thing it has
    // said above the catalogue rather than buried under it.
    block('facts', 'list', {}, 'facts'),
    // The catalogue, which INCLUDES the featured row. Two blocks would
    // have put "Start here" above the "Services" heading it belongs
    // under, which is a worse page than the one that exists. The featured
    // row is separately placeable (`source: "featured"`) for an owner who
    // wants it somewhere else; the default does not reorder their page to
    // demonstrate that it can.
    block('services', 'grid', { source: 'all', heading: '', limit: 12 }, 'catalog'),
  ];
  return {
    theme: {
      ...DIAL_DEFAULTS,
      // The accent the owner already chose is the palette they already
      // chose. Starting them on the default would silently undo a
      // decision they made in the same editor.
      palette: DIALS.palette.includes(b.accent) ? b.accent : DIAL_DEFAULTS.palette,
    },
    blocks,
  };
}

/**
 * What to draw for this business: its composition, or the default.
 *
 * Blocks whose type or variant this build does not know are dropped here
 * rather than at the renderer, so a caller counting blocks and a renderer
 * drawing them can never disagree about how many there are.
 */
export function readComposition(business) {
  const stored = business && business.page;
  if (!stored || !Array.isArray(stored.blocks) || stored.blocks.length === 0) {
    return composeDefault(business);
  }
  const blocks = stored.blocks
    .filter((x) => x && BLOCK_TYPES[x.type])
    .map((x) => ({
      ...x,
      // An unknown variant is not a reason to lose the block. Falling
      // back to the type's first variant keeps the content and loses only
      // the shape, which is the right way round.
      variant: BLOCK_TYPES[x.type].includes(x.variant) ? x.variant : BLOCK_TYPES[x.type][0],
      props: x.props || {},
    }))
    .slice(0, MAX_BLOCKS);
  if (blocks.length === 0) return composeDefault(business);
  return { theme: normalizeTheme(stored.theme), blocks };
}

/** True when this business has a composition of its own. */
export const hasComposition = (business) => Boolean(
  business && business.page && Array.isArray(business.page.blocks) && business.page.blocks.length,
);

export default readComposition;

/* ------------------------------------------------------------ presets
 *
 * Finished looks, free and unlimited (P3, P7g). Switching between them is
 * not generation: it is five dial positions applied at once, computed
 * here and rendered locally, so it costs nothing and can be undone by
 * picking another.
 *
 * NONE OF THEM SETS THE PALETTE. The accent is chosen two sections above
 * in the same editor, and a preset that silently repainted it would undo
 * a decision the owner had just made and watched take effect. A look is
 * about weight, space and emphasis; the colour is theirs.
 */
export const PRESETS = {
  // Signals expensive: few things visible, large light type, quiet price,
  // photography given room. Not a claim that this SELLS better, a claim
  // about what it reads as - the two quoted statistics in this area both
  // turned out to be invented (docs/page-builder-research.md, part 3).
  quiet: {
    type: 'serif', density: 'airy', imagery: 'full-bleed',
    price_prominence: 'quiet', motion: 'still',
  },
  // Warm and made by hand: the craft/food register.
  warm: {
    type: 'serif', density: 'balanced', imagery: 'grid',
    price_prominence: 'normal', motion: 'subtle',
  },
  // Signals good value: more on screen, heavier type, the price stated
  // plainly and large. Density is not licence for urgency or countdowns;
  // there are none at any setting (P5).
  bold: {
    type: 'grotesque', density: 'packed', imagery: 'thumbnail',
    price_prominence: 'loud', motion: 'subtle',
  },
  // Text-forward and restrained: the professional-services register,
  // where restraint reads as trustworthy rather than as expensive.
  plain: {
    type: 'geometric', density: 'balanced', imagery: 'grid',
    price_prominence: 'quiet', motion: 'still',
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

/**
 * The brief, placed on the dials.
 *
 * THIS FUNCTION IS THE CRUX OF P2, and building it before there is any
 * model is the whole reason phases 1 and 2 come first. "A luxury brand
 * needs a different feel from a cheap brand" is true and has to become
 * parameters; if it cannot be written as a function of a short brief, a
 * model will not rescue it, it will only make it expensive to discover.
 *
 * Deliberately deterministic and deliberately small. Later this is the
 * shape a model produces instead, from the same brief, with more
 * nuance - but the OUTPUT is these six values either way, which is what
 * makes generation a swap rather than a rebuild.
 *
 * Read as: price tier sets the base position, then what they are showing
 * and who for adjust it. Later rules win, so the order is the priority.
 */
export function briefToTheme(brief, base) {
  const t = { ...DIAL_DEFAULTS, ...normalizeTheme(base) };
  const b = brief || {};

  // 4. Where the prices sit. The strongest single signal, and the reason
  // the question is phrased without judgement: nobody ticks "cheap".
  if (b.pricing === 'premium') Object.assign(t, PRESETS.quiet);
  if (b.pricing === 'fair') Object.assign(t, PRESETS.warm);
  if (b.pricing === 'value') Object.assign(t, PRESETS.bold);
  // "I quote" has no price to make prominent, so making it loud would
  // shout "Ask for a quote" at every card.
  if (b.pricing === 'quote') Object.assign(t, { ...PRESETS.plain, price_prominence: 'quiet' });

  // 1. What they are showing. Architecture, not tone: one thing wants
  // room and a catalogue wants browse density from the first screen.
  if (b.showing === 'one-thing') Object.assign(t, { density: 'airy', imagery: 'full-bleed' });
  if (b.showing === 'catalogue' && t.density === 'balanced') t.density = 'packed';
  if (b.showing === 'place') t.imagery = 'full-bleed';

  // 3. Who it is for. Businesses buying from businesses read text and
  // credentials, not photography.
  if (b.audience === 'businesses') Object.assign(t, { type: 'geometric', imagery: 'grid' });
  if (b.audience === 'tourists') t.imagery = 'full-bleed';

  // 2. What they should do. Ordering needs the price in front of them;
  // "just understand what I do" is the one answer where a price on every
  // card gets in the way of the explaining.
  if (b.action === 'order') t.price_prominence = 'loud';
  if (b.action === 'understand') t.price_prominence = 'quiet';

  // The palette is never inferred. There is no colour question, on
  // purpose: asking one produces a colour picker by the back door, and
  // the reason there is no colour picker is P1.
  t.palette = normalizeTheme(base).palette;
  return t;
}

/**
 * What changed, as dial names, so the UI can say it in words.
 *
 * P7f: "then show what changed". It matters more than it looks - it
 * teaches the vocabulary, so the second request is sharper than the
 * first, and the owner learns they can reach the same result with a
 * button that costs nothing.
 */
export function themeDiff(before, after) {
  const a = normalizeTheme(before);
  const b = normalizeTheme(after);
  return DIAL_NAMES.filter((d) => a[d] !== b[d]).map((d) => ({ dial: d, from: a[d], to: b[d] }));
}

/** How much of the brief is answered, counting what we already hold.
 *
 *  ENDOWED PROGRESS (P7b): they have already given us a name, what they
 *  sell, where they work and some photos, so arriving at "0 of 10" is a
 *  lie that makes a finished form look unstarted. Counted rather than
 *  assumed: a business with no photos is not told it has some. */
export function briefProgress(business, brief) {
  const b = business || {};
  const known = [
    Boolean(b.name),
    ((b.listing_categories || []).length + (b.categories || []).length) > 0
      || (b.listings || []).length > 0,
    (b.areas || []).length > 0 || Boolean(b.serves_nationwide),
    Boolean(b.cover_url || b.logo_url) || (b.listings || []).some((g) => g && (g.gallery || []).length),
  ].filter(Boolean).length;
  const answers = brief || {};
  const answered = ['showing', 'action', 'audience', 'pricing']
    .filter((k) => answers[k]).length
    + ((answers.strengths || []).length ? 1 : 0)
    + ((answers.note || '').trim() ? 1 : 0);
  return { done: known + answered, total: 10, known, answered };
}
