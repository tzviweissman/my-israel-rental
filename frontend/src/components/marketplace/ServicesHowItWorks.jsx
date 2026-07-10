/**
 * "How it works" strip that sits directly below the Services hero.
 *
 * Three 8–15s stock clips playing on loop side-by-side, each labelled with
 * a step: post a job → get quotes → book & relax. This is the highest-
 * converting pattern for reverse marketplaces (Fiverr / Thumbtack / Bark)
 * because it collapses the entire user story into ~30 seconds of visual
 * proof before the visitor has to read anything.
 *
 * Uses the same "poster + inline muted autoplay + prefers-reduced-motion
 * fallback" contract as RotatingHeroVideo, so the two components feel
 * consistent when scrolling from hero → strip.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Sparkles, KeyRound } from 'lucide-react';

const STEPS = [
  {
    key: 'post',
    Icon: MessageSquare,
    src: '/videos/services-hero/step1-post.mp4',
    poster: '/videos/services-hero/step1-post-poster.jpg',
    titleKey: 'services.howItWorks.step1.title',
    titleDefault: 'Post a job',
    descKey: 'services.howItWorks.step1.desc',
    descDefault:
      'Describe what you need in a few words — from wherever you are. Free, no account needed to browse.',
  },
  {
    key: 'quotes',
    Icon: Sparkles,
    src: '/videos/services-hero/step2-quotes.mp4',
    poster: '/videos/services-hero/step2-quotes-poster.jpg',
    titleKey: 'services.howItWorks.step2.title',
    titleDefault: 'Get quotes',
    descKey: 'services.howItWorks.step2.desc',
    descDefault:
      'Trusted local providers apply with real prices and reply times — usually within a few hours.',
  },
  {
    key: 'book',
    Icon: KeyRound,
    src: '/videos/services-hero/step3-book.mp4',
    poster: '/videos/services-hero/step3-book-poster.jpg',
    titleKey: 'services.howItWorks.step3.title',
    titleDefault: 'Book & relax',
    descKey: 'services.howItWorks.step3.desc',
    descDefault:
      'Pick your favourite, chat directly, and enjoy the outcome. Zero renter fees, ever.',
  },
];

function StepCard({ step, index, reducedMotion }) {
  const { t } = useTranslation();
  const { Icon } = step;

  return (
    <article
      className="group relative flex-1 rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
      data-testid={`how-it-works-step-${step.key}`}
    >
      {/* Video frame — 16:9 to keep the visual weight balanced across cards */}
      <div className="relative aspect-video overflow-hidden bg-[#F1EFEA]">
        {reducedMotion ? (
          <img
            src={step.poster}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={step.src}
            poster={step.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
        )}
        {/* Subtle bottom fade so the step number always reads. */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
        {/* Step number chip — anchored bottom-left inside the video frame */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-[#1E6A6A] text-xs font-semibold shadow-sm">
          <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <Icon size={13} strokeWidth={2.5} />
        </div>
      </div>

      {/* Copy */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-[#0F3A3A] mb-1.5">
          {t(step.titleKey, step.titleDefault)}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          {t(step.descKey, step.descDefault)}
        </p>
      </div>
    </article>
  );
}

export default function ServicesHowItWorks() {
  const { t } = useTranslation();

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

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
            className="text-2xl md:text-3xl font-bold text-[#0F3A3A] leading-tight"
            style={{ fontFamily: 'Playfair Display' }}
          >
            {t(
              'services.howItWorks.title',
              'From "I need help" to "it\'s done" in 3 steps'
            )}
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.key}
              step={step}
              index={i}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
