import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Plus, Edit, Trash2, Eye, MessageCircle, Upload, X, Image, Film } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [propertyForm, setPropertyForm] = useState({
    title: '',
    description: '',
    rental_type: 'long-term',
    property_type: 'apartment',
    bedrooms: 1,
    bathrooms: 1,
    area: '',
    address: '',
    square_meters: '',
    floor: 1,
    has_elevator: false,
    is_shabbat_elevator: false,
    is_tama: false,
    has_agent_fee: false,
    agent_fee_price: '',
    agent_fee_currency: 'ILS',
    porches: 0,
    sukkah_compatible: false,
    condition: 'good',
    furniture_option: 'no_furniture',
    amenities: [],
    monthly_price: '',
    nightly_price: '',
    currency: 'ILS',
    images: []
  });

  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchBookings();
    }
  }, [user]);

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API}/properties?owner_id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings', error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const uploaded = [];
    
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      try {
        const res = await axios.post(`${API}/upload`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        uploaded.push({ ...res.data, original_name: files[i].name });
      } catch (err) {
        toast.error(`Failed to upload ${files[i].name}: ${err.response?.data?.detail || 'Error'}`);
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    const newImages = uploaded.filter(f => f.file_type === 'image').map(f => f.url);
    const newVideos = uploaded.filter(f => f.file_type === 'video').map(f => f.url);
    setUploadedFiles(prev => [...prev, ...uploaded]);
    setPropertyForm(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
      videos: [...(prev.videos || []), ...newVideos]
    }));
    setUploading(false);
    if (uploaded.length > 0) toast.success(`${uploaded.length} file(s) uploaded`);
  };

  const removeUploadedFile = async (fileToRemove) => {
    try {
      await axios.delete(`${API}/upload/${fileToRemove.filename}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) { /* ignore */ }
    setUploadedFiles(prev => prev.filter(f => f.filename !== fileToRemove.filename));
    setPropertyForm(prev => ({
      ...prev,
      images: prev.images.filter(url => url !== fileToRemove.url),
      videos: (prev.videos || []).filter(url => url !== fileToRemove.url)
    }));
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    try {
      // Convert empty strings to null for optional numeric fields
      const cleanedForm = {
        ...propertyForm,
        square_meters: propertyForm.square_meters === '' ? null : propertyForm.square_meters,
        agent_fee_price: propertyForm.agent_fee_price === '' ? null : propertyForm.agent_fee_price,
        monthly_price: propertyForm.monthly_price === '' ? null : propertyForm.monthly_price,
        nightly_price: propertyForm.nightly_price === '' ? null : propertyForm.nightly_price,
      };
      await axios.post(`${API}/properties`, cleanedForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Property added successfully!');
      setShowAddProperty(false);
      fetchProperties();
      setPropertyForm({
        title: '',
        description: '',
        rental_type: 'long-term',
        property_type: 'apartment',
        bedrooms: 1,
        bathrooms: 1,
        area: '',
        address: '',
        square_meters: '',
        floor: 1,
        has_elevator: false,
        is_shabbat_elevator: false,
        is_tama: false,
        has_agent_fee: false,
        agent_fee_price: '',
        agent_fee_currency: 'ILS',
        porches: 0,
        sukkah_compatible: false,
        condition: 'good',
        furniture_option: 'no_furniture',
        amenities: [],
        monthly_price: '',
        nightly_price: '',
        currency: 'ILS',
        images: [],
        videos: []
      });
      setUploadedFiles([]);
    } catch (error) {
      toast.error('Failed to add property');
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      await axios.delete(`${API}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Property deleted successfully!');
      fetchProperties();
    } catch (error) {
      toast.error('Failed to delete property');
    }
  };

  const getShareableLink = () => {
    return `${window.location.origin}/manager/${user.id}`;
  };

  const copyShareableLink = () => {
    navigator.clipboard.writeText(getShareableLink());
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Dashboard</h1>
          {user && user.role !== 'renter' && (
            <button onClick={() => setShowAddProperty(true)} className="primary-btn flex items-center gap-2" data-testid="add-property-button">
              <Plus size={20} />
              Add Property
            </button>
          )}
        </div>

        {user && user.role !== 'renter' && (
          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8" data-testid="manager-page-section">
            <h2 className="text-xl font-bold mb-4">Your Manager Page</h2>
            <p className="text-gray-600 mb-4">Share this link with potential renters to show all your properties:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={getShareableLink()}
                readOnly
                className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] bg-gray-50"
                data-testid="shareable-link"
              />
              <button onClick={copyShareableLink} className="secondary-btn" data-testid="copy-link-button">
                Copy Link
              </button>
            </div>
          </div>
        )}

        {showAddProperty && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" data-testid="add-property-modal">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>Add New Property</h2>
              <form onSubmit={handleAddProperty} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={propertyForm.title}
                    onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                    required
                    data-testid="property-title-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={propertyForm.description}
                    onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                    rows="4"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                    required
                    data-testid="property-description-input"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Rental Type</label>
                    <select
                      value={propertyForm.rental_type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, rental_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-rental-type-select"
                    >
                      <option value="long-term">Long Term</option>
                      <option value="short-term">Short Term</option>
                      <option value="vacation">Vacation</option>
                      <option value="storage">Storage</option>
                    </select>
                  </div>
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Property Type</label>
                    <select
                      value={propertyForm.property_type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-type-select"
                    >
                      <option value="apartment">Apartment</option>
                      <option value="house">House</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">Property Location</label>
                    <input
                      type="text"
                      value={propertyForm.area}
                      onChange={(e) => setPropertyForm({ ...propertyForm, area: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      required
                      data-testid="property-area-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Address</label>
                    <input
                      type="text"
                      value={propertyForm.address}
                      onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      required
                      data-testid="property-address-input"
                    />
                  </div>
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Bedrooms</label>
                    <select
                      value={propertyForm.bedrooms}
                      onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-bedrooms-input"
                    >
                      <option value="0">Studio</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6</option>
                      <option value="6.5">6.5</option>
                      <option value="7">7</option>
                      <option value="8">8+</option>
                    </select>
                  </div>
                  )}
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Bathrooms</label>
                    <select
                      value={propertyForm.bathrooms}
                      onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-bathrooms-input"
                    >
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6+</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">Floor</label>
                    <select
                      value={propertyForm.floor}
                      onChange={(e) => setPropertyForm({ ...propertyForm, floor: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-floor-input"
                    >
                      <option value="-2">Basement 2</option>
                      <option value="-1">Basement 1</option>
                      <option value="0">Ground Floor</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6</option>
                      <option value="6.5">6.5</option>
                      <option value="7">7</option>
                      <option value="7.5">7.5</option>
                      <option value="8">8</option>
                      <option value="8.5">8.5</option>
                      <option value="9">9</option>
                      <option value="9.5">9.5</option>
                      <option value="10">10</option>
                      <option value="11">11</option>
                      <option value="12">12</option>
                      <option value="13">13</option>
                      <option value="14">14</option>
                      <option value="15">15</option>
                      <option value="20">20+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Price {propertyForm.rental_type === 'vacation' ? '(per night)' : '(monthly)'}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={propertyForm.rental_type === 'vacation' ? propertyForm.nightly_price : propertyForm.monthly_price}
                        onChange={(e) => {
                          if (propertyForm.rental_type === 'vacation') {
                            setPropertyForm({ ...propertyForm, nightly_price: parseFloat(e.target.value) });
                          } else {
                            setPropertyForm({ ...propertyForm, monthly_price: parseFloat(e.target.value) });
                          }
                        }}
                        min="0"
                        className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                        required
                        data-testid="property-price-input"
                      />
                      <select
                        value={propertyForm.currency}
                        onChange={(e) => setPropertyForm({ ...propertyForm, currency: e.target.value })}
                        className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                        data-testid="property-currency-select"
                      >
                        <option value="ILS">₪ ILS</option>
                        <option value="USD">$ USD</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Property Condition</label>
                    <select
                      value={propertyForm.condition}
                      onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-condition-select"
                    >
                      <option value="renovated">Renovated</option>
                      <option value="partially_renovated">Partially Renovated</option>
                      <option value="good">Good Condition</option>
                    </select>
                  </div>
                  )}
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Porches</label>
                    <input
                      type="number"
                      value={propertyForm.porches}
                      onChange={(e) => setPropertyForm({ ...propertyForm, porches: parseInt(e.target.value) || 0, sukkah_compatible: (parseInt(e.target.value) || 0) > 0 ? propertyForm.sukkah_compatible : false })}
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                      data-testid="property-porches-input"
                    />
                    {propertyForm.porches > 0 && (
                      <>
                        <div className="ml-2 mt-2">
                          <label className="block text-sm text-gray-600 mb-1">Square Meters</label>
                          <input
                            type="number"
                            value={propertyForm.square_meters}
                            onChange={(e) => setPropertyForm({ ...propertyForm, square_meters: parseFloat(e.target.value) })}
                            min="0"
                            step="0.1"
                            className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50 text-sm"
                            data-testid="property-sqm-input"
                          />
                        </div>
                        <label className="flex items-center gap-2 ml-2 mt-2">
                          <input
                            type="checkbox"
                            checked={propertyForm.sukkah_compatible}
                            onChange={(e) => setPropertyForm({ ...propertyForm, sukkah_compatible: e.target.checked })}
                            className="w-4 h-4 rounded border-[#E5E5E5]"
                            data-testid="property-sukkah-checkbox"
                          />
                          <span className="text-sm text-gray-600">Sukkah Compatible</span>
                        </label>
                      </>
                    )}
                  </div>
                  )}
                  {propertyForm.rental_type === 'long-term' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Furniture Option</label>
                      <select
                        value={propertyForm.furniture_option}
                        onChange={(e) => setPropertyForm({ ...propertyForm, furniture_option: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50"
                        data-testid="property-furniture-select"
                      >
                        <option value="no_furniture">No Furniture</option>
                        <option value="furniture_package">Furniture Package</option>
                        <option value="furniture_free">Furniture Free</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_elevator}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_elevator: e.target.checked, is_shabbat_elevator: e.target.checked ? propertyForm.is_shabbat_elevator : false })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-elevator-checkbox"
                      />
                      <span>Elevator</span>
                    </label>
                    {propertyForm.has_elevator && (
                      <label className="flex items-center gap-2 ml-7">
                        <input
                          type="checkbox"
                          checked={propertyForm.is_shabbat_elevator}
                          onChange={(e) => setPropertyForm({ ...propertyForm, is_shabbat_elevator: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E5E5E5]"
                          data-testid="property-shabbat-elevator-checkbox"
                        />
                        <span className="text-sm text-gray-600">Shabbat Elevator</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.is_tama}
                        onChange={(e) => setPropertyForm({ ...propertyForm, is_tama: e.target.checked })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-tama-checkbox"
                      />
                      <span>Tama (Under Construction)</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_agent_fee}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_agent_fee: e.target.checked, agent_fee_price: e.target.checked ? propertyForm.agent_fee_price : '' })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-agent-fee-checkbox"
                      />
                      <span>Agent Fee</span>
                    </label>
                    {propertyForm.has_agent_fee && (
                      <div className="ml-7">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={propertyForm.agent_fee_price}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_price: parseFloat(e.target.value) })}
                            placeholder="Fee amount"
                            min="0"
                            className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50 text-sm"
                            data-testid="property-agent-fee-input"
                          />
                          <select
                            value={propertyForm.agent_fee_currency}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_currency: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#000000]/50 text-sm"
                            data-testid="property-agent-fee-currency-select"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {propertyForm.rental_type !== 'storage' && (
                <div>
                  <label className="block text-sm font-medium mb-4">Amenities</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      'Air conditioning / Central heating',
                      'In-unit washer and dryer',
                      'Dishwasher',
                      'Walk in Closets',
                      'High Ceilings',
                      'Ensuite Bathroom',
                      'Storage Space',
                      'Heated Floors',
                      'Gym / Fitness center',
                      'Swimming pool (indoor or outdoor)',
                      'Hot tub / Spa',
                      'On-site parking (garage or lot)',
                      'Wi-Fi included'
                    ].map((amenity) => (
                      <label key={amenity} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={propertyForm.amenities.includes(amenity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPropertyForm({
                                ...propertyForm,
                                amenities: [...propertyForm.amenities, amenity]
                              });
                            } else {
                              setPropertyForm({
                                ...propertyForm,
                                amenities: propertyForm.amenities.filter(a => a !== amenity)
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-[#E5E5E5]"
                        />
                        <span className="text-sm">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
                )}

                {/* File Upload Section */}
                <div data-testid="file-upload-section">
                  <label className="block text-sm font-medium mb-2">Photos & Videos</label>
                  <div
                    className="border-2 border-dashed border-[#E5E5E5] rounded-xl p-6 text-center hover:border-black/30 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload-input').click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-black/40', 'bg-gray-50'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-black/40', 'bg-gray-50'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-black/40', 'bg-gray-50');
                      const dt = new DataTransfer();
                      Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
                      const input = document.getElementById('file-upload-input');
                      input.files = dt.files;
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }}
                    data-testid="file-drop-zone"
                  >
                    <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-1">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400">JPEG, PNG, WebP, GIF, MP4, MOV, WebM — Max 50MB each</p>
                    <input
                      id="file-upload-input"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="file-upload-input"
                    />
                  </div>

                  {uploading && (
                    <div className="mt-3" data-testid="upload-progress">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        Uploading... {uploadProgress}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-black transition-all" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="uploaded-files-grid">
                      {uploadedFiles.map((file) => (
                        <div key={file.filename} className="relative group rounded-lg overflow-hidden border border-[#E5E5E5]" data-testid={`uploaded-file-${file.filename}`}>
                          {file.file_type === 'image' ? (
                            <img src={`${API.replace('/api', '')}${file.url}`} alt={file.original_name} className="w-full h-20 object-cover" />
                          ) : (
                            <div className="w-full h-20 bg-gray-900 flex items-center justify-center">
                              <Film size={24} className="text-white" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(file)}
                            className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`remove-file-${file.filename}`}
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                            <div className="flex items-center gap-1">
                              {file.file_type === 'image' ? <Image size={10} className="text-white" /> : <Film size={10} className="text-white" />}
                              <span className="text-[10px] text-white truncate">{file.original_name}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button type="submit" className="flex-1 primary-btn" data-testid="submit-property-button">
                    Add Property
                  </button>
                  <button type="button" onClick={() => setShowAddProperty(false)} className="flex-1 secondary-btn" data-testid="cancel-add-property-button">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {user && user.role !== 'renter' && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>My Properties</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden" data-testid={`dashboard-property-${property.id}`}>
                  <div className="h-48 bg-gray-200" style={{
                    backgroundImage: `url(${property.images?.[0] ? (property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${property.images[0]}` : property.images[0]) : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}></div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-2">{property.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{property.area}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold" style={{ color: '#000000' }}>
                        ₪{property.monthly_price || property.nightly_price}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/property/${property.id}`)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`view-property-${property.id}`}>
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDeleteProperty(property.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" data-testid={`delete-property-${property.id}`}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>Bookings</h2>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Property</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Dates</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Guests</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-[#E5E5E5]" data-testid={`booking-row-${booking.id}`}>
                    <td className="px-6 py-4">{booking.property_id}</td>
                    <td className="px-6 py-4">{booking.start_date} - {booking.end_date}</td>
                    <td className="px-6 py-4">{booking.guest_count}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;