import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageMeta from '../components/PageMeta';

/**
 * Placeholder for the Requests board, which ships in Phase 3.
 *
 * It exists so the nav can carry its final set of links now rather than
 * being rebuilt when the board lands — the alternative was a "Requests"
 * item that 404s, or a nav that doesn't match the previews and has to be
 * revisited.
 *
 * Deliberately contains NO board functionality: no fetch, no filters, no
 * posting. Phase 3 replaces this component in place at the same route, so
 * anything speculative here is work thrown away — and worse, a half-built
 * board is the kind of thing that gets mistaken for a real one.
 *
 * `noindex` because a coming-soon page that gets indexed outranks the real
 * board for its own name later.
 */
const RequestsPlaceholder = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title={t('requests.metaTitle', 'Requests — MyIsraelRental')}
        description={t(
          'requests.metaDescription',
          'Post what you are looking for and let owners and local pros come to you. Coming soon to MyIsraelRental.',
        )}
        noindex
      />

      {/* Dark band, matching the previews' page-header treatment so this
          sits in the same chrome as every other page rather than looking
          like a stray error screen. */}
      <section
        className="relative flex items-center justify-center px-6 text-center"
        style={{
          minHeight: '68vh',
          paddingTop: 'calc(var(--nav-h, 68px) + 48px)',
          paddingBottom: '64px',
          background:
            'linear-gradient(160deg, var(--brand-primary-deep) 0%, var(--brand-primary) 55%, var(--brand-primary-dark) 100%)',
        }}
        data-testid="requests-placeholder"
      >
        <div className="max-w-2xl">
          <p
            className="mb-4 text-[11px] font-bold uppercase text-white/70"
            style={{ letterSpacing: '0.2em' }}
          >
            {t('requests.eyebrow', 'Coming soon')}
          </p>

          <h1
            className="text-3xl font-bold text-white sm:text-5xl"
            style={{ fontFamily: 'var(--font-head)', letterSpacing: '-0.5px' }}
          >
            {t('requests.title', 'Requests')}
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/85">
            {t(
              'requests.blurb',
              'Post what you are looking for — a 3-bed in Ramat Eshkol, a mover next week — and let owners and local pros come to you.',
            )}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/stays')}
              className="glass-pill w-full sm:w-auto"
              data-testid="requests-cta-stays"
            >
              {t('requests.ctaStays', 'Browse stays')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/services')}
              className="glass-pill w-full sm:w-auto"
              data-testid="requests-cta-services"
            >
              {t('requests.ctaServices', 'Browse services')}
            </button>
          </div>
        </div>
      </section>
    </>
  );
};

export default RequestsPlaceholder;
