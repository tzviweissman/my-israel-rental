/**
 * Scene manifest for the cinematic home page.
 *
 * Extracted mechanically from `cinematic-preview.html` rather than
 * transcribed, so the `seg` windows, scene heights and asset URLs are the
 * preview's own values. Those numbers are choreography — `seg: '0,.42'`
 * means the first caption holds until the villa wall starts dissolving at
 * 42% — so changing one without re-watching the scene desynchronises the
 * text from the picture.
 *
 * Copy lives in i18n (`home.scenes.<key>.*`); only structure and timing live
 * here. `h2` is split into a plain part and an accent part because the gold
 * word is a design element, and a single string with markup in it can't be
 * translated safely — Hebrew puts the emphasis in a different place.
 *
 * Assets come from `lib/siteAssets` — our own Cloudinary copies, keyed by
 * name. They are large: the five videos together are the page's whole
 * weight budget, which is why the engine only plays the scene that is on
 * screen.
 */
import SITE_ASSETS from '../../lib/siteAssets';

export const SCENES = [
  {
    key: 'villa',
    // The only scene with the zoom-through-the-wall, hence the extra height:
    // the dissolve needs room to breathe or it reads as a cut.
    dataScene: 'villa',
    heightVh: 340,
    video: SITE_ASSETS['clip8-kotel-approach-v2'],
    poster: SITE_ASSETS['scene9-kotel-exterior-v2'],
    still: SITE_ASSETS['scene10-kotel-interior-v2'],
    loop: false, // a one-way push-in; looping would rewind the zoom
    texts: [
      { seg: '0,.42', key: 'villaA' },
      { seg: '.62,1', key: 'villaB' },
    ],
    notes: [],
  },
  {
    key: 'whatsapp',
    heightVh: 240,
    video: SITE_ASSETS['clip3-guest'],
    poster: SITE_ASSETS['scene4-guest-phone'],
    loop: true,
    texts: [{ seg: '.08,1', key: 'whatsapp' }],
    notes: [
      { seg: '.28,1', key: 'waMsg', wa: true },
      { seg: '.55,1', key: 'waTranslate' },
    ],
  },
  {
    key: 'owners',
    heightVh: 280,
    video: SITE_ASSETS['clip4-lister'],
    poster: SITE_ASSETS['scene5-lister-jerusalem'],
    loop: true,
    texts: [{ seg: '.06,1', key: 'owners' }],
    // TWO cards, per the preview. The second matters even before it fades
    // in: `.note` is a flex column, so an opacity-0 card still occupies
    // height and lifts the first card 164px. Shipping one card put the
    // booking notification in the wrong place for the whole scene.
    notes: [
      { seg: '.28,1', key: 'ownersNote' },
      { seg: '.55,1', key: 'ownersSigned', sig: true },
    ],
  },
  {
    key: 'services',
    heightVh: 240,
    video: SITE_ASSETS['clip5-pro'],
    poster: SITE_ASSETS['scene7-ac-pro'],
    loop: true,
    texts: [{ seg: '.06,1', key: 'services' }],
    notes: [{ seg: '.35,1', key: 'servicesNote' }],
  },
  {
    key: 'requests',
    heightVh: 240,
    video: SITE_ASSETS['clip6-requests-man'],
    poster: SITE_ASSETS['scene8-requests-man'],
    loop: true,
    texts: [{ seg: '.06,1', key: 'requests' }],
    notes: [{ seg: '.35,1', key: 'requestsNote' }],
  },
];

export default SCENES;
