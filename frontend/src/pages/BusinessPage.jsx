/**
 * The public page for one business (spec M4).
 *
 * There is deliberately no public page for a PERSON. What a customer
 * chooses is a business, and merging them would put a plumber's reviews
 * on a bakery — which is the same reason ratings and verification are
 * per business (M5).
 *
 * Reachable by slug or by id: the spec allows either as canonical and the
 * short-link table already points at /business/{id}, so both resolve and
 * neither will ever break.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Star, BadgeCheck, MapPin, Loader2, MessageCircle } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import CoverPlaceholder from '../components/common/CoverPlaceholder';
import { getGigCover } from '../utils/gigAvailability';

const BusinessPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useContext(AuthContext);
  const [biz, setBiz] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/marketplace/business/${encodeURIComponent(slug)}`);
        if (!cancelled) setBiz(data);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (missing) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center"
        style={{ background: 'var(--bg)' }}>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {t('businessPage.gone', 'This business is no longer listed')}
          </p>
          <button type="button" onClick={() => navigate('/businesses')}
            className="mt-4 text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
            {t('businessPage.browse', 'Browse businesses')}
          </button>
        </div>
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--brand-muted)' }} />
      </div>
    );
  }

  /* B1 — the page had no way to contact the business at all. A visitor
     who arrived from the owner's own flyer, liked what they saw and
     wanted to hire them had nothing to click; the only contact control
     on screen was the site-wide WhatsApp bubble, which reaches
     MyIsraelRental rather than the business.

     Chat-only by rule: the thread goes through the site, and no phone
     number or email appears here or in the API behind it.

     The conversation is keyed by the business's first listing because
     that is what the chat backend already resolves and labels with the
     business name — a thread keyed by anything else would arrive
     unlabelled in the owner's inbox. */
  const primaryListing = (biz.listings || [])[0];
  const canMessage = !!(primaryListing && biz.owner_user_id);

  const messageBusiness = () => {
    const here = `/business/${biz.slug || biz.id}`;
    if (!token) {
      // Comes straight back here after signing in, so the intent that
      // brought them is not lost on the way.
      navigate(`/auth/login?redirect=${encodeURIComponent(here)}`);
      return;
    }
    navigate(`/chat/${primaryListing.id}?with=${encodeURIComponent(biz.owner_user_id)}`);
  };

  const messageLabel = t('businessPage.message', 'Message');
  // member_since is the joining YEAR, already computed by the API.
  const isNewHere = String(biz.member_since || '') === String(new Date().getFullYear());

  // Real data only: fall back through what the business actually has
  // rather than inventing a line for it.
  const shareImage = biz.logo_url || (primaryListing ? getGigCover(primaryListing) : null) || undefined;
  const shareDescription =
    biz.description?.slice(0, 155)
    || [ (biz.categories || [])[0], (biz.areas || []).join(', ') ].filter(Boolean).join(' · ')
    || `${biz.name} on MyIsraelRental.`;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="business-page">
      {/* B2 — the picture a share card shows. Logo first, else the first
          listing's cover, else PageMeta's branded default.

          Caveat worth knowing: react-helmet writes these tags in the
          BROWSER, and WhatsApp's crawler does not run JavaScript. It is
          served the static index.html, so a link pasted into a chat still
          previews with the generic site title and logo no matter what is
          passed here. Fixing that needs the tags present in the HTML
          before any JS runs. This still helps in-app browsers and any
          scraper that executes scripts. */}
      <PageMeta
        title={`${biz.name} — MyIsraelRental`}
        description={shareDescription}
        image={shareImage}
        path={`/business/${biz.slug || biz.id}`}
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border bg-white p-5 mb-6"
          style={{ borderColor: 'var(--brand-border)' }}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
              {biz.logo_url
                ? <img src={biz.logo_url} alt="" className="w-full h-full object-cover" />
                : <CoverPlaceholder name={biz.name} category={(biz.categories || [])[0]} className="w-full h-full" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                {biz.name}
                {/* M5 — verification belongs to the BUSINESS. Someone
                    verified as a property owner is not thereby a verified
                    plumber, so this badge is never borrowed from the
                    person's own identity check. */}
                {biz.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: '#E3F3EA', color: '#1F8A50' }}
                    data-testid="business-verified">
                    <BadgeCheck size={13} /> {t('businessPage.verified', 'Verified')}
                  </span>
                )}
              </h1>

              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm"
                style={{ color: 'var(--brand-muted)' }}>
                {/* Stars for THIS business only. A five-star landlord must
                    not read as a five-star plumber. */}
                {biz.rating_count > 0 ? (
                  <span className="inline-flex items-center gap-1" data-testid="business-rating">
                    <Star size={14} style={{ color: 'var(--gold)' }} fill="currentColor" />
                    <strong style={{ color: 'var(--ink)' }}>{biz.rating_avg}</strong>
                    {t('businessPage.reviews', '({{n}} reviews)', { n: biz.rating_count })}
                  </span>
                ) : isNewHere ? (
                  /* B3 — the second line a visitor read used to be "No
                     reviews yet": the first fact learned about the
                     business was an absence, which is a poor opening and
                     is not information anyone needed. A business that
                     joined this year gets a neutral statement of fact
                     instead; one that joined earlier gets nothing, because
                     calling a year-old business "new" would be false. */
                  <span data-testid="business-new-here">
                    {t('businessPage.newHere', 'New on MyIsraelRental')}
                  </span>
                ) : null}
                {(biz.areas || []).length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {biz.areas.join(', ')}
                  </span>
                )}
              </div>

              {biz.description && (
                <p className="mt-3 text-sm" style={{ color: 'var(--ink)' }}>{biz.description}</p>
              )}
            </div>

            {/* Sits in the header so it is on screen the moment the page
                opens, without scrolling. Hidden on mobile, where the
                sticky bar below carries it instead of stacking two
                copies into the first screenful. */}
            {canMessage && (
              <div className="hidden sm:block shrink-0">
                <button
                    type="button"
                    onClick={messageBusiness}
                    className="btn-gold inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
                    data-testid="business-message-header"
                  >
                    <MessageCircle size={16} aria-hidden="true" /> {messageLabel}
                  </button>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--brand-muted)' }}>
          {t('businessPage.listings', 'What they offer')}
        </h2>

        {biz.listings.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="business-empty">
            {t('businessPage.nothingYet', 'Nothing listed yet.')}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {biz.listings.map((g) => {
              const cover = getGigCover(g);
              return (
                <button key={g.id} type="button" onClick={() => navigate(`/businesses/${g.id}`)}
                  className="text-start rounded-2xl border bg-white overflow-hidden hover:shadow-md transition-shadow"
                  style={{ borderColor: 'var(--brand-border)' }}
                  data-testid={`business-listing-${g.id}`}>
                  <div className="aspect-square">
                    {cover
                      ? <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <CoverPlaceholder name={g.title} category={g.category} className="w-full h-full" />}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{g.title}</p>
                    {g.cheapest_price != null && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                        {t('businessPage.from', 'from')} ₪{g.cheapest_price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Repeated for anyone who has read to the end — asking them to
            scroll back up to act is how intent gets lost. */}
        {canMessage && (
          <div className="mt-10 mb-24 sm:mb-10 flex justify-center">
            <button
                    type="button"
                    onClick={messageBusiness}
                    className="btn-gold inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
                    data-testid="business-message-bottom"
                  >
                    <MessageCircle size={16} aria-hidden="true" /> {messageLabel}
                  </button>
          </div>
        )}
      </div>

      {/* Mobile only: the header button is off screen for most of the
          page on a phone, so the action rides along instead. Padding for
          the home indicator on iOS, or it sits under the gesture bar. */}
      {canMessage && (
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t px-4 py-3"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--brand-border)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          }}
          data-testid="business-message-bar"
        >
          <button
            type="button"
            onClick={messageBusiness}
            className="btn-gold w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm"
            data-testid="business-message-sticky"
          >
            <MessageCircle size={16} aria-hidden="true" /> {messageLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessPage;
