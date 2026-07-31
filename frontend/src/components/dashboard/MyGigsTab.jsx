/**
 * MyGigsTab — provider hub for the Services Marketplace.
 *
 * Surfaces the provider's current gigs, subscription/trial state, and
 * a primary CTA to create a new gig. The Upgrade button hits the
 * `/subscription/upgrade` endpoint (Phase 1a: just flips the flag —
 * real Stripe/PayPal billing lands in Phase 1b).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import PlanPicker from '../marketplace/PlanPicker';
import {
  Plus, Loader2, ExternalLink, Trash2, BadgeCheck, Clock, Sparkles,
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
            className="px-3 py-2 rounded-lg text-xs font-semibold text-[#1E6A6A] border border-[#1E6A6A] hover:bg-[#1E6A6A]/5 flex items-center gap-1.5 disabled:opacity-60"
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
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="050-123-4567" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="provider-whatsapp-input" />
          {/* Doubles as the fallback for any gig published with WhatsApp
              booking mode but a blank per-gig number — see the `whatsapp`
              field on GET /marketplace/gigs/{id}'s provider block. */}
          <p className="text-[11px] text-gray-500 mt-1">
            {t('services.whatsappHint', 'Israeli numbers can be entered as 050-123-4567 — we add the +972 for you.')}
          </p>
        </div>

        {/* Spoken languages — feeds the /services filter modal. Empty
            allowed; unknown values are silently stripped by the backend
            (validated against the `/marketplace/languages` allowlist). */}
        <div data-testid="provider-languages-section">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Globe size={12} className="text-[#1E6A6A]" />
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
                      ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
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
            <Award size={12} className="text-[#D4AF37]" />
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
                <FileText size={12} className="text-[#1E6A6A] shrink-0" />
                <input
                  value={doc.label || ''}
                  onChange={(e) => setCredentialDocs((prev) => prev.map((d, idx) => idx === i ? { ...d, label: e.target.value } : d))}
                  placeholder="Document name"
                  className="flex-1 bg-transparent focus:outline-none text-gray-900"
                  data-testid={`credential-doc-label-${i}`}
                />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[#1E6A6A] hover:underline">View</a>
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
                className="text-xs font-semibold text-[#1E6A6A] hover:underline inline-flex items-center gap-1 disabled:opacity-60"
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
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-60" data-testid="provider-profile-save">
            {saving ? <Loader2 className="animate-spin" size={14} /> : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

const StatusPill = ({ provider }) => {
  if (provider.subscription_status === 'active') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold"
        data-testid="my-gigs-status-active"
      >
        <BadgeCheck size={12} /> Pro — active
      </span>
    );
  }
  if (provider.active) {
    const daysLeft = provider.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(provider.trial_ends_at) - new Date()) / 86400000))
      : null;
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold"
        data-testid="my-gigs-status-trial"
      >
        <Clock size={12} /> Free trial{daysLeft != null ? ` — ${daysLeft} days left` : ''}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold"
      data-testid="my-gigs-status-expired"
    >
      Trial expired
    </span>
  );
};

const MyGigsTab = ({ API, token }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState([]);
  const [provider, setProvider] = useState(null);
  const [providerDetails, setProviderDetails] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  // Commitment tier. Left empty until PlanPicker reports the ladder's
  // default, so we never post a tier the backend didn't offer.
  const [planKey, setPlanKey] = useState('');
  const [showPlans, setShowPlans] = useState(false);
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

  const upgrade = async () => {
    setUpgrading(true);
    try {
      // The tier travels as a query param — the endpoint accepts it
      // optionally so an older client still lands on the default plan.
      const res = await axios.post(
        `${API}/marketplace/subscription/upgrade`
          + (planKey ? `?plan_key=${encodeURIComponent(planKey)}` : ''),
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.approval_url) {
        // Redirect to PayPal for approval. PayPal will return the user
        // to /payment/success?flow=marketplace-subscription which activates.
        window.location.assign(res.data.approval_url);
        return;
      }
      toast.error('PayPal approval URL missing');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  };

  const cancelPro = async () => {
    if (!window.confirm('Cancel your Pro subscription? You keep access until the current period ends.')) return;
    try {
      await axios.post(`${API}/marketplace/subscription/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Subscription cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cancel failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" data-testid="my-gigs-loading">
        <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
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
            {provider && <StatusPill provider={provider} />}
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
          {provider && provider.subscription_status !== 'active' && (
            <button
              onClick={() => setShowPlans(true)}
              disabled={upgrading}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#D4AF37] hover:bg-[#c19f2c] flex items-center gap-1.5 disabled:opacity-60"
              data-testid="my-gigs-upgrade-btn"
            >
              {upgrading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {/* No price on the button any more: it hardcoded "$25/mo",
                  which is now only one of three tiers and would go stale the
                  moment pricing moves. The ladder itself is the source. */}
              {t('plans.upgradeCta', 'Upgrade to Pro')}
            </button>
          )}
          {provider && provider.subscription_status === 'active' && (
            <button
              onClick={cancelPro}
              className="px-3 py-2.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50"
              data-testid="my-gigs-cancel-pro-btn"
            >
              Cancel Pro
            </button>
          )}
          <button
            onClick={() => navigate('/services/create-gig')}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] flex items-center gap-1.5"
            data-testid="my-gigs-create-btn"
          >
            <Plus size={14} /> Create new gig
          </button>
        </div>
      </div>

      {/* Tier selection. Inline rather than a modal so the provider can still
          see their gigs and trial status while deciding — this is a pricing
          decision, not an interruption. */}
      {showPlans && provider && provider.subscription_status !== 'active' && (
        <div
          className="bg-white border border-gray-200 rounded-2xl p-4 mb-4"
          data-testid="my-gigs-plans-panel"
        >
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-sm font-semibold text-gray-900">
              {t('plans.chooseTitle', 'Choose your commitment')}
            </p>
            {/* Escape hatch for anyone who reached pricing without reading
                what they get — the brief asks for this link here. */}
            <a
              href="/why-list"
              className="text-xs font-semibold text-[#1E6A6A] hover:underline shrink-0"
              data-testid="my-gigs-why-list-link"
            >
              {t('plans.whatDoIGet', "What's included?")}
            </a>
          </div>
          <PlanPicker value={planKey} onChange={setPlanKey} disabled={upgrading} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={upgrade}
              disabled={upgrading || !planKey}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#D4AF37] hover:bg-[#c19f2c] flex items-center gap-1.5 disabled:opacity-60"
              data-testid="my-gigs-confirm-upgrade-btn"
            >
              {upgrading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {t('plans.continueToPaypal', 'Continue to PayPal')}
            </button>
            <button
              onClick={() => setShowPlans(false)}
              disabled={upgrading}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50"
              data-testid="my-gigs-plans-cancel"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {gigs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center" data-testid="my-gigs-empty">
          <p className="text-gray-700 font-semibold mb-2">You haven&apos;t listed a service yet</p>
          <p className="text-gray-500 text-sm mb-5">
            Publish your first gig — a free 30-day trial starts on your first listing.
          </p>
          <button
            onClick={() => navigate('/services/create-gig')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] inline-flex items-center gap-1.5"
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
                      className="text-xs font-semibold text-[#1E6A6A] hover:underline flex items-center gap-1"
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
