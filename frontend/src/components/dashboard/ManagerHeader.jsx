import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import ShareLinkRow from './ShareLinkRow';

/**
 * Owner / manager dashboard header card: business logo upload + shareable
 * public-page link. Self-contained (owns its own logo state and fetch).
 */
const ManagerHeader = ({ user, token, API }) => {
  const [businessLogo, setBusinessLogo] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.data.business_logo) {
          setBusinessLogo(res.data.business_logo);
        }
      } catch (err) {
        console.error('Failed to fetch user data', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API, token]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/user/logo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setBusinessLogo(res.data.logo_url);
      toast.success('Business logo uploaded!');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      await axios.delete(`${API}/user/logo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBusinessLogo(null);
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    }
  };

  const shareableLink = `${window.location.origin}/manager/${user.id}`;

  return (
    <div
      className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8"
      data-testid="manager-page-section"
    >
      <h2 className="text-xl font-bold mb-4">Your Manager Page</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Business Logo</label>
        <div className="flex items-center gap-4">
          {businessLogo ? (
            <div className="relative">
              <img
                src={
                  businessLogo.startsWith('/api')
                    ? `${API.replace('/api', '')}${businessLogo}`
                    : businessLogo
                }
                alt="Business Logo"
                className="w-20 h-20 rounded-xl object-cover border-2 border-[#D4AF37]"
                data-testid="business-logo-preview"
              />
              <button
                onClick={handleLogoRemove}
                className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                data-testid="remove-logo-button"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
              <ImageIcon size={24} />
            </div>
          )}
          <div>
            <label
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#1E6A6A', color: '#D4AF37' }}
              data-testid="upload-logo-button"
            >
              <Upload size={16} />
              {logoUploading ? 'Uploading...' : businessLogo ? 'Change Logo' : 'Upload Logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={logoUploading}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">Appears on your public manager page</p>
          </div>
        </div>
      </div>

      <ShareLinkRow
        link={shareableLink}
        label="Share your manager page"
      />

      <WhiteLabelSettings API={API} token={token} initial={user?.white_label || {}} />
    </div>
  );
};

// Public agency-page overrides — bio, extra services, and public
// contact email. Extra services are a lightweight list (title + optional
// description) meant for things like "Cleaning", "Airport pickup",
// "Concierge" that don't warrant a full marketplace gig.
const WhiteLabelSettings = ({ API, token, initial }) => {
  const [bio, setBio] = useState(initial.bio || '');
  const [services, setServices] = useState(
    Array.isArray(initial.services) && initial.services.length
      ? initial.services
      : [],
  );
  const [contactEmail, setContactEmail] = useState(initial.contact_email || '');
  const [saving, setSaving] = useState(false);

  const updateService = (i, key, value) => {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  };
  const removeService = (i) => {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addService = () => {
    if (services.length >= 20) return;
    setServices((prev) => [...prev, { title: '', description: '' }]);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Strip empty rows client-side so the "0 saved" state is intuitive.
      const cleanServices = services
        .map((s) => ({ title: (s.title || '').trim(), description: (s.description || '').trim() }))
        .filter((s) => s.title);
      await axios.patch(
        `${API}/user/white-label`,
        { bio, services: cleanServices, contact_email: contactEmail },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200" data-testid="white-label-settings">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">Public page details</h3>
        <p className="text-[11px] text-gray-500 leading-snug">
          Personalize your public agency page. Leave any field blank to keep the default look.
        </p>
      </div>

      <label className="text-xs block mb-4">
        <span className="flex items-center justify-between text-gray-700 font-medium mb-1">
          <span>About / bio</span>
          <span className="text-[10px] text-gray-400">{bio.length}/2000</span>
        </span>
        <textarea
          value={bio}
          maxLength={2000}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          placeholder="Tell renters who you are — years in the business, what neighborhoods you specialize in, the extra care you bring to your listings…"
          className="w-full px-2 py-2 rounded border border-gray-200 text-xs leading-snug"
          data-testid="wl-bio"
        />
      </label>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-700 font-medium">Other services you offer</span>
          <button
            type="button"
            onClick={addService}
            disabled={services.length >= 20}
            className="text-[11px] font-semibold text-[#1E6A6A] hover:underline disabled:opacity-50 disabled:no-underline"
            data-testid="wl-add-service"
          >
            + Add service
          </button>
        </div>
        {services.length === 0 && (
          <p className="text-[11px] text-gray-400 italic">
            e.g. Cleaning between guests · Airport pickup · Shabbat concierge · Rental contracts in English
          </p>
        )}
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={i} className="flex gap-2" data-testid={`wl-service-row-${i}`}>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[minmax(0,180px)_1fr] gap-2">
                <input
                  type="text"
                  value={s.title || ''}
                  onChange={(e) => updateService(i, 'title', e.target.value)}
                  placeholder="Service name"
                  className="h-9 px-2 rounded border border-gray-200 text-xs"
                  maxLength={80}
                  data-testid={`wl-service-title-${i}`}
                />
                <input
                  type="text"
                  value={s.description || ''}
                  onChange={(e) => updateService(i, 'description', e.target.value)}
                  placeholder="Short description (optional)"
                  className="h-9 px-2 rounded border border-gray-200 text-xs"
                  maxLength={400}
                  data-testid={`wl-service-desc-${i}`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeService(i)}
                className="shrink-0 h-9 w-9 rounded border border-gray-200 text-red-500 hover:bg-red-50 flex items-center justify-center"
                aria-label="Remove service"
                data-testid={`wl-service-remove-${i}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="text-xs block mb-4">
        <span className="block text-gray-700 font-medium mb-1">Public contact email</span>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="hello@youragency.com"
          className="w-full h-9 px-2 rounded border border-gray-200 text-xs"
          data-testid="wl-contact-email"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-[#1E6A6A] text-white text-xs font-semibold hover:bg-[#164a4a] disabled:opacity-60"
        data-testid="wl-save-btn"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
};

export default ManagerHeader;
