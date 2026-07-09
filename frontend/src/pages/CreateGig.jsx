/**
 * CreateGig — dynamic multi-step wizard for provider gig creation.
 *
 * The wizard adapts to the provider's `gig_type` choice on step 1 so we
 * only ask what's actually needed:
 *   - `store`       → showcase products (no calendar, no tiers)
 *   - `deliverable` → tiers with turnaround days + optional date picker
 *   - `appointment` → services with duration + weekly hours calendar
 *
 * Step map (idx → label, may vary by type):
 *   1. Listing type (all)
 *   2. Overview: title + category (all)
 *   3. Description (all)
 *   4. Products / Tiers / Services (dynamic per type)
 *   5. Weekly availability (appointment only) — else skipped
 *   6. Gallery (all)
 *   7. Contact + booking mode + area (all)
 *
 * All state is local; we POST once on the final "Publish" click.
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, Upload, X,
  Store, Package, CalendarClock, ImagePlus,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import { uploadFilesFast } from '../utils/fastUpload';

// ---- Gig type registry ------------------------------------------------------
// Central definition of every gig-type-aware behaviour so the wizard, the
// dynamic step 4, and the label copy all read from one place.
const GIG_TYPES = [
  {
    id: 'store',
    icon: Store,
    label: 'Store',
    tagline: 'Showcase products for sale',
    examples: 'Furniture store, boutique, gift shop, jewelry',
  },
  {
    id: 'deliverable',
    icon: Package,
    label: 'Deliverable service',
    tagline: 'Priced work with a turnaround time',
    examples: 'Logo design, translation, cleaning, moving, video editing',
  },
  {
    id: 'appointment',
    icon: CalendarClock,
    label: 'Appointment service',
    tagline: 'Book a specific day + time',
    examples: 'Barber, salon, massage, personal trainer, tutor',
  },
];

const DAYS = [
  { k: 'mon', label: 'Mon' },
  { k: 'tue', label: 'Tue' },
  { k: 'wed', label: 'Wed' },
  { k: 'thu', label: 'Thu' },
  { k: 'fri', label: 'Fri' },
  { k: 'sat', label: 'Sat' },
  { k: 'sun', label: 'Sun' },
];

const emptyWeekly = () => DAYS.reduce((acc, d) => ({ ...acc, [d.k]: [] }), {});

// Per-type initial row values so a barber doesn't have to clear a "delivery
// days" field they'll never use.
const emptyTierFor = (type, prevCurrency = 'ILS') => ({
  name: '', price: '', currency: prevCurrency,
  description: '', features: [],
  images: [],
  ...(type === 'appointment'
    ? { duration_minutes: 30, delivery_days: '' }
    : { delivery_days: '', duration_minutes: '' }),
});

const emptyProduct = (prevCurrency = 'ILS') => ({
  name: '', price: '', currency: prevCurrency, description: '', image: '', in_stock: true,
});

const CreateGig = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputRef = useRef(null);
  const productImageInputRef = useRef({});

  const [form, setForm] = useState({
    gig_type: 'deliverable',
    title: '',
    category: '',
    description: '',
    faqs: [],
    tiers: [emptyTierFor('deliverable')],
    products: [emptyProduct()],
    weekly_availability: emptyWeekly(),
    slot_duration_minutes: 30,
    enable_date_booking: false,
    gallery: [],
    booking_mode: 'whatsapp',
    whatsapp: '',
    area: '',
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Reset the per-type primary list when the user changes their gig type
  // mid-wizard so we never publish stale rows (e.g. a "haircut" row on a
  // furniture store).
  const setGigType = (id) => {
    setForm((f) => {
      const prevCurrency = f.tiers[0]?.currency || f.products[0]?.currency || 'ILS';
      const next = { ...f, gig_type: id };
      if (id === 'store') {
        next.products = f.products.length ? f.products : [emptyProduct(prevCurrency)];
        next.tiers = [];
      } else if (id === 'appointment') {
        next.tiers = f.tiers.length
          ? f.tiers.map((t) => ({ ...t, duration_minutes: t.duration_minutes || 30, delivery_days: '' }))
          : [emptyTierFor('appointment', prevCurrency)];
        next.products = [];
      } else {
        next.tiers = f.tiers.length
          ? f.tiers.map((t) => ({ ...t, delivery_days: t.delivery_days || '', duration_minutes: '' }))
          : [emptyTierFor('deliverable', prevCurrency)];
        next.products = [];
      }
      return next;
    });
  };

  // ---- Tier helpers (deliverable + appointment) -----------------------------
  const addTier = () => {
    if (form.tiers.length >= 15) return;
    const prev = form.tiers[form.tiers.length - 1]?.currency || 'ILS';
    set({ tiers: [...form.tiers, emptyTierFor(form.gig_type, prev)] });
  };
  const updateTier = (i, patch) => set({
    tiers: form.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
  });
  const removeTier = (i) => set({ tiers: form.tiers.filter((_, idx) => idx !== i) });

  // Upload one or more images to a specific tier's local `images` array.
  // Reuses the same Cloudinary fast-upload path as the gig-wide gallery.
  const uploadTierImages = async (i, files) => {
    const arr = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    const current = form.tiers[i]?.images || [];
    if (current.length + arr.length > 6) {
      toast.error('Max 6 photos per option');
      return;
    }
    try {
      const results = await uploadFilesFast(arr, API, token, () => {});
      const good = results.filter((r) => r.url && !r.error);
      if (good.length < results.length) toast.error(`${results.length - good.length} upload(s) failed`);
      if (good.length > 0) updateTier(i, { images: [...current, ...good.map((r) => r.url)] });
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };
  const removeTierImage = (i, url) => {
    const current = form.tiers[i]?.images || [];
    updateTier(i, { images: current.filter((u) => u !== url) });
  };

  // ---- Product helpers (store) ---------------------------------------------
  const addProduct = () => {
    if (form.products.length >= 30) return;
    const prev = form.products[form.products.length - 1]?.currency || 'ILS';
    set({ products: [...form.products, emptyProduct(prev)] });
  };
  const updateProduct = (i, patch) => set({
    products: form.products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
  });
  const removeProduct = (i) => set({ products: form.products.filter((_, idx) => idx !== i) });

  const uploadProductImage = async (i, file) => {
    if (!file) return;
    try {
      const results = await uploadFilesFast([file], API, token, () => {});
      const url = results[0]?.url;
      if (url) updateProduct(i, { image: url });
      else toast.error('Upload failed');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  // ---- Availability helpers (appointment) -----------------------------------
  const toggleDayOpen = (d) => {
    const wins = form.weekly_availability[d];
    const next = wins.length
      ? []
      : [{ start: '09:00', end: '17:00' }];
    set({ weekly_availability: { ...form.weekly_availability, [d]: next } });
  };
  const updateWindow = (d, patch) => {
    const wins = form.weekly_availability[d];
    const merged = wins.length ? [{ ...wins[0], ...patch }] : [{ start: '09:00', end: '17:00', ...patch }];
    set({ weekly_availability: { ...form.weekly_availability, [d]: merged } });
  };

  // ---- Gallery --------------------------------------------------------------
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
  const removeImage = (url) => set({ gallery: form.gallery.filter((u) => u !== url) });

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data));
    axios.get(`${API}/marketplace/locations`).then((r) => setLocations(r.data)).catch(() => {});
  }, [token, navigate]);

  // The appointment type inserts one extra step for weekly hours.
  const isAppointment = form.gig_type === 'appointment';
  const stepLabels = useMemo(() => (
    isAppointment
      ? ['', 'Type', 'Overview', 'Description', 'Services', 'Hours', 'Gallery', 'Contact']
      : ['', 'Type', 'Overview', 'Description', form.gig_type === 'store' ? 'Products' : 'Services & Prices', 'Gallery', 'Contact']
  ), [isAppointment, form.gig_type]);
  const totalSteps = stepLabels.length - 1;

  const canNext = () => {
    // step 1: type picker
    if (step === 1) return !!form.gig_type;
    // step 2: title + category
    if (step === 2) return form.title.trim() && form.category;
    // step 3: description
    if (step === 3) return form.description.trim().length > 10;
    // step 4: primary list (products or tiers)
    if (step === 4) {
      if (form.gig_type === 'store') {
        return form.products.length > 0
          && form.products.every((p) => p.name.trim() && parseFloat(p.price) > 0);
      }
      return form.tiers.length > 0
        && form.tiers.every((t) => t.name.trim() && parseFloat(t.price) > 0);
    }
    // Appointment inserts hours as step 5
    if (isAppointment && step === 5) {
      const anyOpen = DAYS.some((d) => (form.weekly_availability[d.k] || []).length > 0);
      return anyOpen;
    }
    // Gallery is optional — final step is contact.
    const contactStep = isAppointment ? 7 : 6;
    if (step === contactStep) {
      if (!(form.area || '').trim()) return false;
      if (form.booking_mode === 'whatsapp') return (form.whatsapp || '').replace(/\D/g, '').length >= 7;
      return true;
    }
    // Gallery step
    return true;
  };

  // Human-readable reason Next is blocked. Rendered under the disabled
  // Next button so users don't have to hunt around the form to find the
  // missing field.
  const nextBlockReason = () => {
    if (canNext()) return '';
    if (step === 1) return 'Pick a listing type to continue.';
    if (step === 2) {
      if (!form.title.trim()) return 'Add a title above.';
      if (!form.category) return 'Pick a category above.';
    }
    if (step === 3) return 'Write at least 10 characters describing what you offer.';
    if (step === 4) {
      if (form.gig_type === 'store') {
        const bad = form.products.find((p) => !p.name.trim() || !(parseFloat(p.price) > 0));
        if (bad && !bad.name.trim()) return 'Give every product a name.';
        if (bad) return 'Every product needs a price greater than 0.';
      } else {
        const bad = form.tiers.find((t) => !t.name.trim() || !(parseFloat(t.price) > 0));
        if (bad && !bad.name.trim()) return 'Give every service or tier a name (see the highlighted field).';
        if (bad) return 'Every service needs a price greater than 0.';
      }
    }
    if (isAppointment && step === 5) return 'Turn on at least one open day so customers can book you.';
    const contactStep = isAppointment ? 7 : 6;
    if (step === contactStep) {
      if (!(form.area || '').trim()) return 'Pick a service area (city).';
      if (form.booking_mode === 'whatsapp'
          && (form.whatsapp || '').replace(/\D/g, '').length < 7) return 'Enter a valid WhatsApp number with country code.';
    }
    return '';
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        gig_type: form.gig_type,
        title: form.title,
        category: form.category,
        description: form.description,
        faqs: form.faqs,
        gallery: form.gallery,
        booking_mode: form.booking_mode,
        whatsapp: form.whatsapp,
        area: form.area,
        // Only send the arrays relevant to this gig type so we don't
        // pollute the doc with empty structures the type will never use.
        tiers: form.gig_type === 'store' ? [] : form.tiers.map((t) => ({
          name: t.name.trim(),
          price: parseFloat(t.price),
          currency: t.currency,
          description: t.description,
          features: t.features || [],
          images: t.images || [],
          delivery_days: form.gig_type === 'deliverable' && t.delivery_days
            ? parseInt(t.delivery_days, 10) : null,
          duration_minutes: form.gig_type === 'appointment' && t.duration_minutes
            ? parseInt(t.duration_minutes, 10) : null,
        })),
        products: form.gig_type === 'store' ? form.products.map((p) => ({
          name: p.name.trim(),
          price: parseFloat(p.price),
          currency: p.currency,
          description: p.description,
          image: p.image || null,
          in_stock: !!p.in_stock,
        })) : [],
        weekly_availability: form.gig_type === 'appointment' ? form.weekly_availability : null,
        slot_duration_minutes: form.gig_type === 'appointment' ? form.slot_duration_minutes : null,
        enable_date_booking: form.gig_type === 'deliverable' ? !!form.enable_date_booking : false,
      };
      const { data } = await axios.post(`${API}/marketplace/gigs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const translated = data?.title_he || data?.description_he;
      toast.success(translated
        ? 'Gig published — also translated to Hebrew for you'
        : 'Gig published!');
      navigate(`/services/gig/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  // Which real step index maps to gallery / contact given the optional hours step.
  const galleryStep = isAppointment ? 6 : 5;
  const contactStep = isAppointment ? 7 : 6;

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="create-gig-page">
      <PageMeta title="Create a service | MyIsraelRental Provider" description="List your service on MyIsraelRental." path="/services/create" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
            <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-[#1E6A6A]' : 'bg-gray-200'}`} />
          ))}
        </div>
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>
          {stepLabels[step]}
        </h1>

        {/* --- Step 1: Gig type picker --- */}
        {step === 1 && (
          <div className="space-y-3" data-testid="wizard-type-picker">
            <p className="text-sm text-gray-600 mb-3">
              Choose the type of listing that best fits your business. This changes what we ask next so we only collect what&apos;s relevant.
            </p>
            {GIG_TYPES.map((t) => {
              const Icon = t.icon;
              const active = form.gig_type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGigType(t.id)}
                  className={`w-full text-left rounded-2xl border-2 p-4 flex gap-4 items-start transition-all ${
                    active
                      ? 'border-[#1E6A6A] bg-[#1E6A6A]/5 shadow-md'
                      : 'border-gray-200 bg-white hover:border-[#D4AF37] hover:shadow-sm'
                  }`}
                  data-testid={`wizard-type-${t.id}`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-[#1E6A6A] text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-900">{t.label}</div>
                    <div className="text-sm text-gray-700 mt-0.5">{t.tagline}</div>
                    <div className="text-xs text-gray-500 mt-1">Examples: {t.examples}</div>
                  </div>
                  {active && (
                    <div className="w-5 h-5 rounded-full bg-[#1E6A6A] text-white flex items-center justify-center text-xs">✓</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* --- Step 2: Overview (title + category) --- */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Title</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })}
                placeholder={form.gig_type === 'store' ? 'e.g. Modern Furniture — Tel Aviv Showroom' : 'e.g. Deep apartment cleaning'}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-title" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Category</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((c) => (
                  <button key={c.slug} type="button" onClick={() => set({ category: c.slug })}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                      form.category === c.slug ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                    }`} data-testid={`wizard-cat-${c.slug}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- Step 3: Description --- */}
        {step === 3 && (
          <div className="space-y-4">
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={8}
              placeholder="Describe what you offer, who it's for, and what's included…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-description" />
            <p className="text-xs text-gray-500">Min 10 characters. Hebrew-browsing renters will see this auto-translated — no need to write it twice.</p>
          </div>
        )}

        {/* --- Step 4: Dynamic (Products / Tiers / Services) --- */}
        {step === 4 && form.gig_type === 'store' && (
          <StoreProductsStep
            products={form.products}
            onUpdate={updateProduct}
            onAdd={addProduct}
            onRemove={removeProduct}
            productImageInputRef={productImageInputRef}
            onUploadImage={uploadProductImage}
          />
        )}
        {step === 4 && form.gig_type !== 'store' && (
          <TiersStep
            gigType={form.gig_type}
            tiers={form.tiers}
            onUpdate={updateTier}
            onAdd={addTier}
            onRemove={removeTier}
            onUploadImages={uploadTierImages}
            onRemoveImage={removeTierImage}
            enableDateBooking={form.enable_date_booking}
            onToggleDateBooking={() => set({ enable_date_booking: !form.enable_date_booking })}
          />
        )}

        {/* --- Step 5 (appointment only): Weekly hours --- */}
        {isAppointment && step === 5 && (
          <AvailabilityStep
            weekly={form.weekly_availability}
            slotDuration={form.slot_duration_minutes}
            onToggleDay={toggleDayOpen}
            onUpdateWindow={updateWindow}
            onSlotDurationChange={(v) => set({ slot_duration_minutes: v })}
          />
        )}

        {/* --- Gallery (all types) --- */}
        {step === galleryStep && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {form.gig_type === 'store'
                ? 'Add up to 10 photos of your storefront or brand. First image becomes the cover.'
                : 'Add up to 10 photos of your work. First image becomes the cover.'}
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => handleFilesPicked(e.target.files)} data-testid="wizard-gallery-file-input" />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              disabled={uploading || form.gallery.length >= 10}
              className="w-full py-8 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
              data-testid="wizard-gallery-upload">
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
                    <div className="absolute inset-0" style={{ backgroundImage: `url(${u})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">Cover</span>
                    )}
                    <button type="button" onClick={() => removeImage(u)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`wizard-gallery-remove-${i}`}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Contact step --- */}
        {step === contactStep && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                {form.gig_type === 'store' ? 'How should buyers reach you?' : 'How should clients book?'}
              </label>
              <div className="mt-2 flex gap-2">
                {[
                  { v: 'whatsapp', label: form.gig_type === 'store' ? 'Message on WhatsApp' : 'Book on WhatsApp' },
                  { v: 'in_platform', label: form.gig_type === 'store' ? 'Message on MyIsraelRental' : 'Book on MyIsraelRental' },
                ].map((o) => (
                  <button key={o.v} type="button" onClick={() => set({ booking_mode: o.v })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${
                      form.booking_mode === o.v ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                    }`} data-testid={`wizard-booking-${o.v}`}>{o.label}</button>
                ))}
              </div>
            </div>
            {form.booking_mode === 'whatsapp' && (
              <div>
                <label className="text-sm font-semibold text-gray-700">WhatsApp number (with country code)</label>
                <input value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })}
                  placeholder="+972…" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="wizard-whatsapp" />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700">Service area <span className="text-red-500">*</span></label>
              <input value={form.area} onChange={(e) => set({ area: e.target.value })}
                placeholder="Tel Aviv, Jerusalem, Haifa…" list="services-city-suggestions"
                className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-[#1E6A6A] ${
                  (form.area || '').trim() ? 'border-gray-200' : 'border-gray-300'
                }`} data-testid="wizard-area" />
              <datalist id="services-city-suggestions">
                {locations.map((l) => (<option key={l.slug} value={l.label} />))}
              </datalist>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Pick a city so renters within a few km can find your gig via <span className="font-semibold">Show nearby</span>.
              </p>
            </div>
            <div className="rounded-xl bg-[#1E6A6A]/6 border border-[#1E6A6A]/15 p-3 text-xs text-[#1E6A6A] leading-snug flex items-start gap-2" data-testid="wizard-translate-notice">
              <Loader2 size={14} className="mt-0.5 flex-shrink-0 opacity-70" />
              <span>
                <b>Heads up:</b> Publishing takes about 4 seconds because we auto-translate your listing to Hebrew so Hebrew-speaking renters can find and read it right away — no extra typing needed.
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col items-end mt-8 gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" disabled={step === 1} onClick={() => setStep((s) => s - 1)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 flex items-center gap-1 self-start sm:self-auto" data-testid="wizard-back">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex flex-col items-end gap-1">
            {step < totalSteps ? (
              <button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-40 flex items-center gap-1" data-testid="wizard-next">
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button type="button" disabled={!canNext() || saving} onClick={submit}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] disabled:opacity-40 flex items-center gap-1" data-testid="wizard-publish">
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Publishing… translating to Hebrew</span>
                  </>
                ) : (
                  <>Publish gig <ArrowRight size={14} /></>
                )}
              </button>
            )}
            {!canNext() && nextBlockReason() && (
              <p className="text-[11px] text-red-600 font-medium max-w-xs text-end" data-testid="wizard-next-blocked-reason">
                {nextBlockReason()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Step 4A — Store products ----------
const StoreProductsStep = ({ products, onUpdate, onAdd, onRemove, productImageInputRef, onUploadImage }) => (
  <div className="space-y-4" data-testid="wizard-products-step">
    <div className="rounded-xl bg-[#1E6A6A]/8 border border-[#1E6A6A]/20 p-3 text-xs text-[#1E6A6A] leading-snug">
      Add each product you sell as a separate row — with a photo, price, and short description. Customers browse the grid and message you to buy.
    </div>
    {products.map((p, i) => (
      <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3" data-testid={`wizard-product-${i}`}>
        <div className="flex gap-3">
          {/* Product photo */}
          <div className="flex-shrink-0">
            <input
              ref={(el) => { productImageInputRef.current[i] = el; }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUploadImage(i, e.target.files[0])}
              data-testid={`wizard-product-image-input-${i}`}
            />
            <button
              type="button"
              onClick={() => productImageInputRef.current[i]?.click()}
              className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden ${
                p.image ? 'border-transparent' : 'border-gray-300 hover:border-[#1E6A6A]'
              }`}
              data-testid={`wizard-product-image-btn-${i}`}
            >
              {p.image ? (
                <img src={p.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={20} className="text-gray-400" />
              )}
            </button>
          </div>
          <div className="flex-1 space-y-2">
            <input value={p.name} onChange={(e) => onUpdate(i, { name: e.target.value })}
              placeholder="Product name (e.g. Oak dining table)"
              className="font-semibold text-sm w-full bg-transparent focus:outline-none placeholder:text-gray-400"
              data-testid={`wizard-product-name-${i}`} />
            <div className="flex gap-2 items-stretch">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-semibold text-sm">
                  {p.currency === 'USD' ? '$' : '₪'}
                </span>
                <select value={p.currency} onChange={(e) => onUpdate(i, { currency: e.target.value })}
                  className="appearance-none pl-7 pr-6 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30"
                  data-testid={`wizard-product-currency-${i}`}>
                  <option value="ILS">ILS</option>
                  <option value="USD">USD</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">▾</span>
              </div>
              <input type="number" value={p.price} onChange={(e) => onUpdate(i, { price: e.target.value })}
                placeholder="Price" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                data-testid={`wizard-product-price-${i}`} />
              {products.length > 1 && (
                <button type="button" onClick={() => onRemove(i)} className="px-2 text-red-500" data-testid={`wizard-product-remove-${i}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        <textarea value={p.description} onChange={(e) => onUpdate(i, { description: e.target.value })} rows={2}
          placeholder="Short description (optional) — dimensions, materials, colours…"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
      </div>
    ))}
    <button type="button" onClick={onAdd} className="text-sm font-semibold text-[#1E6A6A] flex items-center gap-1" data-testid="wizard-product-add">
      <Plus size={14} /> Add another product
    </button>
  </div>
);

// ---------- Step 4B — Deliverable + Appointment tiers ----------
const TiersStep = ({ gigType, tiers, onUpdate, onAdd, onRemove, onUploadImages, onRemoveImage, enableDateBooking, onToggleDateBooking }) => {
  const isAppt = gigType === 'appointment';
  const fileInputsRef = React.useRef({});
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#1E6A6A]/8 border border-[#1E6A6A]/20 p-3 text-xs text-[#1E6A6A] leading-snug">
        {isAppt
          ? 'List each bookable service — e.g. a barber might add Haircut (30 min · ₪60), Beard trim (15 min · ₪30), Full grooming (45 min · ₪90). Duration lets us build the time-slot picker.'
          : 'List each service or tier you offer as a separate option — for example, a designer might add Basic package (3 samples · 3 days · ₪250) and Premium (5 samples · 5 days · ₪450).'}
      </div>
      {tiers.map((tt, i) => {
        const missingName = !tt.name.trim();
        const missingPrice = !(parseFloat(tt.price) > 0);
        return (
        <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2" data-testid={`wizard-tier-${i}`}>
          <div className="flex items-end justify-between gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                {isAppt ? 'Service name' : 'Service or tier name'} <span className="text-red-500">*</span>
              </label>
              <input value={tt.name} onChange={(e) => onUpdate(i, { name: e.target.value })}
                placeholder={isAppt
                  ? (i === 0 ? 'e.g. Haircut' : 'Service name')
                  : (i === 0 ? 'e.g. Basic package' : 'Service name')}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 ${
                  missingName ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
                }`}
                data-testid={`wizard-tier-name-${i}`} />
            </div>
            {tiers.length > 1 && (
              <button type="button" onClick={() => onRemove(i)} className="text-red-500 p-2 mb-0.5" data-testid={`wizard-tier-remove-${i}`}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2 items-stretch">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-semibold text-sm">
                {tt.currency === 'USD' ? '$' : '₪'}
              </span>
              <select value={tt.currency} onChange={(e) => onUpdate(i, { currency: e.target.value })}
                className="appearance-none pl-7 pr-6 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30"
                data-testid={`wizard-tier-currency-${i}`}>
                <option value="ILS">ILS</option>
                <option value="USD">USD</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">▾</span>
            </div>
            <input type="number" value={tt.price} onChange={(e) => onUpdate(i, { price: e.target.value })}
              placeholder="Price"
              className={`flex-1 px-3 py-2 rounded-lg border text-sm ${missingPrice ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}
              data-testid={`wizard-tier-price-${i}`} />
            {isAppt ? (
              <div className="relative">
                <input type="number" min="5" step="5" value={tt.duration_minutes}
                  onChange={(e) => onUpdate(i, { duration_minutes: e.target.value })}
                  placeholder="Duration"
                  className="w-24 pl-3 pr-8 py-2 rounded-lg border border-gray-200 text-sm"
                  data-testid={`wizard-tier-duration-${i}`} />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500">min</span>
              </div>
            ) : (
              <input type="number" min="0" value={tt.delivery_days}
                onChange={(e) => onUpdate(i, { delivery_days: e.target.value })}
                placeholder="Days to complete"
                title="Turnaround in days — leave blank for on-the-spot services"
                className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                data-testid={`wizard-tier-days-${i}`} />
            )}
          </div>
          {i === 0 && (
            <p className="text-[11px] text-gray-500 leading-snug">
              {isAppt ? (
                <><span className="font-semibold">Duration</span> is how long this service takes (used to build your bookable time slots).</>
              ) : (
                <><span className="font-semibold">Days to complete</span> is the turnaround time. Leave blank for on-the-spot services.</>
              )}
            </p>
          )}
          <textarea value={tt.description} onChange={(e) => onUpdate(i, { description: e.target.value })} rows={2}
            placeholder="What's included (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />

          {/* Per-tier photo uploader — lets a provider give each option
              its own visual identity (e.g. "Jerusalem tour" vs. "Tel Aviv
              tour" photos). Max 6 per option; falls back to the gig-wide
              gallery on the public page when a tier has no images. */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-gray-600">
                Photos of this option <span className="text-gray-400 font-normal">(optional · max 6)</span>
              </p>
              {(tt.images || []).length < 6 && (
                <>
                  <input
                    ref={(el) => { fileInputsRef.current[i] = el; }}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { onUploadImages(i, e.target.files); e.target.value = ''; }}
                    data-testid={`wizard-tier-images-input-${i}`}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputsRef.current[i]?.click()}
                    className="text-[11px] font-semibold text-[#1E6A6A] flex items-center gap-0.5 hover:underline"
                    data-testid={`wizard-tier-images-add-${i}`}
                  >
                    <Plus size={11} /> Add photos
                  </button>
                </>
              )}
            </div>
            {(tt.images || []).length > 0 ? (
              <div className="grid grid-cols-6 gap-1.5">
                {tt.images.map((u, k) => (
                  <div key={u} className="relative aspect-square rounded-md bg-gray-100 group overflow-hidden" data-testid={`wizard-tier-image-${i}-${k}`}>
                    <div className="absolute inset-0" style={{ backgroundImage: `url(${u})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(i, u)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`wizard-tier-image-remove-${i}-${k}`}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">
                No photos yet — customers will see the main gig gallery instead.
              </p>
            )}
          </div>
          {(missingName || missingPrice) && (
            <p className="text-[11px] text-red-600 leading-snug flex items-center gap-1" data-testid={`wizard-tier-hint-${i}`}>
              <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
              {missingName && missingPrice
                ? 'Add a service name and a price above to continue.'
                : missingName
                  ? 'Give this service a name (e.g. Haircut, Deep clean).'
                  : 'Add a price greater than 0.'}
            </p>
          )}
        </div>
      );})}
      {tiers.length < 15 && (
        <button type="button" onClick={onAdd} className="text-sm font-semibold text-[#1E6A6A] flex items-center gap-1" data-testid="wizard-tier-add">
          <Plus size={14} /> Add another service or tier
        </button>
      )}
      {gigType === 'deliverable' && (
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white cursor-pointer" data-testid="wizard-date-booking-toggle">
          <input type="checkbox" checked={!!enableDateBooking} onChange={onToggleDateBooking} className="mt-1" />
          <div>
            <div className="text-sm font-semibold text-gray-900">Let customers pick a service date</div>
            <div className="text-xs text-gray-600 mt-0.5">
              Best for cleaners, movers, plumbers, or anyone whose customer needs to nail down the day the work happens. If off, customers just describe what they need in a message.
            </div>
          </div>
        </label>
      )}
    </div>
  );
};

