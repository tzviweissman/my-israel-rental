/**
 * Public provider profile — /services/provider/:userId.
 * Bio, tagline, subscription "active" badge, plus all published gigs.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, BadgeCheck, ArrowLeft } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="provider-profile">
      <PageMeta title={`${data.name} — Services on MyIsraelRental`} description={data.tagline || data.bio?.slice(0, 155) || `Services from ${data.name}`} path={`/services/provider/${userId}`} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/services')} className="text-sm text-gray-600 flex items-center gap-1 mb-4 hover:text-[#1E6A6A]">
          <ArrowLeft size={14} /> Back to services
        </button>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-200 shrink-0" style={data.avatar ? { backgroundImage: `url(${data.avatar})`, backgroundSize: 'cover' } : {}} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>{data.name}</h1>
              {data.active && <BadgeCheck size={18} className="text-[#1E6A6A]" />}
            </div>
            {data.tagline && <p className="text-gray-600 text-sm">{data.tagline}</p>}
          </div>
        </div>
        {data.bio && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-2">About</h2>
            <p className="text-gray-700 whitespace-pre-line">{data.bio}</p>
          </div>
        )}
        <h2 className="text-lg font-bold mb-4">Services ({data.gigs.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-8">
          {data.gigs.map((g) => {
            const cover = g.gallery?.[0];
            const cheap = (g.tiers || []).reduce((a, t) => (a == null || t.price < a ? t.price : a), null);
            const sym = g.tiers?.[0]?.currency === 'USD' ? '$' : '₪';
            return (
              <button key={g.id} onClick={() => navigate(`/services/gig/${g.id}`)} className="text-left" data-testid={`provider-gig-${g.id}`}>
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
