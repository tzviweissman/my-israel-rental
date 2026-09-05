/**
 * The dark half of the sign-up page: a turning sphere of what is on the
 * site right now, businesses and homes alike, every circle a real page.
 *
 * Tzvi: "add to the black side this img sphere with businesses and
 * rentals in them". The photos come from useHomeShowcase, the same
 * source as the home page's corridor, so nothing here is stock and
 * nothing is invented; when the site has fewer than the sphere wants,
 * the list repeats rather than showing gaps, and a repeat is marked in
 * its alt text so a screen reader is not told there are two.
 *
 * The source's "fluted glass" background was a WebGL shader from a
 * package this project does not carry. Vertical flutes in CSS - a
 * repeating gradient over a black-to-deep-blue ground - give the same
 * ribbed sheen with no dependency and no GPU requirement, and they hold
 * under `prefers-reduced-motion` because they do not move.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

import SphereImageGrid from '../ui/img-sphere';
import useHomeShowcase, { propertyPhoto } from '../home/useHomeShowcase';
import { getGigCover } from '../../utils/gigAvailability';
import { sizedImage } from '../../utils/cdnImage';

const WANT = 36;

export default function SignupSphere() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { rentals, businesses, loaded } = useHomeShowcase();
  const boxRef = React.useRef(null);
  const [size, setSize] = React.useState(420);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => setSize(Math.max(280, Math.min(640, Math.floor(Math.min(el.clientWidth, el.clientHeight)))));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const images = React.useMemo(() => {
    const r = (rentals || []).map((p) => ({ id: `p-${p.id}`, src: sizedImage(propertyPhoto(p), 240), alt: p.title || '', title: p.title || '', href: `/property/${p.id}` }));
    const b = (businesses || []).map((g) => ({ id: `b-${g.id}`, src: sizedImage(getGigCover(g), 240), alt: g.title || '', title: g.title || '', href: `/businesses/${g.id}` }));
    const base = [];
    for (let i = 0; base.length < 24 && (i < r.length || i < b.length); i += 1) {
      if (r[i]) base.push(r[i]);
      if (b[i]) base.push(b[i]);
    }
    if (!base.length) return [];
    const out = [];
    for (let i = 0; out.length < WANT; i += 1) {
      const it = base[i % base.length];
      const round = Math.floor(i / base.length);
      out.push(round ? { ...it, id: `${it.id}-${round}`, alt: `${it.alt} (${round + 1})` } : it);
    }
    return out;
  }, [rentals, businesses]);

  return (
    <div
      className="relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-md p-8 text-white sm:p-12 lg:p-14"
      style={{
        background:
          'linear-gradient(180deg, #000 0%, #0F5E8F 140%)',
      }}
      data-testid="signup-sphere-panel"
    >
      {/* the flutes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.02) 6px, rgba(0,0,0,0.25) 12px, rgba(255,255,255,0.05) 18px)',
          mixBlendMode: 'overlay',
          opacity: 0.9,
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 60%, rgba(28,141,212,0.35), transparent 70%)' }} />

      <div className="relative z-10 max-w-[460px]">
        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60"
        >
          {t('signupJoin.sphereEyebrow', 'Already on the site')}
        </motion.p>
        <motion.blockquote
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 text-2xl font-light leading-tight tracking-[-0.02em] text-white/90 sm:text-3xl"
          style={{ fontFamily: 'var(--font-head)' }}
        >
          {t('signupJoin.sphereQuote', 'Every circle is a home or a business listed here right now. Turn it, tap one.')}
        </motion.blockquote>
      </div>

      <div ref={boxRef} className="relative z-10 mt-6 flex min-h-[320px] flex-1 items-center justify-center">
        {loaded && images.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
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
              data-testid="signup-sphere"
            />
          </motion.div>
        ) : (
          <div className="h-48 w-48 rounded-full border border-white/10" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
