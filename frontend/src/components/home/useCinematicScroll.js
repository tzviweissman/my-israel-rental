import { useEffect } from 'react';

/**
 * The cinematic home page's scroll engine, ported from the inline script in
 * `cinematic-preview.html`. Behaviour is copied, not reinterpreted — the
 * constants below (.16 fade-in, .1 fade-out, the villa's .42/.2 dissolve
 * window, scale 1→3.1) are the preview's and should not be "tuned".
 *
 * Why a rAF loop rather than a scroll listener: every scene needs its
 * progress recomputed on the same frame the browser paints, and a scroll
 * listener fires at a different cadence from paint — which shows up as the
 * caption lagging a frame behind the zoom. The loop is cheap because it only
 * reads geometry and writes inline styles; it never triggers React renders.
 *
 * Why inline styles instead of React state: driving 20+ elements' opacity and
 * transform through state would re-render the whole tree 60 times a second.
 * The DOM is the right place for per-frame values.
 *
 * FAIL-SAFE, and the reason this file is careful: the preview sets opacity
 * ONLY from JS. `.txt` has no `opacity:0` in CSS, so if this engine never
 * runs — a bundle error, a crawler, reduced motion — every caption is simply
 * visible. Do not add a CSS opacity:0 to `[data-seg]`; that converts a
 * scripting failure into a blank page, which is exactly the trap
 * `docs/acceptance-checklist.md` calls out.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function useCinematicScroll(rootRef, { enabled = true } = {}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const segs = () => root.querySelectorAll('[data-seg]');

    if (!enabled) {
      // Reduced motion: show everything in its final state. Matching the
      // preview's else-branch exactly — the content is the point, the
      // choreography is not.
      segs().forEach((el) => {
        el.style.opacity = 1;
        el.style.transform = 'none';
      });
      // The villa's interior still is inline opacity:0, so reveal the
      // exterior and leave the still hidden — one static frame, not a
      // half-dissolved sandwich of both.
      const villa = root.querySelector('[data-scene="villa"]');
      if (villa) {
        const vv = villa.querySelector('[data-layer="villa"]');
        const vi = villa.querySelector('[data-layer="interior"]');
        if (vv) {
          vv.style.opacity = 1;
          vv.style.transform = 'none';
          vv.style.filter = 'none';
        }
        if (vi) vi.style.opacity = 0;
      }
      return undefined;
    }

    let raf = 0;
    const scenes = [...root.querySelectorAll('[data-scene]')];

    const drive = () => {
      scenes.forEach((s) => {
        const r = s.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        if (total <= 0) return;
        const p = clamp(-r.top / total, 0, 1);

        s.querySelectorAll('[data-seg]').forEach((el) => {
          const [a, b] = el.dataset.seg.split(',').map(Number);
          const t = clamp((p - a) / 0.16, 0, 1);
          const out = p > b ? clamp(1 - (p - b) / 0.1, 0, 1) : 1;
          el.style.opacity = Math.min(t, out);
          el.style.transform = `translateY(${(1 - t) * 30}px)`;
        });

        // Scene 1 only: zoom through the villa wall into the interior still.
        if (s.dataset.scene === 'villa') {
          const vv = s.querySelector('[data-layer="villa"]');
          const vi = s.querySelector('[data-layer="interior"]');
          if (!vv || !vi) return;
          const z = 1 + p * 2.1;
          vv.style.transform = `scale(${z}) translateY(${p * -4}%)`;
          const mix = clamp((p - 0.42) / 0.2, 0, 1);
          vv.style.opacity = 1 - mix;
          vv.style.filter = `brightness(${1 - mix * 0.35})`;
          vi.style.opacity = mix;
          vi.style.transform = `scale(${1.12 - mix * 0.12})`;
        }
      });
      raf = requestAnimationFrame(drive);
    };

    raf = requestAnimationFrame(drive);
    return () => cancelAnimationFrame(raf);
  }, [rootRef, enabled]);
}

/**
 * Play a scene's video only while it is on screen.
 *
 * Separate from the scroll engine because it answers a different question and
 * fails differently: an autoplay rejection (Safari low-power, a user gesture
 * policy) must not take the scroll choreography down with it, hence the
 * swallowed catch — the poster stays up and the page still works.
 */
export function useSceneVideos(rootRef, { enabled = true } = {}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const videos = [...root.querySelectorAll('[data-scene] video')];

    if (!enabled) {
      // Reduced motion: never play. The poster frame is the fallback the
      // brief asks for, and it is already the video's own poster attribute.
      videos.forEach((v) => v.pause());
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }),
      { threshold: 0.05 },
    );
    videos.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [rootRef, enabled]);
}
