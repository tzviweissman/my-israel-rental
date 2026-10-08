/**
 * The right half of the sign-in pages: a turning sphere of what is on the
 * site right now, businesses and homes alike, every circle a real page.
 *
 * Tzvi: "add to the black side this img sphere with businesses and
 * rentals in them". The photos come from useHomeShowcase, the same
 * source as the home page's corridor, so nothing here is stock and
 * nothing is invented. Every circle is a different picture: no repeats
 * (Tzvi, 7 Oct 2026, "I can see repeating ones"), and a business with
 * several listings under one logo shows it once. When the site has fewer
 * than the sphere wants, the sphere is smaller, never padded.
 *
 * The ground is white with a mist of the accent blue (see below); it was
 * a fluted black-to-navy panel until 7 Oct 2026.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';

import SphereImageGrid from '../ui/img-sphere';
import useHomeShowcase, { propertyPhoto } from '../home/useHomeShowcase';
import { getGigCover } from '../../utils/gigAvailability';
import { sizedImage } from '../../utils/cdnImage';

const WANT = 36;

export default function SignupSphere() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // The sphere's own rotation was gated and these three entrances were
  // not, which read as an oversight rather than a decision.
  // `initial={false}` starts them at their final state.
  const reduced = useReducedMotion();
  const from = (v) => (reduced ? false : v);
  const { allRentals: rentals, allBusinesses: businesses, loaded } = useHomeShowcase();
  const boxRef = React.useRef(null);
  const [size, setSize] = React.useState(420);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => setSize(Math.max(220, Math.min(640, Math.floor(Math.min(el.clientWidth, el.clientHeight)))));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const images = React.useMemo(() => {
    const r = (rentals || []).map((p) => ({ id: `p-${p.id}`, src: sizedImage(propertyPhoto(p), 240), alt: p.title || '', title: p.title || '', href: `/property/${p.id}` }));
    const b = (businesses || []).map((g) => ({ id: `b-${g.id}`, src: sizedImage(getGigCover(g), 240), alt: g.title || '', title: g.title || '', href: `/businesses/${g.id}` }));
    // Alternate homes and businesses, one circle per picture: the same
    // file under a different transform is still the same picture.
    const seen = new Set();
    const out = [];
    for (let i = 0; out.length < WANT && (i < r.length || i < b.length); i += 1) {
      for (const it of [r[i], b[i]]) {
        const key = it && it.src ? it.src.split('/').pop().split('?')[0] : '';
        if (!key || seen.has(key) || out.length >= WANT) continue;
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  }, [rentals, businesses]);

  return (
    <div
      className="relative flex h-full flex-col overflow-clip rounded-2xl p-8 xl:p-10"
      // White with a mist of the accent blue behind the sphere (Tzvi, 7 Oct
      // 2026, option D: the black-to-navy panel was "too dark, my site is
      // lighter"). Ink text, white-rimmed photos.
      style={{
        background: 'radial-gradient(60% 55% at 50% 68%, rgba(36,175,235,0.28), transparent 70%), #FFFFFF',
        color: 'var(--ink, #111827)',
        boxShadow: 'inset 0 0 0 1px #E3E3E3',
      }}
      data-testid="signup-sphere-panel"
    >
      {/* The card is one screen tall now, so the panel is too and nothing
          needs to stick (it did while the form ran longer than a screen). */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <div className="max-w-[460px]">
        <motion.p
          initial={from({ opacity: 0, y: 12, filter: 'blur(6px)' })}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#0F5E8F' }}
        >
          {t('signupJoin.sphereEyebrow', 'Already on the site')}
        </motion.p>
        <motion.blockquote
          initial={from({ opacity: 0, y: 18, filter: 'blur(8px)' })}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 text-2xl font-light leading-tight tracking-[-0.02em] xl:text-[1.75rem]"
          style={{ fontFamily: 'var(--font-head)' }}
        >
          {t('signupJoin.sphereQuote', 'Every circle is a home or a business listed here right now. Turn it, tap one.')}
        </motion.blockquote>
      </div>

      <div ref={boxRef} className="relative z-10 mt-4 flex min-h-[220px] flex-1 items-center justify-center">
        {loaded && images.length > 0 ? (
          <motion.div
            initial={from({ opacity: 0, scale: 0.9 })}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <SphereImageGrid
              images={images}
              containerSize={size}
              autoRotate
              autoRotateSpeed={0.18}
              dragSensitivity={0.6}
              momentumDecay={0.96}
              baseImageScale={0.16}
              onOpen={(img) => img.href && navigate(img.href)}
              label={t('signupJoin.sphereLabel', 'Homes and businesses listed on MyIsraelRental. Use the arrow keys to turn it.')}
              data-testid="signup-sphere"
            />
          </motion.div>
        ) : (
          <div className="h-48 w-48 rounded-full border border-[#E3E3E3]" aria-hidden="true" />
        )}
      </div>
      </div>
    </div>
  );
}
