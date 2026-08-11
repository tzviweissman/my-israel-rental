/**
 * MyGigsTab — provider hub for the Services Marketplace.
 *
 * Surfaces the provider's current gigs and a primary CTA to create a new
 * one. There is no subscription or trial state to show — listing is free.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import PhoneInput from '../common/PhoneInput';
import { phoneError } from '../../utils/phoneValidation';
import {
  Plus, Loader2, ExternalLink, Trash2,
  Pencil, Upload, X, FileText, Globe, Award,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadFilesFast } from '../../utils/fastUpload';

const ProfileEditModal = ({ API, token, initial, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [bio, setBio] = useState(initial?.bio || '');
  const [tagline, setTagline] = useState(initial?.tagline || '');
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp || '');
  const [avatar, setAvatar] = useState(initial?.avatar || '');
  // Trust UI additions (Phase 3): spoken languages (multi-select),
  // free-text credentials, optional Cloudinary-hosted document links.
  // Empty arrays mean "not set" — backend treats absent same as empty.
  const [languages, setLanguages] = useState(initial?.languages || []);
  const [credentials, setCredentials] = useState(initial?.credentials || '');
  const [credentialDocs, setCredentialDocs] = useState(initial?.credential_docs || []);
  const [languageList, setLanguageList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  // Load the closed set of supported languages once so the chip row
  // always mirrors the backend allowlist (`/marketplace/languages`).
  useEffect(() => {
    axios.get(`${API}/marketplace/languages`)
      .then((r) => setLanguageList(r.data))
      .catch(() => setLanguageList([]));
  }, [API]);

  const toggleLanguage = (lang) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const pickCredentialDoc = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (credentialDocs.length >= 8) {
      toast.error('Maximum 8 credential documents');
      return;
    }
    setDocUploading(true);
    try {
      const results = await uploadFilesFast([file], API, token);
      const good = results.find((r) => r.url && !r.error);
      if (good) {
        setCredentialDocs((prev) => [...prev, { url: good.url, label: file.name }]);
        toast.success('Document uploaded');
      } else {
        toast.error(results[0]?.error || 'Upload failed');
      }
    } finally {
      setDocUploading(false);
      if (docRef.current) docRef.current.value = '';
    }
  };

  const pickAvatar = async (files) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const results = await uploadFilesFast([file], API, token);
      const good = results.find((r) => r.url && !r.error);
      if (good) {
        setAvatar(good.url);
        toast.success('Avatar uploaded');
      } else {
        toast.error(results[0]?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.patch(
        `${API}/marketplace/providers/me`,
        { bio, tagline, whatsapp, avatar, languages, credentials, credential_docs: credentialDocs },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Profile updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        data-testid="provider-profile-modal"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Edit provider profile</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" data-testid="provider-profile-close">
            <X size={18} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-full bg-gray-100 shrink-0"
            style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files)} data-testid="provider-avatar-input" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-[var(--brand-primary)] border border-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 flex items-center gap-1.5 disabled:opacity-60"
            data-testid="provider-avatar-btn"
          >
            {uploading ? <Loader2 className="animate-spin" size={12} /> : <Upload size={12} />}
            {avatar ? 'Change avatar' : 'Upload avatar'}
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700">Tagline</label>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Eco-friendly cleaning in Tel Aviv" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="provider-tagline-input" maxLength={80} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell clients about your experience…" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="provider-bio-input" maxLength={600} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">WhatsApp</label>
          {/* Doubles as the fallback for any gig published with WhatsApp
              booking mode but a blank per-gig number — see the `whatsapp`
              field on GET /marketplace/gigs/{id}'s provider block, which is
              exactly why the country must be explicit here too. */}
          <div className="mt-1">
            <PhoneInput
              value={whatsapp}
              onChange={setWhatsapp}
              error={phoneError(whatsapp, t)}
              testid="provider-whatsapp"
            />
          </div>
        </div>

        {/* Spoken languages — feeds the /services filter modal. Empty
            allowed; unknown values are silently stripped by the backend
            (validated against the `/marketplace/languages` allowlist). */}
        <div data-testid="provider-languages-section">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Globe size={12} className="text-[var(--brand-primary)]" />
            Languages you speak
            <span className="text-[10px] font-normal text-gray-400 ms-1">— shows on your public profile</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {languageList.map((lang) => {
              const active = languages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                  data-testid={`provider-lang-${lang.toLowerCase()}`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials & licenses — free-text professional details that
            render verbatim on the public provider profile. No admin
            review (per Phase 3 spec) — providers add their own social
            proof and it shows immediately. */}
        <div data-testid="provider-credentials-section">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Award size={12} className="text-[var(--gold)]" />
            Credentials &amp; licenses
            <span className="text-[10px] font-normal text-gray-400 ms-1">— optional</span>
          </label>
          <textarea
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Licensed tour guide since 2019 (Ministry of Tourism #12345). CPR certified. 200+ five-star reviews."
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            data-testid="provider-credentials-input"
          />

          {/* Optional PDF/image uploads for licenses, certificates,
              insurance docs. Cap at 8 per provider server-side. */}
          <div className="mt-2 space-y-1.5">
            {credentialDocs.map((doc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-1.5" data-testid={`credential-doc-row-${i}`}>
                <FileText size={12} className="text-[var(--brand-primary)] shrink-0" />
                <input
                  value={doc.label || ''}
                  onChange={(e) => setCredentialDocs((prev) => prev.map((d, idx) => idx === i ? { ...d, label: e.target.value } : d))}
                  placeholder="Document name"
                  className="flex-1 bg-transparent focus:outline-none text-gray-900"
                  data-testid={`credential-doc-label-${i}`}
                />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] hover:underline">View</a>
                <button
                  type="button"
                  onClick={() => setCredentialDocs((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 p-0.5 hover:bg-red-50 rounded"
                  data-testid={`credential-doc-remove-${i}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <input ref={docRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pickCredentialDoc(e.target.files)} />
            {credentialDocs.length < 8 && (
              <button
                type="button"
                onClick={() => docRef.current?.click()}
                disabled={docUploading}
                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1 disabled:opacity-60"
                data-testid="add-credential-doc-btn"
              >
                {docUploading ? <Loader2 className="animate-spin" size={11} /> : <Plus size={11} />}
                Add document
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] disabled:opacity-60" data-testid="provider-profile-save">
            {saving ? <Loader2 className="animate-spin" size={14} /> : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

/* `isCancelled` and `StatusPill` (trial / Pro / expired badges) lived
   here. Listing is free, so a provider has no plan state to show. The
   billing API and PayPal helpers stay in the backend, dormant; this was
   only their dashboard readout, and dead React state in a component is
   worse than no state. */

const MyGigsTab = ({ API, token }) => {
  const navigate = useNavigate();
  // This component had no translator of its own — the `useTranslation()`
  // higher up this file belongs to ProfileEditModal. Adding t(...) calls
  // down here without it threw ReferenceError on render and blanked the
  // whole tab.
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState([]);
  const [provider, setProvider] = useState(null);
  const [providerDetails, setProviderDetails] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/marketplace/my-gigs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGigs(res.data.gigs || []);
      setProvider(res.data.provider || null);
      // If we have any gig, load full provider details for the edit modal.
      const firstGig = res.data.gigs?.[0];
      if (firstGig) {
        try {
          const pr = await axios.get(`${API}/marketplace/providers/${firstGig.provider_user_id}`);
          setProviderDetails(pr.data);
        } catch (_) { /* non-fatal */ }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load your gigs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deleteGig = async (id) => {
    if (!window.confirm('Delete this gig? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/marketplace/gigs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Gig deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  /* upgrade() and cancelPro() lived here — they POSTed to
     /marketplace/subscription/upgrade and /cancel and handed off to
     PayPal. Both endpoints still exist server-side, dormant. */


  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" data-testid="my-gigs-loading">
        <Loader2 className="animate-spin text-[var(--brand-primary)]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="my-gigs-tab">
      {/* Header row: status + primary CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-gray-900">Your services</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* The trial / Pro status pill is gone with the subscription —
                there is no plan to be on. StatusPill and isCancelled are
                kept below, unused, alongside the dormant billing code. */}
            <span className="text-xs text-gray-500">
              {gigs.length} {gigs.length === 1 ? 'gig' : 'gigs'} listed
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowProfile(true)}
            className="px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
            data-testid="my-gigs-edit-profile-btn"
          >
            <Pencil size={14} /> Edit profile
          </button>
          {/* "Upgrade to Pro" and "Cancel Pro" lived here. Listing is free,
              so there is nothing to upgrade to and nothing to cancel. */}
          <button
            onClick={() => navigate('/services/create-gig')}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A] flex items-center gap-1.5"
            data-testid="my-gigs-create-btn"
          >
            <Plus size={14} /> Create new gig
          </button>
        </div>
      </div>

      {/* The inline plan-selection panel (PlanPicker + "Continue to
          PayPal") was here. Removed with the subscription. */}

      {gigs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center" data-testid="my-gigs-empty">
          <p className="text-gray-700 font-semibold mb-2">You haven&apos;t listed a service yet</p>
          <p className="text-gray-500 text-sm mb-5">
            Publish your first gig — a free 30-day trial starts on your first listing.
          </p>
          <button
            onClick={() => navigate('/services/create-gig')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A] inline-flex items-center gap-1.5"
            data-testid="my-gigs-empty-cta"
          >
            <Plus size={14} /> Create your first gig
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gigs.map((g) => {
            const cover = g.gallery?.[0];
            const cheap = (g.tiers || []).reduce(
              (a, t) => (a == null || t.price < a ? t.price : a),
              null,
            );
            const sym = g.tiers?.[0]?.currency === 'USD' ? '$' : '₪';
            return (
              <div
                key={g.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`my-gigs-item-${g.id}`}
              >
                <button
                  onClick={() => navigate(`/services/gig/${g.id}`)}
                  className="block w-full aspect-video bg-gray-100 text-left"
                  style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                >
                  {!cover && (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      No image
                    </div>
                  )}
                </button>
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">{g.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {g.category}{g.area ? ` · ${g.area}` : ''}
                  </p>
                  {cheap != null && (
                    <p className="text-xs text-gray-900">
                      <span className="text-gray-500">from </span>
                      <span className="font-semibold">{sym}{cheap.toLocaleString()}</span>
                    </p>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/services/gig/${g.id}`)}
                      className="text-xs font-semibold text-[var(--brand-primary)] hover:underline flex items-center gap-1"
                      data-testid={`my-gigs-view-${g.id}`}
                    >
                      View <ExternalLink size={11} />
                    </button>
                    <button
                      onClick={() => deleteGig(g.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      data-testid={`my-gigs-delete-${g.id}`}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showProfile && (
        <ProfileEditModal
          API={API}
          token={token}
          initial={providerDetails || {}}
          onClose={() => setShowProfile(false)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default MyGigsTab;
