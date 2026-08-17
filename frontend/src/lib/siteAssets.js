/**
 * Site media - the generated hero stills and clips, on our own Cloudinary.
 *
 * GENERATED FILE. Produced by
 * backend/scripts/migrate_site_assets_to_cloudinary.py from
 * assets/generated/assets-manifest.json. Re-run that script after adding
 * an asset rather than hand-editing a URL here.
 *
 * These used to be five separate `CDN` constants pointing at Higgsfield's
 * CloudFront distribution - someone else's CDN, whose URLs can expire or
 * rotate without notice. The failure mode was every hero on the site going
 * blank at once with nothing in our logs to explain it. They are now our
 * own copies, delivered with f_auto/q_auto so browsers get WebP/AVIF where
 * supported (q_auto only for video, where switching format is not safe).
 *
 * Keyed by the manifest's `key`, so a URL never has to be typed out at a
 * call site and a missing asset shows up as `undefined` rather than a
 * plausible-looking broken link.
 */
const SITE_ASSETS = {
  'hero-video': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504632/myisraelrental/site/hero-video.mp4',
  'scene1-aerial': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504634/myisraelrental/site/scene1-aerial.png',
  'scene2-villa-approach': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504636/myisraelrental/site/scene2-villa-approach.png',
  'scene3-interior-reveal': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504638/myisraelrental/site/scene3-interior-reveal.png',
  'scene4-guest-phone': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504640/myisraelrental/site/scene4-guest-phone.png',
  'scene5-lister-jerusalem': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504641/myisraelrental/site/scene5-lister-jerusalem.png',
  'scene6-contract-laptop': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504643/myisraelrental/site/scene6-contract-laptop.png',
  'scene7-ac-pro': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504645/myisraelrental/site/scene7-ac-pro.png',
  'clip0-aerial': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504647/myisraelrental/site/clip0-aerial.mp4',
  'clip1-villa': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504650/myisraelrental/site/clip1-villa.mp4',
  'clip2-interior': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504654/myisraelrental/site/clip2-interior.mp4',
  'clip3-guest': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504657/myisraelrental/site/clip3-guest.mp4',
  'clip4-lister': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504660/myisraelrental/site/clip4-lister.mp4',
  'clip5-pro': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504662/myisraelrental/site/clip5-pro.mp4',
  'scene8-requests-man': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504664/myisraelrental/site/scene8-requests-man.png',
  'clip6-requests-man': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504667/myisraelrental/site/clip6-requests-man.mp4',
  'scene9-kotel-exterior-v2': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504668/myisraelrental/site/scene9-kotel-exterior-v2.png',
  'scene10-kotel-interior-v2': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786504670/myisraelrental/site/scene10-kotel-interior-v2.png',
  'clip8-kotel-approach-v2': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504673/myisraelrental/site/clip8-kotel-approach-v2.mp4',
  'clip9-kotel-interior-v2': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786504676/myisraelrental/site/clip9-kotel-interior-v2.mp4',
  'scene11-apartment-exploded': 'https://res.cloudinary.com/dirvyboe9/video/upload/q_auto/v1786580951/myisraelrental/site/scene11-apartment-exploded.mp4',
  'scene12-street-dark': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786589200/myisraelrental/site/scene12-street-dark.png',
  'scene13-street-lit': 'https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1786589202/myisraelrental/site/scene13-street-lit.png',
};

export default SITE_ASSETS;
