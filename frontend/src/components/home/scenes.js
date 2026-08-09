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
 * Assets are absolute CDN URLs, as in the preview. They are large: the five
 * videos together are the page's whole weight budget, which is why the
 * engine only plays the scene that is on screen.
 */

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5';

export const SCENES = [
  {
    key: 'villa',
    // The only scene with the zoom-through-the-wall, hence the extra height:
    // the dissolve needs room to breathe or it reads as a cut.
    dataScene: 'villa',
    heightVh: 340,
    video: `${CDN}/hf_20260806_194741_560798ad-7aec-4522-9bc6-35ef5780de1d.mp4`,
    poster: `${CDN}/hf_20260806_194702_1adb9038-1a92-42d8-b612-7a491483a300.png`,
    still: `${CDN}/hf_20260806_194343_d6e3ec03-0b80-4899-95fa-6d97f5f0c08a.png`,
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
    video: `${CDN}/hf_20260806_162828_1e904da2-ab43-473b-a3cd-5f7bcd7f8d3f.mp4`,
    poster: `${CDN}/hf_20260806_140841_3c1a9b11-94c4-4589-ae8c-be950bf7ed85.png`,
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
    video: `${CDN}/hf_20260806_162843_81c9ed69-00ec-417b-b86b-5a4a605d799d.mp4`,
    poster: `${CDN}/hf_20260806_140841_15036e87-4ad6-4e3c-b48c-3f6bdf42d234.png`,
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
    video: `${CDN}/hf_20260806_162828_de927014-f12c-433d-b56d-31e819576804.mp4`,
    poster: `${CDN}/hf_20260806_140841_7194d0ec-edc0-40b5-87c2-ce574b273e13.png`,
    loop: true,
    texts: [{ seg: '.06,1', key: 'services' }],
    notes: [{ seg: '.35,1', key: 'servicesNote' }],
  },
  {
    key: 'requests',
    heightVh: 240,
    video: `${CDN}/hf_20260806_183007_1ca273cb-a7bf-4c09-9653-2cf301320ad5.mp4`,
    poster: `${CDN}/hf_20260806_182939_99ea6716-e1d2-47af-b156-934c07f68373.png`,
    loop: true,
    texts: [{ seg: '.06,1', key: 'requests' }],
    notes: [{ seg: '.35,1', key: 'requestsNote' }],
  },
];

export default SCENES;
