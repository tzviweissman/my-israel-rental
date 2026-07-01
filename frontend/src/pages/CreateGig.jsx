/**
 * CreateGig — 5-step wizard for provider gig creation.
 *
 * Steps:
 *   1. Overview: title + category
 *   2. Description + FAQs
 *   3. Pricing tiers (up to 3)
 *   4. Gallery (URL-based for MVP — Cloudinary upload wiring in Phase 1b)
 *   5. Booking mode + WhatsApp/area
 *
 * Guards against unauthenticated access on mount. Successful create
 * navigates to the fresh gig detail page. All state is local — we
 * only POST on the final step's "Publish" click.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const CreateGig = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    faqs: [],
    tiers: [{ name: 'Basic', price: '', currency: 'ILS', delivery_days: '', description: '', features: [] }],
    gallery: [],
    booking_mode: 'whatsapp',
    whatsapp: '',
    area: '',
  });

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data));
  }, [token, navigate]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addTier = () => {
    if (form.tiers.length >= 3) return;
    const nextName = ['Basic', 'Standard', 'Premium'][form.tiers.length];
    set({ tiers: [...form.tiers, { name: nextName, price: '', currency: 'ILS', delivery_days: '', description: '', features: [] }] });
  };
  const updateTier = (i, patch) => set({ tiers: form.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeTier = (i) => set({ tiers: form.tiers.filter((_, idx) => idx !== i) });

  const canNext = () => {
    if (step === 1) return form.title.trim() && form.category;
    if (step === 2) return form.description.trim().length > 10;
    if (step === 3) return form.tiers.length > 0 && form.tiers.every((t) => t.name && parseFloat(t.price) > 0);
    if (step === 4) return true; // Gallery optional
    if (step === 5) {
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
          {['', 'Overview', 'Description', 'Pricing', 'Gallery', 'Booking'][step]}
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
            <p className="text-xs text-gray-500">Min 10 characters. You can add FAQs on the gig later.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {form.tiers.map((tt, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <input value={tt.name} onChange={(e) => updateTier(i, { name: e.target.value })} className="font-bold text-sm bg-transparent focus:outline-none" data-testid={`wizard-tier-name-${i}`} />
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
                  <input type="number" value={tt.delivery_days} onChange={(e) => updateTier(i, { delivery_days: e.target.value })} placeholder="Days" className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <textarea value={tt.description} onChange={(e) => updateTier(i, { description: e.target.value })} rows={2} placeholder="What's included in this tier" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
            ))}
            {form.tiers.length < 3 && (
              <button type="button" onClick={addTier} className="text-sm font-semibold text-[#1E6A6A] flex items-center gap-1" data-testid="wizard-tier-add"><Plus size={14} /> Add tier</button>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Paste image URLs (one per line). Direct upload arrives in Phase 1b.</p>
            <textarea rows={5} value={form.gallery.join('\n')} onChange={(e) => set({ gallery: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} placeholder="https://…" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" data-testid="wizard-gallery" />
            {form.gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {form.gallery.map((u) => (
                  <div key={u} className="aspect-square rounded-lg bg-gray-100" style={{ backgroundImage: `url(${u})`, backgroundSize: 'cover' }} />
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
              <label className="text-sm font-semibold text-gray-700">Service area (optional)</label>
              <input value={form.area} onChange={(e) => set({ area: e.target.value })} placeholder="Tel Aviv, Jerusalem, All Israel…" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-area" />
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
