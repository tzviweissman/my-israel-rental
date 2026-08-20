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
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Star, BadgeCheck, MapPin, Loader2 } from 'lucide-react';
import { API } from '../App';
import PageMeta from '../components/PageMeta';
import CoverPlaceholder from '../components/common/CoverPlaceholder';
import { getGigCover } from '../utils/gigAvailability';

const BusinessPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="business-page">
      <PageMeta
        title={`${biz.name} — MyIsraelRental`}
        description={biz.description?.slice(0, 155) || `${biz.name} on MyIsraelRental.`}
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
                ) : (
                  <span data-testid="business-no-reviews">
                    {t('businessPage.noReviews', 'No reviews yet')}
                  </span>
                )}
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
      </div>
    </div>
  );
};

export default BusinessPage;
