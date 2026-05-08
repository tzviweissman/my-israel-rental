import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, X, Image as ImageIcon, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Owner / manager dashboard header card: business logo upload + shareable
 * public-page link. Self-contained (owns its own logo state and fetch).
 */
const ManagerHeader = ({ user, token, API }) => {
  const [businessLogo, setBusinessLogo] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const copyShareableLink = async () => {
    const writeOk = async () => {
      try {
        await navigator.clipboard.writeText(shareableLink);
        return true;
      } catch {
        const ta = document.createElement('textarea');
        ta.value = shareableLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }
    };
    if (await writeOk()) {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Share your manager page
        </p>
        <div
          className="flex items-stretch rounded-xl border border-[#E5E5E5] bg-gray-50 overflow-hidden focus-within:border-[#1E6A6A] focus-within:ring-2 focus-within:ring-[#1E6A6A]/15 transition-all"
          data-testid="shareable-link-row"
        >
          <span className="flex items-center pl-3 pr-2 text-gray-400 flex-shrink-0">
            <Link2 size={14} />
          </span>
          <input
            type="text"
            value={shareableLink}
            readOnly
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 py-2 pr-2 bg-transparent text-sm text-gray-700 focus:outline-none truncate"
            data-testid="shareable-link"
          />
          <button
            onClick={copyShareableLink}
            className={`flex items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors flex-shrink-0 border-l border-[#E5E5E5] ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-[#1E6A6A] text-[#D4AF37] hover:bg-[#155454]'
            }`}
            data-testid="copy-link-button"
          >
            {copied ? <Check size={13} /> : <Link2 size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerHeader;
