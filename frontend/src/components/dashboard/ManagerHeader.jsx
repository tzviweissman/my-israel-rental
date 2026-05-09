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
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
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
    </div>
  );
};

export default ManagerHeader;
