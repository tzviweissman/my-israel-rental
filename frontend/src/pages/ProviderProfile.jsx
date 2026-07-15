/**
 * Public provider profile — /services/provider/:userId.
 * Bio, tagline, subscription "active" badge, plus all published gigs.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, BadgeCheck, ArrowLeft, Calendar, Globe, Award, FileText, Zap, ExternalLink } from 'lucide-react';
import { API } from '../App';
import PageMeta from '../components/PageMeta';
import StarRating from '../components/marketplace/StarRating';

const ProviderProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/marketplace/providers/${userId}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Provider not found'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-32"><Loader2 className="animate-spin text-[#1E6A6A]" size={28} /></div>;
  if (!data) return null;

  // Return to wherever the visitor came from — the filtered /services
  // listing or the gig detail page whose "View profile" link brought them
  // here (both save path+search to previousPath) — falling back to the
  // unfiltered page for direct/shared links.
  const previousPath = sessionStorage.getItem('previousPath') || '/services';
  const backDestination = previousPath.startsWith('/services') ? previousPath : '/services';

  // LocalBusiness schema: emits enough structured data for Google to show
  // avatar, aggregate rating, and price ranges directly in the search
  // snippet. Aggregate rating is computed across all this provider's gigs.
  const ratedGigs = (data.gigs || []).filter((g) => g.rating_count > 0);
  const totalReviews = ratedGigs.reduce((n, g) => n + g.rating_count, 0);
  const weightedRating = totalReviews > 0
    ? ratedGigs.reduce((n, g) => n + (g.rating_avg * g.rating_count), 0) / totalReviews
    : null;
  const priceValues = (data.gigs || []).flatMap((g) => (g.tiers || []).map((t) => t.price)).filter((p) => typeof p === 'number');
  const providerJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://myisraelrental.com/services/provider/${userId}`,
    name: data.name,
    image: data.avatar,
    description: (data.bio || data.tagline || '').slice(0, 500),
    url: `https://myisraelrental.com/services/provider/${userId}`,
    telephone: data.whatsapp,
    areaServed: 'Israel',
    ...(priceValues.length > 0 && {
      priceRange: `${Math.min(...priceValues)}–${Math.max(...priceValues)} ILS`,
    }),
    ...(totalReviews > 0 && weightedRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.round(weightedRating * 10) / 10,
        reviewCount: totalReviews,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="provider-profile">
      <PageMeta title={`${data.name} — Services on MyIsraelRental`} description={data.tagline || data.bio?.slice(0, 155) || `Services from ${data.name}`} path={`/services/provider/${userId}`} jsonLd={providerJsonLd} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate(backDestination)} className="text-sm text-gray-600 flex items-center gap-1 mb-4 hover:text-[#1E6A6A]">
          <ArrowLeft size={14} /> Back to services
        </button>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-200 shrink-0" style={data.avatar ? { backgroundImage: `url(${data.avatar})`, backgroundSize: 'cover' } : {}} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>{data.name}</h1>
              {data.active && <BadgeCheck size={18} className="text-[#1E6A6A]" />}
            </div>
            {data.tagline && <p className="text-gray-600 text-sm">{data.tagline}</p>}
          </div>
        </div>

        {/* Trust strip — Member since, response time, spoken languages.
            Rendered above the About section so the credibility signals
            hit renters first, before they read the bio prose. Each cell
            silently omits itself when the data is missing so new
            providers don't render a half-empty grid. */}
        {(data.member_since_year || data.response_bucket || (data.languages && data.languages.length > 0)) && (
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 rounded-2xl bg-white border border-gray-200"
            data-testid="provider-trust-strip"
          >
            {data.member_since_year && (
              <div className="flex items-start gap-2.5" data-testid="provider-member-since">
                <Calendar size={16} className="text-[#1E6A6A] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Member since</p>
                  <p className="text-sm font-semibold text-gray-900">{data.member_since_year}</p>
                </div>
              </div>
            )}
            {data.response_bucket && (
              <div className="flex items-start gap-2.5" data-testid="provider-response-bucket">
                <Zap size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Response time</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {data.response_bucket === '1h' ? 'Replies in 1h' : 'Replies in 24h'}
                  </p>
                </div>
              </div>
            )}
            {data.languages && data.languages.length > 0 && (
              <div className="flex items-start gap-2.5" data-testid="provider-languages">
                <Globe size={16} className="text-[#1E6A6A] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Speaks</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {data.languages.join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {data.bio && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-2">About</h2>
            <p className="text-gray-700 whitespace-pre-line">{data.bio}</p>
          </div>
        )}

        {/* Credentials & licenses — free-text professional info + optional
            uploaded document links. No admin verification (per the Phase 3
            spec) — rendered verbatim so renters can decide for themselves.
            Provider still gets to display "MoT license #123 · CPR cert"
            style social proof without waiting on manual review. */}
        {(data.credentials || (data.credential_docs && data.credential_docs.length > 0)) && (
          <div className="mb-8" data-testid="provider-credentials-section">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Award size={18} className="text-[#D4AF37]" />
              Credentials &amp; licenses
            </h2>
            {data.credentials && (
              <p className="text-gray-700 whitespace-pre-line mb-3" data-testid="provider-credentials-text">
                {data.credentials}
              </p>
            )}
            {data.credential_docs && data.credential_docs.length > 0 && (
              <ul className="space-y-1.5" data-testid="provider-credential-docs">
                {data.credential_docs.map((doc, i) => (
                  <li key={i}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#1E6A6A] hover:underline font-medium"
                      data-testid={`provider-credential-doc-${i}`}
                    >
                      <FileText size={14} />
                      {doc.label || 'View document'}
                      <ExternalLink size={11} className="opacity-60" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <h2 className="text-lg font-bold mb-4">Services ({data.gigs.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-8">
          {data.gigs.map((g) => {
            const cover = g.gallery?.[0];
            const cheap = (g.tiers || []).reduce((a, t) => (a == null || t.price < a ? t.price : a), null);
            const sym = g.tiers?.[0]?.currency === 'USD' ? '$' : '₪';
            return (
              <button
                key={g.id}
                onClick={() => {
                  // So the gig's "Back to services" returns to this provider page.
                  sessionStorage.setItem('previousPath', window.location.pathname + window.location.search);
                  navigate(`/services/gig/${g.id}`);
                }}
                className="text-left"
                data-testid={`provider-gig-${g.id}`}
              >
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-2" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
                <p className="font-semibold text-sm truncate">{g.title}</p>
                {g.rating_count > 0 && (
                  <div className="mt-0.5">
                    <StarRating value={g.rating_avg || 0} count={g.rating_count} size={12} testidPrefix={`provider-gig-stars-${g.id}`} />
                  </div>
                )}
                {cheap != null && <p className="text-xs text-gray-900"><span className="text-gray-500">from </span><span className="font-semibold">{sym}{cheap.toLocaleString()}</span></p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProviderProfile;