// ---------- Step 5 — Appointment weekly availability ----------
const AvailabilityStep = ({ weekly, slotDuration, onToggleDay, onUpdateWindow, onSlotDurationChange }) => (
  <div className="space-y-4" data-testid="wizard-hours-step">
    <div className="rounded-xl bg-[#1E6A6A]/8 border border-[#1E6A6A]/20 p-3 text-xs text-[#1E6A6A] leading-snug">
      Tell us when you&apos;re open. We&apos;ll turn this into bookable time slots on your public page. You can adjust or add exceptions later from your dashboard.
    </div>
    <div>
      <label className="text-sm font-semibold text-gray-700">Slot length</label>
      <div className="mt-2 flex gap-2">
        {[15, 30, 45, 60, 90].map((mm) => (
          <button key={mm} type="button" onClick={() => onSlotDurationChange(mm)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              slotDuration === mm ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
            }`} data-testid={`wizard-slot-${mm}`}>
            {mm} min
          </button>
        ))}
      </div>
    </div>
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {DAYS.map((d) => {
        const wins = weekly[d.k] || [];
        const open = wins.length > 0;
        const win = wins[0] || { start: '09:00', end: '17:00' };
        return (
          <div key={d.k} className="p-3 flex items-center gap-3" data-testid={`wizard-day-${d.k}`}>
            <label className="flex items-center gap-2 w-24 flex-shrink-0 cursor-pointer">
              <input type="checkbox" checked={open} onChange={() => onToggleDay(d.k)} data-testid={`wizard-day-toggle-${d.k}`} />
              <span className="text-sm font-semibold text-gray-900">{d.label}</span>
            </label>
            {open ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={win.start} onChange={(e) => onUpdateWindow(d.k, { start: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm" data-testid={`wizard-day-start-${d.k}`} />
                <span className="text-gray-400 text-sm">–</span>
                <input type="time" value={win.end} onChange={(e) => onUpdateWindow(d.k, { end: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm" data-testid={`wizard-day-end-${d.k}`} />
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default CreateGig;
