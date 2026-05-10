import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Calendar as CalendarComponent } from '../ui/calendar';
import { Calendar, Upload, X, Image, Film, Star } from 'lucide-react';
import { LOCATION_OPTIONS } from '../../constants/locations';

// Parse YYYY-MM-DD without UTC midnight drift (matches Dashboard.js helper)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const EMPTY_FORM = {
  title: '', description: '', rental_type: 'long-term', property_type: 'apartment',
  bedrooms: 1, bathrooms: 1, area: '', address: '', square_meters: '', porch_square_meters: '',
  floor: 1, has_elevator: false, is_shabbat_elevator: false, is_tama: false,
  has_agent_fee: false, agent_fee_price: '', agent_fee_currency: 'ILS',
  has_cleaning_fee: false, cleaning_fee_price: '', cleaning_fee_currency: 'ILS',
  max_guests: '',
  porches: 0, sukkah_compatible: false, condition: 'good', furniture_option: 'no_furniture',
  amenities: [], monthly_price: '', nightly_price: '', currency: 'ILS',
  images: [], videos: [], cancellation_policy: 'flexible', custom_cancellation_policy: '',
  available_from: '', starting_date: '', minimum_booking_days: '',
  holiday_tags: [],
};

/**
 * Add/Edit Property modal — self-contained. Hydrates from `editingProperty`
 * prop when editing, otherwise starts from EMPTY_FORM.
 */
