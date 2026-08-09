import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import CinematicHero from '../components/home/CinematicHero';
import CinematicScenes from '../components/home/CinematicScenes';

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Read once, at the top, and handed down. Asking per-component invites the
  // video and the choreography to disagree about which mode they are in.
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="min-h-screen">
      {/* The description deliberately does NOT say "no broker fees" (it used
          to). MyIsraelRental charging no service fee says nothing about
          whether the owner or managing agent charges one — and some listings
          do carry an agent fee, shown on the listing page. Claiming otherwise
          in a search snippet sets an expectation the platform can't keep.
          Keep any claim here about OUR costs, not third parties'. */}
      <PageMeta
        title="MyIsraelRental — Find your perfect rental in Israel | Free to search"
        description="Browse long-term, short-term, and vacation rentals across Israel — free to search and contact owners directly. Listings in Jerusalem, Tel Aviv, Haifa and more, in English."
        path="/"
        jsonLd={[
          // Organization — surfaces the brand name + logo in Google's
          // knowledge-panel-style rich results.
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            '@id': 'https://myisraelrental.com/#organization',
            name: 'MyIsraelRental',
            url: 'https://myisraelrental.com',
            logo: 'https://myisraelrental.com/brand-logo.png',
            description: 'Find long-term, short-term, and vacation rentals across Israel. Free for renters, free for owners.',
            areaServed: { '@type': 'Country', name: 'Israel' },
          },
          // WebSite — lets Google show a sitelinks search box that
          // points straight into the /stays results page, dramatically
          // improving direct-from-SERP discoverability for brand searches.
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': 'https://myisraelrental.com/#website',
            name: 'MyIsraelRental',
            url: 'https://myisraelrental.com',
            publisher: { '@id': 'https://myisraelrental.com/#organization' },
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://myisraelrental.com/stays?area={search_term_string}',
              },
              'query-input': 'required name=search_term_string',
            },
            inLanguage: ['en', 'he'],
          },
        ]}
      />
      {/* Phase 2a — the page IS the cinematic sequence. Per the ruling,
          cinematic-preview.html is the home page; home-redesign-preview.html
          is a section library and is never built as a page.

          The old hero, featured rail and About/Cities blocks are gone: the
          scenes carry that content now, and keeping both would have left the
          page arguing with itself about what it is. */}
      {/* Establishing shot, then the pinned sequence. */}
      <CinematicHero reducedMotion={reducedMotion} />
      <CinematicScenes reducedMotion={reducedMotion} />

      {/* Limestone finale — the one light surface on the page, which is what
          makes it read as an ending rather than a sixth scene. */}
      <section className="finale">
        <div>
          <div className="kick">MyIsraelRental</div>
          <h2>
            {t('home.finale.h2', 'Rent a home. Hire the pros.')}
            <br />
            <span className="a">{t('home.finale.accent', 'One place for both.')}</span>
          </h2>
          <p>
            {t(
              'home.finale.p',
              'Fully bilingual (English + Hebrew), verified listings and reviews, on-platform chat — free to search for everyone, free to list for owners and pros.',
            )}
          </p>
          <div className="ctas">
            <button type="button" className="b-blue" onClick={() => navigate('/stays')}>
              {t('home.finale.ctaStays', 'Search rentals')}
            </button>
            <button type="button" className="b-gold" onClick={() => navigate('/requests')}>
              {t('home.finale.ctaRequest', 'Post a request')}
            </button>
          </div>
          <div className="strip">
            <span><b>1,200+</b> {t('home.finale.statRentals', 'active rentals')}</span>
            <span><b>19</b> {t('home.finale.statCities', 'cities')}</span>
            <span><b>450+</b> {t('home.finale.statPros', 'verified pros')}</span>
            <span><b>&#8362;0</b> {t('home.finale.statFees', 'service fees')}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;