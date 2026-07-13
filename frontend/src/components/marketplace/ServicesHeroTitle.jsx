/**
 * ServicesHeroTitle — 4 elegant headline treatments.
 *
 * Reads ``?hero=v1|v2|v3|v4`` from the URL so the client can preview
 * each variant against real content without a code deploy. Defaults
 * to ``v2`` (my strongest pick — Playfair italic emphasis, most
 * premium/Mediterranean).
 *
 * All variants share:
 *   • Deep-teal ink (#0F3A3A) as the primary text colour;
 *   • Gold (#D4AF37) reserved for accents only;
 *   • Inter for body + supporting text, Playfair for the emphasis
 *     word (in the variants that use one);
 *   • Zero heavy fills or thick underlines — every accent is a
 *     hairline, brushstroke, or low-opacity glow.
 */
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const INTER = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PLAYFAIR = "'Playfair Display', Georgia, serif";
const INK = '#0F3A3A';
const GOLD = '#D4AF37';
const TEAL = '#1E6A6A';

// Small helper reading the ?hero= param without pulling in a full
// query-string lib. Falls back to v2 when the param is missing / bogus.
const useHeroVariant = () => {
  const { search } = useLocation();
  const v = new URLSearchParams(search).get('hero');
  return ['v1', 'v2', 'v3', 'v4'].includes(v) ? v : 'v2';
};

/* ─────────────────────────────────────────────────────────────
   V1 — "Architectural hairline"
   Editorial, restrained. Single H1 with a very thin 2-stop
   gold→teal hairline running under the second line — the kind of
   detail you'd see on a Piaget or Aman product page. No box, no
   fill. Small dot pair on either side of the hairline acts as
   a Mediterranean serif "rule" flourish.
   ───────────────────────────────────────────────────────────── */
