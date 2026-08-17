/**
 * FeaturedProviders — the "Featured near you" row section from
 * services-preview.html's `.pcard` list.
 *
 * "Featured" means an admin flagged this gig, nothing else. It is not the
 * highest-rated, not the nearest, and not a paid placement — every listed
 * provider already pays, so a plan check would feature everyone. The flag
 * is set through an admin-only endpoint (PATCH /marketplace/gigs/{id}/
 * featured); providers cannot set it on themselves.
 *
 * Renders NOTHING when no gigs are flagged. An empty "Featured near you"
 * heading would advertise that we have no recommendations, and on a
 * marketplace this size that is the most likely state for a while.
 *
 * Two departures from the preview, both for lack of data:
 *   • no "✓ Verified" badge — there is no verification feature yet (see
 *     the TODO in backend/routes/marketplace/shared.py);
 *   • the rating badge reads "4.9 · 132 reviews", not "132 jobs".
 *     `rating_count` counts reviews. Jobs completed is a different number
 *     we do not store, and it would be a larger, flattering one.
 */
import React from 'react';
import { Star, MessageCircle } from 'lucide-react';
// Same helpers the results grid uses, so a gig doesn't get a different
// cover image or an untranslated title just because it's featured.
import { getGigCover } from '../../utils/gigAvailability';
import { localizedTitle } from '../../utils/gigLocale';

const FeaturedProviders = ({ gigs, coords, onOpen, t, i18n }) => {
  if (!gigs || gigs.length === 0) return null;

  return (
    <section
      className="max-w-6xl mx-auto px-4 pt-4 pb-10"
      data-testid="services-featured"
    >
      <div className="section-rhead flex items-baseline justify-between gap-4 mb-5">
        {/* "near you" only when we actually know where the visitor is.
            Without coords the phrase is a claim we can't support, so the
            heading falls back to plain "Featured services". */}
        <h2 className="text-gray-900">
          {coords
            ? t('services.featuredNearYou', 'Featured near you')
            : t('services.featuredTitle', 'Featured services')}
        </h2>
        <span className="section-rhead-note">
          {t('services.featuredSubtitle', 'Hand-picked by our team')}
        </span>
      </div>

      <div className="flex flex-col gap-[14px]">
        {gigs.map((gig) => {
          const cover = getGigCover(gig);
          const rating = gig.rating_avg;
          const reviews = gig.rating_count || 0;
          return (
            <div
              key={gig.id}
              className="svc-row"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(gig.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpen(gig.id); }}
              data-testid={`services-featured-row-${gig.id}`}
            >
              <div
                className="svc-row-ph"
                style={cover ? { backgroundImage: `url('${cover}')` } : undefined}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h4 className="truncate">{localizedTitle(gig, i18n)}</h4>
                <div className="svc-row-sub truncate">
                  {gig.area}
                  {typeof gig.distance_km === 'number' && (
                    <> · {gig.distance_km < 1
                      ? `${Math.round(gig.distance_km * 1000)} m`
                      : `${gig.distance_km.toFixed(gig.distance_km < 10 ? 1 : 0)} km`}</>
                  )}
                </div>
                {/* Only rendered when the gig actually has reviews — a
                    "0 reviews" badge on a featured provider reads worse
                    than no badge at all. */}
                {rating != null && reviews > 0 && (
                  <div className="svc-row-badges">
                    <span className="svc-badge-rating inline-flex items-center gap-1">
                      <Star size={11} fill="currentColor" aria-hidden="true" />
                      {rating} · {t('services.reviewsCount', '{{count}} reviews', { count: reviews })}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpen(gig.id); }}
                className="btn-blue-solid inline-flex items-center gap-1.5"
                data-testid={`services-featured-message-${gig.id}`}
              >
                <MessageCircle size={14} aria-hidden="true" />
                {t('services.message', 'Message')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FeaturedProviders;
