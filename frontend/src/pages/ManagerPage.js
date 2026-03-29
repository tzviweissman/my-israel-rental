import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManagerPage = () => {
  const { managerId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchManagerData();
  }, [managerId]);

  const fetchManagerData = async () => {
    try {
      const response = await axios.get(`${API}/manager/${managerId}/properties`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch manager data', error);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="manager-page">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5] mb-12">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E5E5E5' }}>
              <User size={48} style={{ color: '#000000' }} />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }} data-testid="manager-name">
                {data.manager.name}
              </h1>
              <p className="text-gray-600">{data.manager.email}</p>
              {data.manager.phone && <p className="text-gray-600">{data.manager.phone}</p>}
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }}>Available Properties</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.properties.map((property) => (
            <div
              key={property.id}
              className="property-card"
              onClick={() => navigate(`/property/${property.id}`)}
              data-testid={`manager-property-${property.id}`}
            >
              <div className="h-64 bg-gray-200" style={{
                backgroundImage: `url(${property.images?.[0] || 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{property.title}</h3>
                <div className="flex items-center gap-2 text-gray-600 mb-3">
                  <MapPin size={16} />
                  <span className="text-sm">{property.area}</span>
                </div>
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-700">
                  {property.bedrooms && (
                    <div className="flex items-center gap-1">
                      <Bed size={16} />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div className="flex items-center gap-1">
                      <Bath size={16} />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  {property.square_meters && (
                    <div className="flex items-center gap-1">
                      <HomeIcon size={16} />
                      <span>{property.square_meters} m²</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold" style={{ color: '#000000' }}>
                    ₪{property.monthly_price || property.nightly_price}
                    <span className="text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? '/night' : '/month'}
                    </span>
                  </span>
                  <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                    {property.rental_type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.properties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600">No properties available at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPage;