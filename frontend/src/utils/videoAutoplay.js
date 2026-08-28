/**
 * Make a <video> actually autoplay on a phone.
 *
 * The bug this exists for: React sets `muted` as a DOM *property*, never as
 * an attribute. Desktop browsers do not care — by the time anything calls
 * play(), the property is set and the video is genuinely silent. Mobile
 * browsers decide at parse time, reading the ATTRIBUTE, and a video that
 * looks unmuted to that check is refused under the autoplay policy. The
 * refusal arrives as a rejected promise which both call sites swallowed, so
 * the poster frame stayed up wearing a native play button and nothing was
 * logged anywhere.
 *
 * That is why the home page played on a laptop and asked for a tap on a
 * phone. Inspect any of these elements and `hasAttribute('muted')` is false
 * while `.muted` is true.
 *
 * So: set both, then play. Keep calling this before every play() rather than
 * once at mount — React re-renders can drop an attribute it does not believe
 * it owns.
 */
export function ensureMuted(video) {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true; // survives a load()/src change
  if (!video.hasAttribute('muted')) video.setAttribute('muted', '');
}

/**
 * play(), but muted first and with one retry on the next user gesture.
 *
 * The retry covers the cases muting cannot: iOS Low Power Mode and Android
 * Data Saver refuse autoplay outright, whatever the attributes say. One
 * listener, removed as soon as it fires or the element leaves the screen, so
 * a page of five scenes does not accumulate handlers.
 *
 * Still resolves quietly on failure — a poster frame is a fine outcome and
 * far better than a broken scroll sequence.
 */
const GESTURES = ['touchstart', 'pointerdown', 'scroll'];
// Fired once the element has enough data to begin. `loadeddata` is the
// earliest useful one; `canplay` covers browsers that skip it.
const READY = ['loadeddata', 'canplay'];

export function playWhenAllowed(video) {
  if (!video) return;
  ensureMuted(video);

  const attempt = video.play();
  if (!attempt || typeof attempt.catch !== 'function') return;

  attempt.catch(() => {
    if (video.dataset.autoplayRetry === 'armed') return;
    video.dataset.autoplayRetry = 'armed';

    const retry = () => {
      ensureMuted(video);
      video.play().catch(() => {});
      cleanup();
    };
    const cleanup = () => {
      delete video.dataset.autoplayRetry;
      GESTURES.forEach((evt) => window.removeEventListener(evt, retry));
      READY.forEach((evt) => video.removeEventListener(evt, retry));
    };

    /* Two kinds of retry, because there are two reasons the first attempt
       fails and only one of them needs a person.

       READY: play() is called from a mount effect, which can easily run
       before the element has a single byte. Some browsers reject that
       outright — nothing is wrong, the video simply was not ready yet, and
       waiting for data and asking again is all that was needed. Without
       this the video sat still until the visitor happened to touch the
       screen, which looked exactly like a refusal.

       GESTURES: the genuine refusals — iOS Low Power Mode and Android Data
       Saver — which no amount of asking fixes until there is an
       interaction to hang it on. */
    READY.forEach((evt) => video.addEventListener(evt, retry, { once: true }));
    GESTURES.forEach((evt) =>
      window.addEventListener(evt, retry, { once: true, passive: true }),
    );
  });
}