const V1 = ({ t }) => (
  <div data-testid="services-hero-title-v1">
    <div
      className="text-[10px] md:text-[11px] font-semibold uppercase mb-4 md:mb-5"
      style={{
        fontFamily: INTER,
        letterSpacing: '0.32em',
        color: TEAL,
      }}
    >
      {t('services.heroEyebrow', 'The MyIsraelRental Marketplace')}
    </div>
    <h1
      className="text-3xl sm:text-4xl md:text-5xl leading-[1.1] mb-3"
      style={{
        fontFamily: INTER,
        fontWeight: 700,
        letterSpacing: '-0.025em',
        color: INK,
      }}
      data-testid="services-hero-title"
    >
      {t('services.heroTitleAccent', 'Hire proven talent')}
      <br />
      <span style={{ fontFamily: PLAYFAIR, fontWeight: 400, fontStyle: 'italic' }}>
        {t('services.heroTitleTail', 'who deliver')}
      </span>
    </h1>
    {/* Architectural hairline — 2 stops (gold → teal). 1 px, 96 px
        wide, centered under the second line with a dot on each end. */}
    <div className="flex items-center justify-center gap-2 mt-2 mb-1">
      <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
      <span
        className="block h-px w-24"
        style={{
          background: `linear-gradient(90deg, ${GOLD} 0%, ${TEAL} 100%)`,
        }}
      />
      <span className="w-1 h-1 rounded-full" style={{ background: TEAL }} />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   V2 — "Playfair italic emphasis" (default)
   The Mediterranean-luxury classic. Sans on line 1, italic serif
   for the emotional word ("proven"). Behind "proven" sits a soft
   overlapping ellipse — teal→gold radial at ~12% opacity — which
   reads as "a warm halo" rather than a highlight. No hard edges.
   ───────────────────────────────────────────────────────────── */
const V2 = ({ t }) => (
  <div data-testid="services-hero-title-v2" className="relative inline-block">
    <div
      className="text-[10px] md:text-[11px] font-semibold uppercase mb-4 md:mb-5"
      style={{
        fontFamily: INTER,
        letterSpacing: '0.32em',
        color: TEAL,
      }}
    >
      {t('services.heroEyebrow', 'The MyIsraelRental Marketplace')}
    </div>
    <h1
      className="relative text-3xl sm:text-4xl md:text-5xl leading-[1.1]"
      style={{
        fontFamily: INTER,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: INK,
      }}
      data-testid="services-hero-title"
    >
      Hire{' '}
      <span className="relative inline-block">
        {/* Soft overlapping halo — radial gradient (teal → gold),
            positioned behind the italic word. Uses ``translate``
            offsets so it doesn't affect layout. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-4 -inset-y-2 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 30% 50%, rgba(30,106,106,0.14) 0%, rgba(212,175,55,0.14) 55%, rgba(255,255,255,0) 75%)',
            filter: 'blur(8px)',
          }}
        />
        <span
          className="relative italic"
          style={{
            fontFamily: PLAYFAIR,
            fontWeight: 400,
            color: '#0F3A3A',
          }}
        >
          proven
        </span>
      </span>{' '}
      talent
      <br />
      <span
        style={{
          fontFamily: INTER,
          fontWeight: 500,
          color: '#3B4A4A',
        }}
      >
        who deliver
      </span>
    </h1>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   V3 — "Diagonal brushstroke"
   Editorial magazine feel. Inter H1, gold hand-drawn brush SVG
   under the word "talent", with a very soft teal drop-glow so the
   gold has depth. The brush is offset ~4px below the baseline and
   ~10% wider than the word — asymmetry is intentional.
   ───────────────────────────────────────────────────────────── */
const V3 = ({ t }) => (
  <div data-testid="services-hero-title-v3">
    <div
      className="text-[10px] md:text-[11px] font-semibold uppercase mb-4 md:mb-5"
      style={{
        fontFamily: INTER,
        letterSpacing: '0.32em',
        color: TEAL,
      }}
    >
      {t('services.heroEyebrow', 'The MyIsraelRental Marketplace')}
    </div>
    <h1
      className="text-3xl sm:text-4xl md:text-5xl leading-[1.1]"
      style={{
        fontFamily: INTER,
        fontWeight: 700,
        letterSpacing: '-0.025em',
        color: INK,
      }}
      data-testid="services-hero-title"
    >
      Hire proven{' '}
      <span className="relative inline-block">
        talent
        {/* Hand-drawn gold brush underline SVG. The path is a rough
            asymmetric curve so it reads as ink, not a rule. Teal
            drop-glow via `filter` gives it warmth without adding
            a second element. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 220 24"
          preserveAspectRatio="none"
          className="absolute left-[-6%] right-[-4%] -bottom-2 h-3 w-[110%] pointer-events-none"
          style={{ filter: 'drop-shadow(0 1px 3px rgba(30,106,106,0.25))' }}
        >
          <path
            d="M 6 14 C 40 4, 80 22, 120 12 S 200 6, 214 14"
            fill="none"
            stroke={GOLD}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      </span>
      <br />
      <span
        style={{
          fontFamily: PLAYFAIR,
          fontWeight: 400,
          fontStyle: 'italic',
          color: TEAL,
        }}
      >
        who deliver
      </span>
    </h1>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   V4 — "Split serif / sans with ornament"
   The most old-world / Mediterranean of the four. Line 1 is Inter
   in ink. Line 2 is Playfair italic in warm gold, flanked by two
   thin teal rules and a tiny diamond ornament — the kind of layout
   used by heritage hotel brands like Belmond or Rosewood.
   ───────────────────────────────────────────────────────────── */
const V4 = ({ t }) => (
  <div data-testid="services-hero-title-v4">
    <h1
      className="text-3xl sm:text-4xl md:text-5xl leading-[1.15]"
      style={{
        fontFamily: INTER,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: INK,
      }}
      data-testid="services-hero-title"
    >
      Hire proven talent
    </h1>
    {/* Ornament row: thin teal rule · diamond · italic gold serif
        · diamond · thin teal rule. Everything is inline-flex so it
        stays centered and wraps gracefully on mobile. */}
    <div className="mt-4 md:mt-5 flex items-center justify-center gap-3 md:gap-4">
      <span
        className="h-px w-8 md:w-12"
        style={{ background: TEAL, opacity: 0.35 }}
      />
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rotate-45"
        style={{ background: GOLD }}
      />
      <span
        className="text-xl md:text-2xl italic"
        style={{
          fontFamily: PLAYFAIR,
          fontWeight: 400,
          color: '#8A6D1D',
        }}
      >
        who deliver
      </span>
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rotate-45"
        style={{ background: GOLD }}
      />
      <span
        className="h-px w-8 md:w-12"
        style={{ background: TEAL, opacity: 0.35 }}
      />
    </div>
  </div>
);

export default function ServicesHeroTitle() {
  const { t } = useTranslation();
  const variant = useHeroVariant();
  if (variant === 'v1') return <V1 t={t} />;
  if (variant === 'v3') return <V3 t={t} />;
  if (variant === 'v4') return <V4 t={t} />;
  return <V2 t={t} />;
}
