import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Heart, MapPin, Bed, Bath } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Renter's "Liked Properties" dashboard tab.
 * Self-contained: owns its own fetch + unlike state.
 */
const LikedTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [likedProperties, setLikedProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLiked = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/liked-properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLikedProperties(res.data || []);
    } catch (err) {
      console.error('Failed to fetch liked properties', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlikeProperty = async (propertyId) => {
    try {
      await axios.post(`${API}/properties/${propertyId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLikedProperties((prev) => prev.filter((p) => p.id !== propertyId));
      toast.success('Removed from favorites');
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  const imageUrl = (p) => {
    const first = p.images?.[0];
    if (!first) {
      return 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
    }
    return first.startsWith('/api') ? `${API.replace('/api', '')}${first}` : first;
  };

  return (
    <div className="space-y-6" data-testid="liked-tab">
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
        Liked Properties
      </h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-[3px] border-[#1E6A6A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : likedProperties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Heart size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg font-medium">No saved properties yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-5">
            Browse listings and tap the heart to save your favorites.
          </p>
          <button
            onClick={() => navigate('/stays')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-md"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="browse-properties-btn"
          >
            Browse Properties
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {likedProperties.map((property) => (
            <div
              key={property.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
              data-testid={`liked-property-${property.id}`}
            >
              <div
                className="h-44 bg-gray-200 relative"
                style={{
                  backgroundImage: `url(${imageUrl(property)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onClick={() => navigate(`/property/${property.id}`)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unlikeProperty(property.id);
                  }}
                  className="absolute top-3 end-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95 z-10"
                  data-testid={`unlike-btn-${property.id}`}
                >
                  <Heart size={18} className="fill-red-500 text-red-500" />
                </button>
                <div className="absolute bottom-3 start-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/90 text-gray-700 backdrop-blur-sm">
                    {property.rental_type?.replace('-', ' ')}
                  </span>
                </div>
              </div>
              <div className="p-4" onClick={() => navigate(`/property/${property.id}`)}>
                <h3 className="text-base font-bold text-gray-900 mb-1 truncate">{property.title}</h3>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-3">
                  <MapPin size={14} />
                  <span className="truncate">{property.area}</span>
                </div>
                <div className="flex items-center gap-3 mb-3 text-xs text-gray-600">
                  {property.bedrooms > 0 && (
                    <span className="flex items-center gap-1"><Bed size={13} /> {property.bedrooms} bed</span>
                  )}
                  {property.bathrooms > 0 && (
                    <span className="flex items-center gap-1"><Bath size={13} /> {property.bathrooms} bath</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold" style={{ color: '#D4AF37' }}>
                    {property.currency === 'USD' ? '$' : '₪'}
                    {(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                    <span className="text-xs font-normal text-gray-500">
                      {property.rental_type === 'vacation' ? '/night' : '/mo'}
                    </span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/property/${property.id}`);
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#1E6A6A', backgroundColor: '#1E6A6A10' }}
                  >
                    View →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LikedTab;
