/**
 * CreateGig — 5-step wizard for provider gig creation.
 *
 * Steps:
 *   1. Overview: title + category
 *   2. Description + FAQs
 *   3. Services & prices — each row is a distinct service the provider
 *      offers (e.g. Haircut, Beard trim, Full grooming), NOT a
 *      Fiverr-style Basic/Standard/Premium upgrade ladder. Data is
 *      still stored under `tiers[]` on the backend for compatibility.
 *   4. Gallery (URL-based for MVP — Cloudinary upload wiring in Phase 1b)
 *   5. Booking mode + WhatsApp/area
 *
 * Guards against unauthenticated access on mount. Successful create
 * navigates to the fresh gig detail page. All state is local — we
 * only POST on the final step's "Publish" click.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Upload, X } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import { uploadFilesFast } from '../utils/fastUpload';

const CreateGig = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    faqs: [],
    // Each entry represents one distinct service the provider offers.
    // Kept under the legacy `tiers[]` key so the backend + gig detail
    // page don't have to change. Names are free-text — no forced
    // Basic/Standard/Premium ladder.
    tiers: [{ name: '', price: '', currency: 'ILS', delivery_days: '', description: '', features: [] }],
    gallery: [],
    booking_mode: 'whatsapp',
    whatsapp: '',
    area: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputRef = useRef(null);

  const handleFilesPicked = async (files) => {
    const arr = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    if (form.gallery.length + arr.length > 10) {
      toast.error('Max 10 images per gig');
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const results = await uploadFilesFast(arr, API, token, (p) => setUploadPct(Math.round(p * 100)));
      const good = results.filter((r) => r.url && !r.error);
      if (good.length < results.length) {
        toast.error(`${results.length - good.length} upload(s) failed`);
      }
      if (good.length > 0) {
        set({ gallery: [...form.gallery, ...good.map((r) => r.url)] });
        toast.success(`Added ${good.length} image${good.length > 1 ? 's' : ''}`);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url) => {
    set({ gallery: form.gallery.filter((u) => u !== url) });
  };

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data));
    // Load the supported city list too so the wizard's area field can
    // autocomplete against the same slugs used by /nearby distance sort.
    // Ensures every published gig lands in the discovery net from day 1.
    axios.get(`${API}/marketplace/locations`).then((r) => setLocations(r.data)).catch(() => {});
  }, [token, navigate]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addTier = () => {
    if (form.tiers.length >= 8) return;
    set({ tiers: [...form.tiers, { name: '', price: '', currency: 'ILS', delivery_days: '', description: '', features: [] }] });
  };
  const updateTier = (i, patch) => set({ tiers: form.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeTier = (i) => set({ tiers: form.tiers.filter((_, idx) => idx !== i) });

  const canNext = () => {
    if (step === 1) return form.title.trim() && form.category;
    if (step === 2) return form.description.trim().length > 10;
    if (step === 3) return form.tiers.length > 0 && form.tiers.every((t) => t.name && parseFloat(t.price) > 0);
    if (step === 4) return true; // Gallery optional
    if (step === 5) {
      // Service area required — every gig must carry a city so it can
      // surface in the /services?nearby=1 distance sort. See Marketplace
      // Trust & Discovery Phase 2 (the /marketplace/nearest-city helper
      // resolves a renter's coords against this exact string).
      if (!(form.area || '').trim()) return false;
      if (form.booking_mode === 'whatsapp') return (form.whatsapp || '').replace(/\D/g, '').length >= 7;
      return true;
    }
    return false;
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        tiers: form.tiers.map((t) => ({
          ...t,
          price: parseFloat(t.price),
          delivery_days: t.delivery_days ? parseInt(t.delivery_days, 10) : null,
        })),
      };
      const { data } = await axios.post(`${API}/marketplace/gigs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Gig published!');
      navigate(`/services/gig/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="create-gig-page">
      <PageMeta title="Create a service | MyIsraelRental Provider" description="List your service on MyIsraelRental." path="/services/create" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-[#1E6A6A]' : 'bg-gray-200'}`} />
          ))}
        </div>
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>
          {['', 'Overview', 'Description', 'Services & Prices', 'Gallery', 'Booking'][step]}
        </h1>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Title</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Deep apartment cleaning" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-title" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Category</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((c) => (
                  <button key={c.slug} type="button" onClick={() => set({ category: c.slug })} className={`px-3 py-2 rounded-lg text-xs font-semibold border ${form.category === c.slug ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'}`} data-testid={`wizard-cat-${c.slug}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={8} placeholder="Describe what you offer, who it's for, and what's included…" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-description" />
            <p className="text-xs text-gray-500">Min 10 characters. Hebrew-browsing renters will see this text auto-translated — no need to write it twice.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* Helper strip — explains this isn't a Fiverr tier ladder.
                Each row is a distinct service the provider offers, so a
                barber can list "Haircut", "Beard trim", "Full grooming"
                as separate options with their own prices. */}
            <div className="rounded-xl bg-[#1E6A6A]/8 border border-[#1E6A6A]/20 p-3 text-xs text-[#1E6A6A] leading-snug">
              List each service you offer as a separate option — for example, a barber might add <b>Haircut</b> (₪60), <b>Beard trim</b> (₪30), and <b>Full grooming</b> (₪90). These aren&apos;t tiers or upgrades; they&apos;re the different things customers can book from you.
            </div>
            {form.tiers.map((tt, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={tt.name}
                    onChange={(e) => updateTier(i, { name: e.target.value })}
                    placeholder={i === 0 ? 'e.g. Haircut' : (i === 1 ? 'e.g. Beard trim' : 'Service name')}
                    className="font-bold text-sm bg-transparent focus:outline-none flex-1 placeholder:text-gray-400 placeholder:font-normal"
                    data-testid={`wizard-tier-name-${i}`}
                  />
                  {form.tiers.length > 1 && (
                    <button type="button" onClick={() => removeTier(i)} className="text-red-500" data-testid={`wizard-tier-remove-${i}`}><Trash2 size={14} /></button>
                  )}
                </div>
                <div className="flex gap-2">
                  <select value={tt.currency} onChange={(e) => updateTier(i, { currency: e.target.value })} className="px-2 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="ILS">₪ ILS</option>
                    <option value="USD">$ USD</option>
                  </select>
                  <input type="number" value={tt.price} onChange={(e) => updateTier(i, { price: e.target.value })} placeholder="Price" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid={`wizard-tier-price-${i}`} />
                  <input type="number" value={tt.delivery_days} onChange={(e) => updateTier(i, { delivery_days: e.target.value })} placeholder="Days" title="Turnaround in days — leave blank for on-the-spot services" className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <textarea value={tt.description} onChange={(e) => updateTier(i, { description: e.target.value })} rows={2} placeholder="What's included (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
            ))}
            {form.tiers.length < 8 && (
              <button type="button" onClick={addTier} className="text-sm font-semibold text-[#1E6A6A] flex items-center gap-1" data-testid="wizard-tier-add"><Plus size={14} /> Add another service</button>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Add up to 10 photos of your work. First image becomes the cover.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesPicked(e.target.files)}
              data-testid="wizard-gallery-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || form.gallery.length >= 10}
              className="w-full py-8 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
              data-testid="wizard-gallery-upload"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin text-[#1E6A6A]" size={24} />
                  <span className="text-sm text-gray-700">Uploading… {uploadPct}%</span>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-[#1E6A6A]" />
                  <span className="text-sm font-semibold text-gray-700">Click to upload photos</span>
                  <span className="text-xs text-gray-500">JPG / PNG / WebP · max 10 images</span>
                </>
              )}
            </button>

            {form.gallery.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {form.gallery.map((u, i) => (
                  <div key={u} className="relative aspect-square rounded-lg bg-gray-100 group overflow-hidden" data-testid={`wizard-gallery-item-${i}`}>
                    <div
                      className="absolute inset-0"
                      style={{ backgroundImage: `url(${u})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                    {i === 0 && (
                      <span className="absolute top-1 start-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(u)}
                      className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`wizard-gallery-remove-${i}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">How should clients book?</label>
              <div className="mt-2 flex gap-2">
                {[
                  { v: 'whatsapp', label: 'Book on WhatsApp' },
                  { v: 'in_platform', label: 'Book on MyIsraelRental' },
                ].map((o) => (
                  <button key={o.v} type="button" onClick={() => set({ booking_mode: o.v })} className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${form.booking_mode === o.v ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'}`} data-testid={`wizard-booking-${o.v}`}>{o.label}</button>
                ))}
              </div>
            </div>
            {form.booking_mode === 'whatsapp' && (
              <div>
                <label className="text-sm font-semibold text-gray-700">WhatsApp number (with country code)</label>
                <input value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+972…" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-whatsapp" />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Service area <span className="text-red-500">*</span>
              </label>
              <input
                value={form.area}
                onChange={(e) => set({ area: e.target.value })}
                placeholder="Tel Aviv, Jerusalem, Haifa…"
                list="services-city-suggestions"
                className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-[#1E6A6A] ${
                  (form.area || '').trim() ? 'border-gray-200' : 'border-gray-300'
                }`}
                data-testid="wizard-area"
              />
              <datalist id="services-city-suggestions">
                {locations.map((l) => (
                  <option key={l.slug} value={l.label} />
                ))}
              </datalist>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Pick a city so renters within a few km can find your gig via <span className="font-semibold">Show nearby</span>. Matching one of the suggested cities gives you the highest visibility.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8">
          <button type="button" disabled={step === 1} onClick={() => setStep((s) => s - 1)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 flex items-center gap-1" data-testid="wizard-back">
            <ArrowLeft size={14} /> Back
          </button>
          {step < 5 ? (
            <button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-40 flex items-center gap-1" data-testid="wizard-next">
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button type="button" disabled={!canNext() || saving} onClick={submit} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-40 flex items-center gap-1" data-testid="wizard-publish">
              {saving ? <Loader2 className="animate-spin" size={14} /> : <>Publish gig <ArrowRight size={14} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateGig;
