/**
 * "How it works" strip below the Services hero.
 *
 * Text-only redesign (was previously three looping videos): three
 * translucent light-gold cards with a big numbered step chip, an icon,
 * a bold title, and a one-line description. Renders the same 3-step
 * narrative (post a job → get quotes → book & relax) but loads
 * instantly with zero bandwidth cost and works cleanly on every
 * viewport / connection speed / reduced-motion setting.
 *
 * The gold palette (`BRAND_GOLD` = #D4AF37) is anchored to the
 * emerald primary via low-alpha overlays so the strip reads as an
 * intentional accent inside the wider MyIsraelRental color story.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Sparkles, KeyRound } from 'lucide-react';

const STEPS = [
  {
    key: 'post',
    Icon: MessageSquare,
    titleKey: 'services.howItWorks.step1.title',
    titleDefault: 'Post a job',
    descKey: 'services.howItWorks.step1.desc',
    descDefault:
      'Describe what you need in a few words — from wherever you are. Free, no account needed to browse.',
  },
  {
    key: 'quotes',
    Icon: Sparkles,
    titleKey: 'services.howItWorks.step2.title',
    titleDefault: 'Get quotes',
    descKey: 'services.howItWorks.step2.desc',
    descDefault:
      'Trusted local providers apply with real prices and reply times — usually within a few hours.',
  },
  {
    key: 'book',
    Icon: KeyRound,
    titleKey: 'services.howItWorks.step3.title',
    titleDefault: 'Book & relax',
    descKey: 'services.howItWorks.step3.desc',
    descDefault:
      'Pick your favourite, chat directly, and enjoy the outcome. Zero renter fees, ever.',
  },
];

function StepCard({ step, index }) {
  const { t } = useTranslation();
  const { Icon } = step;
  const num = String(index + 1).padStart(2, '0');

  // Scroll-in animation: fade + rise 8px, staggered by index.
  // Uses IntersectionObserver so cards only animate when they actually
  // reach the viewport (matters on long service pages where the strip
  // starts below the fold). ``prefers-reduced-motion`` short-circuits
  // the animation to an instant reveal so we respect user OS settings.
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVisible(true); return undefined; }
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      className="group relative flex-1 rounded-2xl overflow-hidden p-6 md:p-7 transition-all duration-700 ease-out hover:-translate-y-0.5"
      // Layered background:
      //   1. Soft gold gradient (rgba so it stays translucent over
      //      whatever section BG sits behind us).
      //   2. Hairline gold border (rgba, not solid) so cards read as
      //      one visual family without shouting.
      // Enter animation is stacked via `translateY` — when hovered the
      // hover transform composes with the resting `translate(0,0)` and
      // stays clean because both use `transform` (not `top`/`margin`).
      style={{
        background:
          'linear-gradient(155deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.06) 55%, rgba(212,175,55,0.02) 100%)',
        border: '1px solid rgba(212,175,55,0.28)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -12px rgba(15,58,58,0.12)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transitionDelay: visible ? `${index * 120}ms` : '0ms',
        transitionProperty: 'opacity, transform, box-shadow',
      }}
      data-testid={`how-it-works-step-${step.key}`}
    >
      {/* Watermark step number — soft gold, sits behind the copy so
          the eye reads it as texture, not label. Kept large + light. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 -right-2 select-none font-bold leading-none tabular-nums"
        style={{
          fontFamily: 'Playfair Display',
          fontSize: '7rem',
          color: 'rgba(212,175,55,0.18)',
          letterSpacing: '-0.04em',
        }}
      >
        {num}
      </span>

      {/* Icon chip — small circle in the top-left, echoes the gold
          without competing with the watermark number. */}
      <div
        className="relative z-10 inline-flex items-center justify-center w-11 h-11 rounded-full mb-4 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105"
        style={{
          background: 'rgba(212,175,55,0.18)',
          border: '1px solid rgba(212,175,55,0.35)',
          color: '#8A6D1D',
        }}
      >
        <Icon size={19} strokeWidth={2.2} />
      </div>

      {/* Copy */}
      <div className="relative z-10">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1.5"
          style={{ color: '#8A6D1D' }}
        >
          <span className="tabular-nums">{num}</span> · Step
        </div>
        <h3
          className="text-xl md:text-2xl text-[#0F3A3A] mb-2 leading-tight tracking-tight"
          style={{
            fontFamily:
              "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.015em',
          }}
        >
          {t(step.titleKey, step.titleDefault)}
        </h3>
        <p className="text-sm md:text-[15px] text-gray-700 leading-relaxed">
          {t(step.descKey, step.descDefault)}
        </p>
      </div>
    </article>
  );
}

export default function ServicesHowItWorks() {
  const { t } = useTranslation();

  return (
    <section
      className="bg-[#FAFAF7] py-10 md:py-14 px-4"
      data-testid="services-how-it-works"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] text-xs font-semibold mb-3">
            <Sparkles size={12} strokeWidth={2.5} />
            {t('services.howItWorks.eyebrow', 'How it works')}
          </div>
          <h2
            className="text-2xl md:text-3xl text-[#0F3A3A] leading-tight tracking-tight"
            style={{
              fontFamily:
                "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            {t(
              'services.howItWorks.title',
              'From "I need help" to "it\'s done" in 3 steps'
            )}
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {STEPS.map((step, i) => (
            <StepCard key={step.key} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