const AddPropertyModal = ({ isOpen, onClose, editingProperty, onSaved, API, token }) => {
  const { t } = useTranslation();
  const [propertyForm, setPropertyForm] = useState(EMPTY_FORM);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showStartingDateCalendar, setShowStartingDateCalendar] = useState(false);
  const [showAvailableFromCalendar, setShowAvailableFromCalendar] = useState(false);
  const locationDropdownRef = useRef(null);

  // Hydrate form whenever the caller supplies an editingProperty
  useEffect(() => {
    if (!isOpen) return;
    if (editingProperty) {
      setPropertyForm({
        title: editingProperty.title || '',
        description: editingProperty.description || '',
        rental_type: editingProperty.rental_type || 'long-term',
        property_type: editingProperty.property_type || 'apartment',
        bedrooms: editingProperty.bedrooms || 1,
        bathrooms: editingProperty.bathrooms || 1,
        area: editingProperty.area || '',
        address: editingProperty.address || '',
        square_meters: editingProperty.square_meters || '',
        porch_square_meters: editingProperty.porch_square_meters || '',
        floor: editingProperty.floor || 1,
        has_elevator: editingProperty.has_elevator || false,
        is_shabbat_elevator: editingProperty.is_shabbat_elevator || false,
        is_tama: editingProperty.is_tama || false,
        has_agent_fee: editingProperty.has_agent_fee || false,
        agent_fee_price: editingProperty.agent_fee_price || '',
        agent_fee_currency: editingProperty.agent_fee_currency || 'ILS',
        has_cleaning_fee: editingProperty.has_cleaning_fee || false,
        cleaning_fee_price: editingProperty.cleaning_fee_price || '',
        cleaning_fee_currency: editingProperty.cleaning_fee_currency || 'ILS',
        max_guests: editingProperty.max_guests || '',
        porches: editingProperty.porches || 0,
        sukkah_compatible: editingProperty.sukkah_compatible || false,
        condition: editingProperty.condition || 'good',
        furniture_option: editingProperty.furniture_option || 'no_furniture',
        amenities: editingProperty.amenities || [],
        monthly_price: editingProperty.monthly_price || '',
        nightly_price: editingProperty.nightly_price || '',
        currency: editingProperty.currency || 'ILS',
        images: editingProperty.images || [],
        videos: editingProperty.videos || [],
        cancellation_policy: editingProperty.cancellation_policy || 'flexible',
        custom_cancellation_policy: editingProperty.custom_cancellation_policy || '',
        available_from: editingProperty.available_from || '',
        starting_date: editingProperty.starting_date || '',
        minimum_booking_days: editingProperty.minimum_booking_days ? String(editingProperty.minimum_booking_days) : '',
        holiday_tags: editingProperty.holiday_tags || [],
      });
      setUploadedFiles([
        ...(editingProperty.images || []).map((url, i) => ({ url, file_type: 'image', filename: url.split('/').pop(), original_name: `Image ${i + 1}` })),
        ...(editingProperty.videos || []).map((url, i) => ({ url, file_type: 'video', filename: url.split('/').pop(), original_name: `Video ${i + 1}` })),
      ]);
    } else {
      setPropertyForm(EMPTY_FORM);
      setUploadedFiles([]);
    }
  }, [isOpen, editingProperty]);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

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
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push({ ...res.data, original_name: files[i].name });
      } catch (err) {
        toast.error(`Failed to upload ${files[i].name}: ${err.response?.data?.detail || 'Error'}`);
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    const newImages = uploaded.filter((f) => f.file_type === 'image').map((f) => f.url);
    const newVideos = uploaded.filter((f) => f.file_type === 'video').map((f) => f.url);
    setUploadedFiles((prev) => [...prev, ...uploaded]);
    setPropertyForm((prev) => ({ ...prev, images: [...prev.images, ...newImages], videos: [...(prev.videos || []), ...newVideos] }));
    setUploading(false);
    if (uploaded.length > 0) toast.success(`${uploaded.length} file(s) uploaded`);
  };

  const removeUploadedFile = async (fileToRemove) => {
    try {
      await axios.delete(`${API}/upload/${fileToRemove.filename}`, authHeaders);
    } catch (err) {
      // Continue with local removal even if server deletion fails
    }
    setUploadedFiles((prev) => prev.filter((f) => f.filename !== fileToRemove.filename));
    setPropertyForm((prev) => ({
      ...prev,
      images: prev.images.filter((u) => u !== fileToRemove.url),
      videos: (prev.videos || []).filter((u) => u !== fileToRemove.url),
    }));
  };

  // Promote one image to "cover" by reordering it to index 0 of `images`.
  // Every existing read-site uses `images[0]` as the thumbnail (Properties
  // grid, Home featured, PropertyCard, dashboard tiles) so no other code
  // needs to change. We also re-order `uploadedFiles` so the visual badge
  // tracks the saved cover.
  const setAsCover = (file) => {
    if (file.file_type !== 'image') return;
    setPropertyForm((prev) => {
      if (!prev.images.includes(file.url)) return prev;
      const next = [file.url, ...prev.images.filter((u) => u !== file.url)];
      return { ...prev, images: next };
    });
    setUploadedFiles((prev) => {
      const target = prev.find((f) => f.filename === file.filename);
      if (!target) return prev;
      return [target, ...prev.filter((f) => f.filename !== file.filename)];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const toNumOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const toIntOrNull = (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const cleaned = {
      ...propertyForm,
      square_meters: toNumOrNull(propertyForm.square_meters),
      porch_square_meters: toNumOrNull(propertyForm.porch_square_meters),
      agent_fee_price: toNumOrNull(propertyForm.agent_fee_price),
      cleaning_fee_price: toNumOrNull(propertyForm.cleaning_fee_price),
      max_guests: toNumOrNull(propertyForm.max_guests),
      monthly_price: toNumOrNull(propertyForm.monthly_price),
      nightly_price: toNumOrNull(propertyForm.nightly_price),
      bedrooms: toNumOrNull(propertyForm.bedrooms),
      bathrooms: toNumOrNull(propertyForm.bathrooms),
      floor: toNumOrNull(propertyForm.floor),
      porches: toIntOrNull(propertyForm.porches) ?? 0,
      minimum_booking_days: toIntOrNull(propertyForm.minimum_booking_days),
    };
    try {
      if (editingProperty?.id) {
        await axios.put(`${API}/properties/${editingProperty.id}`, cleaned, authHeaders);
        toast.success('Property updated successfully!');
      } else {
        await axios.post(`${API}/properties`, cleaned, authHeaders);
        toast.success('Property added successfully!');
      }
      onSaved && (await onSaved());
      onClose();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      let msg = editingProperty?.id ? 'Failed to update property' : 'Failed to add property';
      if (Array.isArray(detail) && detail[0]?.msg) {
        msg = `${msg}: ${detail[0].loc?.slice(1).join('.') || 'field'} — ${detail[0].msg}`;
      } else if (typeof detail === 'string') {
        msg = `${msg}: ${detail}`;
      }
      toast.error(msg);
    }
  };

  // Location filter
  const filteredLocations = LOCATION_OPTIONS.flatMap((cityGroup) =>
    cityGroup.neighborhoods
      .filter((neighborhood) => {
        if (!locationSearch || locationSearch.trim() === '') return true;
        const s = locationSearch.toLowerCase();
        return (
          neighborhood.toLowerCase().includes(s) ||
          cityGroup.city.toLowerCase().includes(s) ||
          `${cityGroup.city} - ${neighborhood}`.toLowerCase().includes(s)
        );
      })
      .map((neighborhood) => ({
        value: `${cityGroup.city} - ${neighborhood}`,
        city: cityGroup.city,
        neighborhood,
      })),
  );

  if (!isOpen) return null;

  return (
    <>
    {isOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" data-testid="add-property-modal">
        <div className="relative bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <button
            type="button"
            onClick={onClose}
            className="sticky top-0 float-right -mt-3 -mr-3 z-10 p-2 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition-colors"
            aria-label="Close"
            data-testid="add-property-close-x"
          >
            <X size={18} />
          </button>
          <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{editingProperty && editingProperty.id ? t('dashboard.editProperty') : t('dashboard.addNewProperty')}</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={propertyForm.title}
                onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                data-testid="property-description-input"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.rentalType')}</label>
                <select
                  value={propertyForm.rental_type}
                  onChange={(e) => setPropertyForm({ ...propertyForm, rental_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-rental-type-select"
                >
                  <option value="long-term">{t('property.longTerm')}</option>
                  <option value="short-term">{t('property.shortTerm')}</option>
                  <option value="vacation">{t('property.vacationType')}</option>
                  <option value="storage">{t('property.storageType')}</option>
                </select>
              </div>
              {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.propertyType')}</label>
                <select
                  value={propertyForm.property_type}
                  onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-type-select"
                >
                  <option value="apartment">{t('property.apartment')}</option>
                  <option value="house">{t('property.house')}</option>
                  <option value="villa">Villa</option>
                </select>
              </div>
              )}
              <div className="relative" ref={locationDropdownRef}>
                <label className="block text-sm font-medium mb-2">{t('property.propertyLocation')}</label>
                <input
                  type="text"
                  value={showLocationDropdown ? locationSearch : (propertyForm.area || '')}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    if (e.target.value === '') {
                      setPropertyForm({ ...propertyForm, area: '' });
                    }
                    setShowLocationDropdown(true);
                  }}
                  onFocus={() => {
                    setLocationSearch('');
                    setShowLocationDropdown(true);
                  }}
                  onBlur={() => {
                    // If no selection was made and field is empty, keep it empty
                    if (!propertyForm.area && locationSearch === '') {
                      setLocationSearch('');
                    }
                  }}
                  placeholder="Type to search location..."
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  required={!propertyForm.area}
                  data-testid="property-area-input"
                />
                {showLocationDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredLocations.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No locations found</div>
                    ) : (
                      filteredLocations.map((location) => (
                        <div
                          key={location.value}
                          onClick={() => {
                            setPropertyForm({ ...propertyForm, area: location.value });
                            setLocationSearch('');
                            setShowLocationDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-[#1E6A6A]/10 cursor-pointer text-sm transition-colors"
                        >
                          <span className="font-medium text-gray-700">{location.neighborhood}</span>
                          <span className="text-gray-500 text-xs ml-2">({location.city})</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.address')}</label>
                <input
                  type="text"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-address-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.sqm')}</label>
                <input
                  type="number"
                  value={propertyForm.square_meters}
                  onChange={(e) => setPropertyForm({ ...propertyForm, square_meters: parseFloat(e.target.value) || '' })}
                  min="0"
                  step="0.1"
                  placeholder={propertyForm.rental_type === 'storage' ? 'Storage area size' : 'Total apartment size'}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-sqm-input"
                />
              </div>
              {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.bedrooms')}</label>
                <select
                  value={propertyForm.bedrooms}
                  onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                <label className="block text-sm font-medium mb-2">{t('property.bathrooms')}</label>
                <select
                  value={propertyForm.bathrooms}
                  onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                <label className="block text-sm font-medium mb-2">{t('property.floor')}</label>
                <select
                  value={propertyForm.floor}
                  onChange={(e) => setPropertyForm({ ...propertyForm, floor: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-floor-input"
                >
                  <option value="-2">Basement 2</option>
                  <option value="-1">Basement 1</option>
                  <option value="0">{t('property.groundFloor')}</option>
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
                    className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    required
                    data-testid="property-price-input"
                  />
                  <select
                    value={propertyForm.currency}
                    onChange={(e) => setPropertyForm({ ...propertyForm, currency: e.target.value })}
                    className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    data-testid="property-currency-select"
                  >
                    <option value="ILS">₪ ILS</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Starting Date (Long-term only) OR Date Available (Others) */}
            {propertyForm.rental_type === 'long-term' ? (
              <div className="relative">
                <label className="block text-sm font-medium mb-3 flex items-center gap-2 text-gray-700">
                  <div className="p-2 bg-[#1E6A6A]/10 rounded-lg">
                    <Calendar size={18} style={{ color: '#1E6A6A' }} />
                  </div>
                  <span className="font-semibold">Starting Date *</span>
                </label>
                <div 
                  className="relative cursor-pointer"
                  onClick={() => setShowStartingDateCalendar(!showStartingDateCalendar)}
                >
                  <div className="w-full px-5 py-4 rounded-xl border-2 border-[#1E6A6A]/20 bg-white hover:border-[#1E6A6A]/40 hover:shadow-md transition-all duration-200 flex items-center justify-between group">
                    <span className={`text-base font-medium ${propertyForm.starting_date ? 'text-gray-700' : 'text-gray-400'}`}>
                      {propertyForm.starting_date ? format(parseLocalDate(propertyForm.starting_date), 'MMMM d, yyyy') : 'Select starting date'}
                    </span>
                    <Calendar size={20} className="text-[#1E6A6A]/40 group-hover:text-[#1E6A6A]/60 transition-colors" />
                  </div>
                </div>
                
                {showStartingDateCalendar && (
                  <div className="absolute top-full mt-2 bg-white rounded-xl border-2 border-[#1E6A6A] shadow-2xl p-4 z-[100] w-[320px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStartingDateCalendar(false);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                    >
                      <X size={14} />
                    </button>
                    <CalendarComponent
                      mode="single"
                      selected={parseLocalDate(propertyForm.starting_date)}
                      defaultMonth={parseLocalDate(propertyForm.starting_date) || new Date()}
                      onSelect={(date) => {
                        if (date) {
                          setPropertyForm({ ...propertyForm, starting_date: format(date, 'yyyy-MM-dd') });
                          setShowStartingDateCalendar(false);
                        }
                      }}
                      disabled={[{ before: new Date() }]}
                      initialFocus
                    />
                  </div>
                )}
                
                <div className="mt-3 p-3 bg-[#1E6A6A]/5 rounded-lg border border-[#1E6A6A]/10">
                  <p className="text-xs text-[#1E6A6A] flex items-start gap-2">
                    <span className="text-base">📌</span>
                    <span className="font-medium">Fixed start date for this long-term rental (cannot be changed by renters)</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <label className="block text-sm font-medium mb-3 flex items-center gap-2 text-gray-700">
                  <div className="p-2 bg-[#D4AF37]/10 rounded-lg">
                    <Calendar size={18} style={{ color: '#D4AF37' }} />
                  </div>
                  <span className="font-semibold">Date Available</span>
                </label>
                <div 
                  className="relative cursor-pointer"
                  onClick={() => setShowAvailableFromCalendar(!showAvailableFromCalendar)}
                >
                  <div className="w-full px-5 py-4 rounded-xl border-2 border-[#D4AF37]/20 bg-white hover:border-[#D4AF37]/40 hover:shadow-md transition-all duration-200 flex items-center justify-between group">
                    <span className={`text-base font-medium ${propertyForm.available_from ? 'text-gray-700' : 'text-gray-400'}`}>
                      {propertyForm.available_from ? format(parseLocalDate(propertyForm.available_from), 'MMMM d, yyyy') : 'Select available date'}
                    </span>
                    <Calendar size={20} className="text-[#D4AF37]/40 group-hover:text-[#D4AF37]/60 transition-colors" />
                  </div>
                </div>
                
                {showAvailableFromCalendar && (
                  <div className="absolute top-full mt-2 bg-white rounded-xl border-2 border-[#D4AF37] shadow-2xl p-4 z-[100] w-[320px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAvailableFromCalendar(false);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                    >
                      <X size={14} />
                    </button>
                    <CalendarComponent
                      mode="single"
                      selected={parseLocalDate(propertyForm.available_from)}
                      defaultMonth={parseLocalDate(propertyForm.available_from) || new Date()}
                      onSelect={(date) => {
                        if (date) {
                          setPropertyForm({ ...propertyForm, available_from: format(date, 'yyyy-MM-dd') });
                          setShowAvailableFromCalendar(false);
                        }
                      }}
                      disabled={[{ before: new Date() }]}
                      initialFocus
                    />
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                  <span className="text-sm">ℹ️</span>
                  <span>The earliest date this property can be booked from</span>
                </p>
              </div>
            )}

            {/* Minimum Booking Length */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {propertyForm.rental_type === 'vacation' 
                  ? 'Minimum Booking Length (Days)' 
                  : 'Minimum Booking Length (Months)'}
              </label>
              <input
                type="number"
                value={propertyForm.minimum_booking_days}
                onChange={(e) => setPropertyForm({ ...propertyForm, minimum_booking_days: e.target.value })}
                placeholder={propertyForm.rental_type === 'vacation' ? '7' : '12'}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                {propertyForm.rental_type === 'vacation'
                  ? 'Minimum number of days a renter must book (e.g., 3, 7, 14 days)'
                  : 'Minimum number of months a renter must book (e.g., 6, 12, 24 months)'}
              </p>
            </div>

            {/* Cancellation Policy - Vacation Rentals Only */}
            {propertyForm.rental_type === 'vacation' && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold mb-4">Cancellation Policy</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Policy Type</label>
                    <select
                      value={propertyForm.cancellation_policy}
                      onChange={(e) => setPropertyForm({ ...propertyForm, cancellation_policy: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    >
                      <option value="flexible">Flexible - Full refund 7+ days before check-in</option>
                      <option value="moderate">Moderate - 50% refund 14+ days before check-in</option>
                      <option value="strict">Strict - No refunds after booking</option>
                      <option value="custom">Custom - Write your own policy</option>
                    </select>
                  </div>
                  {propertyForm.cancellation_policy === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Cancellation Policy</label>
                      <textarea
                        value={propertyForm.custom_cancellation_policy}
                        onChange={(e) => setPropertyForm({ ...propertyForm, custom_cancellation_policy: e.target.value })}
                        placeholder="Describe your cancellation policy in detail..."
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Holiday Categories — vacation rentals only */}
            {propertyForm.rental_type === 'vacation' && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold mb-1">Holiday Categories</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Optional — tag this listing so it shows up under <span className="font-medium">Sukkot Rentals</span> or <span className="font-medium">Pesach Rentals</span> in the navigation menu.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'sukkot', label: 'Sukkot Rental' },
                    { key: 'pesach', label: 'Pesach Rental' },
                  ].map(({ key, label }) => {
                    const checked = (propertyForm.holiday_tags || []).includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all ${
                          checked
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#1E6A6A]'
                            : 'border-gray-200 hover:border-[#D4AF37]/40 text-gray-600'
                        }`}
                        data-testid={`holiday-tag-${key}`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[#1E6A6A]"
                          checked={checked}
                          onChange={(e) => {
                            const current = propertyForm.holiday_tags || [];
                            const next = e.target.checked
                              ? [...current, key]
                              : current.filter((t) => t !== key);
                            setPropertyForm({ ...propertyForm, holiday_tags: next });
                          }}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.condition')}</label>
                <select
                  value={propertyForm.condition}
                  onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-condition-select"
                >
                  <option value="renovated">{t('property.renovated')}</option>
                  <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                  <option value="good">{t('property.goodCondition')}</option>
                </select>
              </div>
              )}
              {propertyForm.rental_type !== 'storage' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('property.numberOfPorches')}</label>
                <input
                  type="number"
                  value={propertyForm.porches}
                  onChange={(e) => setPropertyForm({ ...propertyForm, porches: parseInt(e.target.value) || 0, sukkah_compatible: (parseInt(e.target.value) || 0) > 0 ? propertyForm.sukkah_compatible : false })}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                  data-testid="property-porches-input"
                />
                {propertyForm.porches > 0 && (
                  <>
                    <div className="ml-2 mt-2">
                      <label className="block text-sm text-gray-600 mb-1">{t('property.parchSqm')}</label>
                      <input
                        type="number"
                        value={propertyForm.porch_square_meters}
                        onChange={(e) => setPropertyForm({ ...propertyForm, porch_square_meters: parseFloat(e.target.value) || '' })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                        data-testid="property-porch-sqm-input"
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
                      <span className="text-sm text-gray-600">{t('property.sukkah')}</span>
                    </label>
                  </>
                )}
              </div>
              )}
              {propertyForm.rental_type === 'long-term' && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t('property.furnitureOption')}</label>
                  <select
                    value={propertyForm.furniture_option}
                    onChange={(e) => setPropertyForm({ ...propertyForm, furniture_option: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    data-testid="property-furniture-select"
                  >
                    <option value="no_furniture">{t('property.noFurniture')}</option>
                    <option value="furniture_package">{t('property.furniturePackage')}</option>
                    <option value="furniture_free">{t('property.furnitureFree')}</option>
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
                  <span>{t('property.elevator')}</span>
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
                    <span className="text-sm text-gray-600">{t('property.shabbatElevator')}</span>
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
                {propertyForm.rental_type === 'vacation' ? (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_cleaning_fee}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_cleaning_fee: e.target.checked, cleaning_fee_price: e.target.checked ? propertyForm.cleaning_fee_price : '' })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-cleaning-fee-checkbox"
                      />
                      <span>{t('property.cleaningFee', 'Cleaning fee')}</span>
                    </label>
                    {propertyForm.has_cleaning_fee && (
                      <div className="ml-7">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={propertyForm.cleaning_fee_price}
                            onChange={(e) => setPropertyForm({ ...propertyForm, cleaning_fee_price: parseFloat(e.target.value) })}
                            placeholder="Fee amount"
                            min="0"
                            className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-cleaning-fee-input"
                          />
                          <select
                            value={propertyForm.cleaning_fee_currency}
                            onChange={(e) => setPropertyForm({ ...propertyForm, cleaning_fee_currency: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-cleaning-fee-currency-select"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                          </select>
                        </div>
                      </div>
                    )}
                    {/* Vacation-only optional guest cap. Leave blank → no
                        upper limit (renters self-report headcount in the
                        booking message). */}
                    <div className="mt-1">
                      <label className="text-sm text-gray-600 block mb-1">
                        {t('property.maxGuests', 'Max guests (optional)')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={propertyForm.max_guests}
                        onChange={(e) => setPropertyForm({ ...propertyForm, max_guests: e.target.value })}
                        placeholder="No limit"
                        className="w-32 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                        data-testid="property-max-guests-input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_agent_fee}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_agent_fee: e.target.checked, agent_fee_price: e.target.checked ? propertyForm.agent_fee_price : '' })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-agent-fee-checkbox"
                      />
                      <span>{t('property.agentFee')}</span>
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
                            className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-agent-fee-input"
                          />
                          <select
                            value={propertyForm.agent_fee_currency}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_currency: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-agent-fee-currency-select"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {propertyForm.rental_type !== 'storage' && (
            <div>
              <label className="block text-sm font-medium mb-4">{t('property.amenities')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  'Central AC / Heating',
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
              <label className="block text-sm font-medium mb-2">{t('property.photosVideos')}</label>
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
                <p className="text-sm text-gray-600 mb-1">{t('property.dragDrop')}</p>
                <p className="text-xs text-gray-400">{t('property.fileTypes')}</p>
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
                    {t('property.uploading')} {uploadProgress}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-black transition-all" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}

              {uploadedFiles.length > 0 && (
                <>
                  <p className="mt-4 text-xs text-gray-500 flex items-center gap-1.5">
                    <Star size={12} className="text-[#D4AF37]" />
                    Hover any image and click the star to set it as the cover photo (the one shown to renters first).
                  </p>
                <div className="mt-2 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="uploaded-files-grid">
                  {uploadedFiles.map((file) => {
                    const isCover = file.file_type === 'image' && propertyForm.images[0] === file.url;
                    return (
                    <div key={file.filename} className={`relative group rounded-lg overflow-hidden border ${isCover ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/40' : 'border-[#E5E5E5]'}`} data-testid={`uploaded-file-${file.filename}`}>
                      {file.file_type === 'image' ? (
                        <img src={`${API.replace('/api', '')}${file.url}`} alt={file.original_name} className="w-full h-20 object-cover" />
                      ) : (
                        <div className="w-full h-20 bg-gray-900 flex items-center justify-center">
                          <Film size={24} className="text-white" />
                        </div>
                      )}
                      {isCover && (
                        <div className="absolute top-1 left-1 bg-[#D4AF37] text-white rounded-md px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 shadow" data-testid={`cover-badge-${file.filename}`}>
                          <Star size={10} fill="white" /> COVER
                        </div>
                      )}
                      {file.file_type === 'image' && !isCover && (
                        <button
                          type="button"
                          onClick={() => setAsCover(file)}
                          title="Set as cover image"
                          className="absolute top-1 left-1 bg-black/70 hover:bg-[#D4AF37] text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all"
                          data-testid={`set-cover-${file.filename}`}
                        >
                          <Star size={11} />
                        </button>
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
                    );
                  })}
                </div>
                </>
              )}
            </div>

            <div className="flex gap-4">
              <button type="submit" className="flex-1 primary-btn" data-testid="submit-property-button">
                {editingProperty && editingProperty.id ? t('dashboard.saveChanges') : t('dashboard.addProperty')}
              </button>
              <button type="button" onClick={onClose} className="flex-1 secondary-btn" data-testid="cancel-add-property-button">
                {t('dashboard.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    </>
  );
};

export default AddPropertyModal;
