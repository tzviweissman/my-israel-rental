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
 *   7. Contact + booking mode + area (all) — the last step.
 *
 * There used to be an eighth step: which commitment tier starts after the
 * free month, required before publishing and followed by a PayPal handoff.
 * Listing is free now, so a provider never sees a price and the wizard
 * ends at Contact.
 *
 * All state is local; we POST once on the final "Publish" click.
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import FaqEditor, { cleanFaqs } from '../components/marketplace/FaqEditor';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, ArrowLeft, ArrowRight, X,
  Store, Package, CalendarClock, ImagePlus,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import CategoryPicker from '../components/marketplace/CategoryPicker';
import { SUBCATEGORIES, subcategoryLabel } from '../lib/categories';
import { uploadFilesFast, reportUploadFailure, uploadOneFile } from '../utils/fastUpload';
import { useFormDraft, readDraft, clearDraft } from '../hooks/useFormDraft';
import { normalizeWhatsAppNumber, hasValidWhatsApp } from '../utils/whatsappLink';
import { productPhotos } from '../utils/productPhotos';
import SizeFields, { sizeValue } from '../components/marketplace/SizeFields';
import PhoneInput from '../components/common/PhoneInput';
import { useTranslation } from 'react-i18next';

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
  name: '', price: '', currency: prevCurrency, description: '', image: '', images: [], in_stock: true,
});

const CreateGig = () => {
  const { t } = useTranslation();
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Restored together with the answers: bringing someone back to step 1
  // with their text still in the boxes reads as "it lost my work" even
  // though nothing was lost.
  const [step, setStep] = useState(() => readDraft('create-gig')?.step || 1);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const productImageInputRef = useRef({});
  // Which business this listing is being added to, from ?business= on the
  // URL. Absent when someone starts from a generic "list your service"
  // link, in which case the server picks their first business exactly as
  // it always has. Read from the URL rather than the draft so that adding
  // to business #2 is never resumed against business #1.
  const targetBusinessId = searchParams.get('business') || null;

  /* The business itself, asked for on step 2 beside the listing's name
     (Tzvi, 22 Sep 2026: the logo should come earlier). Until now a first
     business was created silently, named after the person, with no logo,
     and the logo was only ever asked for later on the checklist.

     `existing` is null while loading, [] for someone with no business yet.
     The name box shows only then; the logo box shows whenever the business
     this listing goes to has no logo. Both optional: a blank name falls
     back to the person's name, exactly as before, and a business without a
     logo keeps showing its first letter. */
  const [existing, setExisting] = useState(null);
  const [bizName, setBizName] = useState('');
  const [bizLogo, setBizLogo] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/businesses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (alive) setExisting((data || []).filter((b) => b.active)); })
      .catch(() => { if (alive) setExisting([]); });
    return () => { alive = false; };
  }, [token]);
  const firstBusiness = existing !== null && existing.length === 0;
  const destination = existing && (existing.find((b) => b.id === targetBusinessId) || existing[0]);
  const askLogo = existing !== null && (firstBusiness || (destination && !destination.logo_url));

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploading(true);
    try {
      setBizLogo(await uploadOneFile(file, API, token));
    } catch (err) {
      toast.error(err?.message || t('businesses.logoFailed', 'Could not upload that image'));
    } finally {
      setLogoUploading(false);
    }
  };

  // Post-signup onboarding hook — when a provider lands here fresh from
  // the Google sign-in flow (?welcome=1), surface a one-shot friendly
  // banner + strip the flag from the URL so refreshes stay clean.
  const [showWelcome, setShowWelcome] = useState(searchParams.get('welcome') === '1');
  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      navigate(url.pathname + (url.search ? url.search : '') + url.hash, { replace: true });
    }
    // Runs once on mount — no deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A draft survives a reload — a deploy, a crashed tab, a phone killing
     a backgrounded browser. Restored silently: asking "recover your
     draft?" makes someone decide about work they never chose to lose,
     and the answer is always yes. */
  const [form, setForm] = useState(() => readDraft('create-gig')?.form || {
    gig_type: 'deliverable',
    title: '',
    category: '',
    subcategory: '',
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
    contact_email: '',
    area: '',
  });

  useFormDraft('create-gig', { form, step }, !submitted);

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
      toast.error(t('wizard.maxPhotos', 'Up to 6 photos per option'));
      return;
    }
    try {
      const results = await uploadFilesFast(arr, API, token, () => {});
      const good = results.filter((r) => r.url && !r.error);
      const failed = results.filter((r) => !r.url || r.error);
      if (failed.length) {
        // Say WHY. The reason sits right there on the result and was being
        // discarded in favour of "1 upload(s) failed", which tells the
        // person nothing — and tells us less, because these uploads go
        // from the browser straight to Cloudinary and never touch our
        // server, so the reason appeared in no log anywhere.
        //
        // This matters more since a photo became required to continue: a
        // failure here is no longer an annoyance, it is a wall.
        const why = failed.find((r) => r.error)?.error;
        toast.error(why
          ? t('sweep.uploadFailedWhy', { defaultValue: 'Photo upload failed — {{reason}}', reason: why })
          : t('sweep.uploadFailed', 'Photo upload failed. Please try a different photo.'));
        reportUploadFailure({ where: 'gig-wizard-tier', count: failed.length, reason: why, API, token });
      }
      if (good.length > 0) updateTier(i, { images: [...current, ...good.map((r) => r.url)] });
    } catch (err) {
      toast.error(err.message || t('wizard.uploadFailed', 'Upload failed'));
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

  // Appends rather than replaces, and takes a multi-select in one go.
  // One slot per product is what pushed a seller into listing the same
  // item twice just to show a second photo of it.
  const MAX_PRODUCT_PHOTOS = 6;
  const uploadProductImage = async (i, files) => {
    const chosen = Array.from(files || []).filter(Boolean);
    if (!chosen.length) return;
    const existing = productPhotos(form.products[i]);
    const room = MAX_PRODUCT_PHOTOS - existing.length;
    if (room <= 0) {
      toast.error(t('services.productPhotoLimit', { defaultValue: 'Up to {{n}} photos per product', n: MAX_PRODUCT_PHOTOS }));
      return;
    }
    try {
      const results = await uploadFilesFast(chosen.slice(0, room), API, token, () => {});
      const urls = results.map((r) => r?.url).filter(Boolean);
      if (!urls.length) {
        // Say WHY. Cloudinary's own message ("File size too large",
        // "Invalid image file") tells someone what to do next; a bare
        // "Upload failed" tells them to retry something that will fail
        // again the same way.
        toast.error(results.find((r) => r?.error)?.error || t('wizard.uploadFailed', 'Upload failed'));
        return;
      }
      const failed = results.length - urls.length;
      if (failed > 0) toast.error(t('wizard.someFailed', { count: failed, defaultValue: '{{count}} photos did not upload' }));
      // Write the whole set to `images` and clear the legacy single
      // field, so a product is described by exactly one of the two.
      updateProduct(i, { images: [...existing, ...urls], image: '' });
    } catch (err) {
      toast.error(err.message || t('wizard.uploadFailed', 'Upload failed'));
    }
  };

  const removeProductImage = (i, url) => {
    updateProduct(i, { images: productPhotos(form.products[i]).filter((u) => u !== url), image: '' });
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

  // ---- Gallery uploads live inside each tier / product now (per-tier
  // photos + per-product photos), so the gig-wide gallery step has been
  // removed from the wizard. `form.gallery` still exists as an empty
  // array so the payload shape is unchanged.

  useEffect(() => {
    if (!token) { navigate(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
    axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data));
    axios.get(`${API}/marketplace/locations`).then((r) => setLocations(r.data)).catch(() => {});
  }, [token, navigate]);

  // The appointment type inserts one extra step for weekly hours.
  const isAppointment = form.gig_type === 'appointment';
  // 'Plan' was the last step. Listing is free, so the wizard now ends at
  // Contact — dropping the label is what shortens the whole wizard, since
  // `totalSteps` (and therefore the progress dots and the Publish button)
  // are derived from this array.
  // THREE SCREENS (Tzvi, 23 Sep 2026: "make it quicker for people to sign
  // up and add their listing"). Type and overview share the first screen,
  // the description sits with the services or products on the second, and
  // contact is the last; appointments add their opening hours before it.
  // It was five or six screens for what is one short job.
  const stepLabels = useMemo(() => (
    isAppointment
      ? ['', t('wizard.screenBusiness', 'Your business'), t('wizard.screenOffer', 'What you offer'), t('wizard.screenHours', 'Opening hours'), t('wizard.screenContact', 'How customers reach you')]
      : ['', t('wizard.screenBusiness', 'Your business'), t('wizard.screenOffer', 'What you offer'), t('wizard.screenContact', 'How customers reach you')]
  ), [isAppointment, t]);
  const totalSteps = stepLabels.length - 1;
  useEffect(() => { if (step > totalSteps) setStep(totalSteps); }, [step, totalSteps]);
  // The phone given at sign-up fills the WhatsApp box, so it is not typed
  // twice. Only when the box is empty; still editable.
  useEffect(() => {
    const n = user?.whatsapp_number || user?.phone;
    if (n && !form.whatsapp) set({ whatsapp: n });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const canNext = () => {
    // screen 1: type, title, category
    if (step === 1) return !!form.gig_type && !!form.title.trim() && !!form.category;
    // screen 2: description, then the primary list (products or tiers)
    if (step === 2) {
      if (form.description.trim().length <= 10) return false;
      // A photo is required here, not only at submit. It was checked once,
      // at the very end (see hasAnyPhoto), which meant someone could fill in
      // four more screens before being told to go back — and "at least one
      // photo anywhere" let most options ship with none.
      if (form.gig_type === 'store') {
        return form.products.length > 0
          && form.products.every((p) => (
            p.name.trim() && parseFloat(p.price) > 0
            && (p.image || (p.images || []).length > 0)
          ));
      }
      return form.tiers.length > 0
        && form.tiers.every((t) => (
          t.name.trim() && parseFloat(t.price) > 0 && (t.images || []).length > 0
        ));
    }
    // Appointment inserts hours as screen 3
    if (isAppointment && step === 3) {
      const anyOpen = DAYS.some((d) => (form.weekly_availability[d.k] || []).length > 0);
      return anyOpen;
    }
    // Plan selection is the final step now; contact is the one before it.
    const contactStep = isAppointment ? 4 : 3;
    if (step === contactStep) {
      if (!(form.area || '').trim()) return false;
      // Gate on the same normalizer the gig detail page uses to build the
      // wa.me link, so the wizard can never publish a gig whose WhatsApp
      // CTA would silently fall back to the in-platform flow.
      if (form.booking_mode === 'whatsapp') return hasValidWhatsApp(form.whatsapp);
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
    if (step === 1) {
      if (!form.gig_type) return t('wizard.reasonType', 'Pick a listing type to continue.');
      if (!form.title.trim()) return t('wizard.reasonTitle', 'Add a title above.');
      if (!form.category) return t('wizard.reasonCategory', 'Pick a category above.');
    }
    if (step === 2) {
      if (form.description.trim().length <= 10) return t('wizard.reasonDescription', 'Write at least 10 characters describing what you offer.');
      if (form.gig_type === 'store') {
        const bad = form.products.find((p) => !p.name.trim() || !(parseFloat(p.price) > 0));
        if (bad && !bad.name.trim()) return t('wizard.reasonProductName', 'Give every product a name.');
        if (bad) return t('wizard.reasonProductPrice', 'Every product needs a price greater than 0.');
      } else {
        const bad = form.tiers.find((t) => !t.name.trim() || !(parseFloat(t.price) > 0));
        if (bad && !bad.name.trim()) return t('wizard.reasonTierName', 'Give every service a name (see the highlighted field).');
        if (bad) return t('wizard.reasonTierPrice', 'Every service needs a price greater than 0.');
      }
      // Named last so the earlier, cheaper problems are reported first —
      // being sent to find a photo while the price is still empty would
      // mean two trips.
      const noPhoto = form.gig_type === 'store'
        ? form.products.find((p) => !p.image && !(p.images || []).length)
        : form.tiers.find((t) => !(t.images || []).length);
      if (noPhoto) {
        return t('sweep.needPhotoEach', {
          defaultValue: 'Add at least one photo to "{{name}}" — listings with a photo get far more enquiries.',
          name: (noPhoto.name || '').trim() || t('sweep.thisOne', 'this one'),
        });
      }
    }
    if (isAppointment && step === 3) return t('wizard.reasonHours', 'Turn on at least one open day so customers can book you.');
    const contactStep = isAppointment ? 4 : 3;
    if (step === contactStep) {
      if (!(form.area || '').trim()) return t('wizard.reasonArea', 'Pick a service area (city).');
      if (form.booking_mode === 'whatsapp' && !hasValidWhatsApp(form.whatsapp)) {
        return t('services.whatsappInvalid', 'Enter a valid WhatsApp number — e.g. 050-123-4567 or +972 50 123 4567.');
      }
    }
    return '';
  };

  // A listing must show something. Checked across all three places a
  // photo can live — the gig gallery, a product, a tier — because the
  // wizard dropped its gallery step and photos now hang off tiers and
  // products, so looking only at form.gallery would reject everybody.
  const hasAnyPhoto = () =>
    (form.gallery || []).length > 0
    || (form.products || []).some((pr) => pr.image || (pr.images || []).length)
    || (form.tiers || []).some((tr) => (tr.images || []).length);

  const submit = async () => {
    if (!hasAnyPhoto()) {
      // Stopped here as well as on the server so the reason arrives
      // before the save, not as a failure after it.
      toast.error(t('services.photoRequired',
        'Add at least one photo — a listing without one is very hard to book.'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        gig_type: form.gig_type,
        title: form.title,
        category: form.category,
        // Optional narrowing tag. The buyer-side filter on /businesses has
        // read this since the merged categories shipped and no provider
        // could ever set it, so it could never match anything
        // (dead-ends audit 2026-09-08, #5). Only sent when it belongs to
        // the chosen category — a stale value from a category the person
        // changed their mind about would be a wrong tag, not a missing one.
        subcategory: (SUBCATEGORIES[form.category] || []).some((x) => x.slug === form.subcategory)
          ? form.subcategory
          : null,
        description: form.description,
        faqs: cleanFaqs(form.faqs),
        gallery: form.gallery,
        booking_mode: form.booking_mode,
        whatsapp: form.whatsapp,
        whatsapp_confirmed: hasValidWhatsApp(form.whatsapp),
        contact_email: (form.contact_email || '').trim() || null,
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
          // BOTH fields. The uploader writes the gallery to `images` and
          // deliberately CLEARS `image` (see uploadProductImage), so
          // sending only `image` sent null every time — every product
          // photo a store uploaded was discarded at publish, silently,
          // because the thumbnails on screen were reading `images`.
          //
          // Harmless until a photo became required server-side, at which
          // point the payload arrived with no photo anywhere and was
          // rejected with "Add at least one photo" — to someone who had
          // just watched six of them upload. Reported as trouble
          // uploading photos; the uploads were never the problem.
          images: p.images || [],
          image: p.image || null,
          in_stock: !!p.in_stock,
          width_cm: sizeValue(p.width_cm),
          length_cm: sizeValue(p.length_cm),
        })) : [],
        weekly_availability: form.gig_type === 'appointment' ? form.weekly_availability : null,
        slot_duration_minutes: form.gig_type === 'appointment' ? form.slot_duration_minutes : null,
        enable_date_booking: form.gig_type === 'deliverable' ? !!form.enable_date_booking : false,
        // Null is meaningful: it tells the server to fall back to the
        // caller's first business, which is the pre-multi-business
        // behaviour and the right answer for a generic entry point.
        business_id: targetBusinessId,
      };
      const auth = { headers: { Authorization: `Bearer ${token}` } };
      // The business first, with the name and logo from step 2, so the
      // listing is published under it rather than under a silent default.
      if (firstBusiness && (bizName.trim().length >= 2 || bizLogo)) {
        // A blank name falls back to the person's name, as the silent
        // default always did. The API needs two characters.
        const name = [bizName.trim(), (user?.name || '').trim(), 'My business'].find((n) => n.length >= 2);
        const { data: biz } = await axios.post(`${API}/marketplace/businesses`, {
          name, logo_url: bizLogo || null,
        }, auth).catch(() => ({ data: null }));
        if (biz?.id) payload.business_id = biz.id;
      } else if (bizLogo && destination && !destination.logo_url) {
        await axios.patch(`${API}/marketplace/businesses/${destination.id}`, { logo_url: bizLogo }, auth).catch(() => {});
      }
      const { data } = await axios.post(`${API}/marketplace/gigs`, payload, auth);
      // The translation now runs in the background (it used to hold the
      // publish for 3-6 s so this toast could say "also translated"). Say
      // what is true instead: it is coming.
      toast.success(t('services.publishedTranslating', 'Published! The translation appears in a moment.'));

      // Publishing used to be followed by /subscription/select-plan and a
      // PayPal handoff for the plan starting after the free month. Listing
      // is free, so publishing now ends at the gig itself.
      // Published: the draft has served its purpose and must not
      // reappear the next time they open the wizard.
      setSubmitted(true);
      clearDraft('create-gig');
      // Someone who just added their FIRST business goes straight into the
      // walk (components/tour), which starts on their page. `tour=first`
      // starts it only if this account has never taken it, on any device.
      navigate(firstBusiness ? '/dashboard?tour=first' : `/businesses/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('wizard.publishFailed', 'Could not publish. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  // Which real step index maps to contact given the optional hours step.
  const contactStep = isAppointment ? 4 : 3;

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="create-gig-page">
      <PageMeta title={t('wizard.metaTitle', 'Add your business | MyIsraelRental')} description={t('wizard.metaDescription', 'List your business on MyIsraelRental, free.')} path="/services/create" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {showWelcome && (
          <div
            className="mb-6 relative rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[#0F3A3A] text-white p-5 shadow-lg"
            data-testid="create-gig-welcome-banner"
          >
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
              aria-label={t('wizard.dismiss', 'Dismiss')}
              data-testid="create-gig-welcome-dismiss"
            >
              <X size={16} />
            </button>
            <div className="pr-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)] mb-1">
                {t('wizard.welcomeEyebrow', 'Welcome aboard')}
              </div>
              <div className="text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-head)' }}>
                {t('wizard.welcomeTitle', 'Let us create your first listing')}
              </div>
              <p className="text-sm text-white/85 leading-snug">
                {t('wizard.welcomeBody', 'Tell us what you offer. Customers see your listing as soon as you publish it.')}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
            <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`} />
          ))}
        </div>
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-head)' }}>
          {stepLabels[step]}
        </h1>

        {/* --- Step 1: Gig type picker --- */}
        {step === 1 && (
          <div className="space-y-3 mb-6" data-testid="wizard-type-picker">
            <p className="text-sm text-gray-600 mb-3">
              {t('wizard.typeIntro', 'Choose the type of listing that best fits your business. This changes what we ask next, so we only ask what is relevant.')}
            </p>
            {GIG_TYPES.map((gt) => {
              const Icon = gt.icon;
              const active = form.gig_type === gt.id;
              return (
                <button
                  key={gt.id}
                  type="button"
                  onClick={() => setGigType(gt.id)}
                  className={`w-full text-start rounded-2xl border-2 p-4 flex gap-4 items-start transition-all ${
                    active
                      ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 shadow-md'
                      : 'border-gray-200 bg-white hover:border-[var(--gold)] hover:shadow-sm'
                  }`}
                  data-testid={`wizard-type-${gt.id}`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-900">{t(`wizard.type_${gt.id}`, gt.label)}</div>
                    <div className="text-sm text-gray-700 mt-0.5">{t(`wizard.type_${gt.id}_tagline`, gt.tagline)}</div>
                    <div className="text-xs text-gray-500 mt-1">{t('wizard.examples', 'Examples:')} {t(`wizard.type_${gt.id}_examples`, gt.examples)}</div>
                  </div>
                  {active && (
                    <div className="w-5 h-5 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs">✓</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* --- Screen 1, continued: overview (title + category) --- */}
        {step === 1 && (
          <div className="space-y-4">
            {askLogo && (
              <div className="rounded-xl border bg-white p-4 flex items-start gap-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="wizard-business">
                <label className="shrink-0 cursor-pointer" aria-label={t('wizard.logoPick', 'Choose a logo')}>
                  <input type="file" accept="image/*" className="hidden" onChange={pickLogo} data-testid="wizard-logo-input" />
                  <span className="h-20 w-20 rounded-xl border-2 border-dashed inline-flex items-center justify-center overflow-hidden"
                    style={{ borderColor: 'var(--brand-border)', background: 'var(--surface-muted, #f9fafb)' }}>
                    {bizLogo
                      ? <img src={bizLogo} alt="" className="h-full w-full object-cover" data-testid="wizard-logo-preview" />
                      : logoUploading
                        ? <Loader2 className="animate-spin" size={18} style={{ color: 'var(--brand-muted)' }} />
                        : <span className="text-xs text-center px-2" style={{ color: 'var(--brand-muted)' }}>{t('wizard.logoAdd', 'Add logo')}</span>}
                  </span>
                </label>
                <div className="flex-1 min-w-0">
                  {firstBusiness && (
                    <>
                      <label className="text-sm font-semibold text-gray-700">{t('wizard.businessName', 'Business name')}</label>
                      <input value={bizName} onChange={(e) => setBizName(e.target.value)} dir="auto"
                        placeholder={t('wizard.businessNamePlaceholder', 'e.g. Cohen Cleaning')}
                        className="w-full mt-1 px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] text-sm"
                        data-testid="wizard-business-name" />
                    </>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
                    {t('wizard.logoHint', 'Your logo shows on your page and beside everything you list. Optional:')}{' '}
                    <span className="font-semibold">{t('wizard.logoLater', 'you can add it later.')}</span>
                  </p>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700">{t('wizard.title', 'Title')}</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })}
                placeholder={form.gig_type === 'store'
                  ? t('wizard.titlePhStore', 'e.g. Modern furniture, Tel Aviv showroom')
                  : t('wizard.titlePh', 'e.g. Deep apartment cleaning')}
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" data-testid="wizard-title" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">{t('wizard.category', 'Category')}</label>
              {/* Grouped (spec N2). Same testids as the flat grid it
                  replaced — `wizard-cat-<slug>` — so nothing that
                  referenced them needs to change. */}
              <div className="mt-2">
                <CategoryPicker
                  categories={categories}
                  value={form.category}
                  onChange={(slug) => set({ category: slug, subcategory: '' })}
                  testidPrefix="wizard-cat"
                  variant="primary"
                />
              </div>
            </div>
            {/* The four merged categories carry sub-buckets, and the board
                already filters on them. Same chips and the same
                SUBCATEGORIES list the filter reads, so the two cannot
                offer different options. Never required. */}
            {SUBCATEGORIES[form.category] && (
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  {t('services.specificType', 'Specific type')}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('services.specificTypeProviderHint', 'Optional — customers filter by this, so it helps the right ones find you.')}
                </p>
                <div className="flex flex-wrap gap-2 mt-2" data-testid="wizard-subcategory-row">
                  {SUBCATEGORIES[form.category].map((sub) => (
                    <button
                      key={sub.slug}
                      type="button"
                      onClick={() => set({ subcategory: form.subcategory === sub.slug ? '' : sub.slug })}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        form.subcategory === sub.slug
                          ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]'
                      }`}
                      aria-pressed={form.subcategory === sub.slug}
                      data-testid={`wizard-sub-${sub.slug}`}
                    >
                      {subcategoryLabel(sub, t)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Screen 2: description, then the services or products --- */}
        {step === 2 && (
          <div className="space-y-4">
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={8}
              placeholder={t('wizard.descriptionPh', 'Describe what you offer, who it is for, and what is included…')}
              className="w-full px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" data-testid="wizard-description" />
            <p className="text-xs text-gray-500">{t('wizard.descriptionHint', 'At least 10 characters. It is translated automatically, so write it once, in either language.')}</p>
          </div>
        )}

        {/* --- Screen 2, continued: products or services --- */}
        {step === 2 && form.gig_type === 'store' && (
          <StoreProductsStep
            products={form.products}
            onUpdate={updateProduct}
            onAdd={addProduct}
            onRemove={removeProduct}
            productImageInputRef={productImageInputRef}
            onUploadImage={uploadProductImage}
            onRemoveImage={removeProductImage}
          />
        )}
        {step === 2 && form.gig_type !== 'store' && (
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
        {/* The optional FAQs, last on the screen, after what is required. */}
        {step === 2 && (
          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--brand-border)' }}>
            <FaqEditor faqs={form.faqs || []} onChange={(faqs) => set({ faqs })} testidPrefix="wizard-faq" />
          </div>
        )}

        {isAppointment && step === 3 && (
          <AvailabilityStep
            weekly={form.weekly_availability}
            slotDuration={form.slot_duration_minutes}
            onToggleDay={toggleDayOpen}
            onUpdateWindow={updateWindow}
            onSlotDurationChange={(v) => set({ slot_duration_minutes: v })}
          />
        )}

        {/* --- Contact step --- */}
        {step === contactStep && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                {form.gig_type === 'store' ? t('wizard.reachStore', 'How should buyers reach you?') : t('wizard.reachService', 'How should clients book?')}
              </label>
              {/* Provider's contact preference. Both paths are fully
                  supported for services — unlike rentals, where WhatsApp is
                  currently the only primary CTA pending Meta approval. */}
              <div className="mt-2 flex gap-2">
                {[
                  {
                    v: 'whatsapp',
                    label: form.gig_type === 'store' ? t('wizard.modeWaStore', 'Message on WhatsApp') : t('wizard.modeWa', 'Book on WhatsApp'),
                    hint: t('services.contactHintWhatsApp', 'Customers open a WhatsApp chat with you directly.'),
                  },
                  {
                    v: 'in_platform',
                    label: form.gig_type === 'store' ? t('wizard.modeSiteStore', 'Message on MyIsraelRental') : t('wizard.modeSite', 'Book on MyIsraelRental'),
                    hint: t('services.contactHintInPlatform', 'Requests arrive in your MyIsraelRental inbox — no phone number shared.'),
                  },
                ].map((o) => (
                  <button key={o.v} type="button" onClick={() => set({ booking_mode: o.v })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border text-start ${
                      form.booking_mode === o.v ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]'
                    }`} data-testid={`wizard-booking-${o.v}`}>
                    <span className="block">{o.label}</span>
                    <span className={`block text-[11px] font-normal mt-0.5 leading-snug ${
                      form.booking_mode === o.v ? 'text-[rgb(var(--gold-rgb)/<alpha-value>)]/80' : 'text-gray-500'
                    }`}>{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            {form.booking_mode === 'whatsapp' && (
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  {t('services.whatsappNumberLabel', 'WhatsApp number')}
                </label>
                <div className="mt-1">
                  <PhoneInput
                    value={form.whatsapp}
                    onChange={(v) => set({ whatsapp: v })}
                    error={(form.whatsapp || '').trim() && !hasValidWhatsApp(form.whatsapp)
                      ? t('services.whatsappInvalid', 'Enter a valid WhatsApp number.')
                      : ''}
                    hint={hasValidWhatsApp(form.whatsapp)
                      ? t('services.whatsappResolved', {
                          defaultValue: 'Customers will message you at +{{number}}',
                          number: normalizeWhatsAppNumber(form.whatsapp),
                        })
                      : ''}
                    testid="wizard-whatsapp"
                  />
                </div>

                {/* Typing a number into a field labelled WhatsApp is the
                    confirmation. A separate "yes, it has WhatsApp" tick-box
                    asked the same thing twice (Tzvi, 22 Sep 2026); it is
                    set from the number on submit. */}
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-700">
                {t('services.contactEmailLabel', 'Contact email (optional)')}
              </label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => set({ contact_email: e.target.value })}
                placeholder={t('services.contactEmailPh', 'you@example.com')}
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="wizard-contact-email"
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                {t(
                  'services.contactEmailHint',
                  'Shown on your listing so customers can email you. Your account email is never shown.',
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">{t('wizard.area', 'Service area')} <span className="text-red-500">*</span></label>
              <input value={form.area} onChange={(e) => set({ area: e.target.value })}
                placeholder={t('wizard.areaPh', 'Tel Aviv, Jerusalem, Haifa…')} list="services-city-suggestions"
                className={`w-full mt-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-[var(--brand-primary)] ${
                  (form.area || '').trim() ? 'border-gray-200' : 'border-gray-300'
                }`} data-testid="wizard-area" />
              <datalist id="services-city-suggestions">
                {locations.map((l) => (<option key={l.slug} value={l.label} />))}
              </datalist>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                {t('wizard.areaHint', 'Pick a city so people nearby can find you with')} <span className="font-semibold">{t('sweep.showNearby', 'Show nearby')}</span>.
              </p>
            </div>
          </div>
        )}

        {/* The plan step used to live here — "which plan starts after the
            free month", with a PlanPicker and a PayPal handoff. Listing is
            free now, so the wizard ends at the contact step. Removed rather
            than hidden: a disabled step still has to be walked past, and
            the whole point is that a provider never sees a price. */}

        <div className="flex flex-col items-end mt-8 gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" disabled={step === 1} onClick={() => setStep((s) => s - 1)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 disabled:opacity-30 flex items-center gap-1 self-start sm:self-auto" data-testid="wizard-back">
            <ArrowLeft size={14} className="rtl:rotate-180" /> {t('wizard.back', 'Back')}
          </button>
          <div className="flex flex-col items-end gap-1">
            {step < totalSteps ? (
              <button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] disabled:opacity-40 flex items-center gap-1" data-testid="wizard-next">
                {t('wizard.next', 'Next')} <ArrowRight size={14} className="rtl:rotate-180" />
              </button>
            ) : (
              <button type="button" disabled={!canNext() || saving} onClick={submit}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] disabled:opacity-40 flex items-center gap-1" data-testid="wizard-publish">
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>{t('wizard.publishing', 'Publishing…')}</span>
                  </>
                ) : (
                  <>{t('wizard.publish', 'Publish')} <ArrowRight size={14} className="rtl:rotate-180" /></>
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
const StoreProductsStep = ({ products, onUpdate, onAdd, onRemove, productImageInputRef, onUploadImage, onRemoveImage }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4" data-testid="wizard-products-step">
    <div className="rounded-xl bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 p-3 text-xs text-[var(--brand-primary)] leading-snug">
      {t('wizard.productsIntro', 'Add each product you sell as its own row, with photos, a price and a short description. Customers browse them and message you to buy.')}
    </div>
    {products.map((p, i) => (
      <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3" data-testid={`wizard-product-${i}`}>
        <div className="flex gap-3">
          {/* Product photos — a strip, not a slot. The single slot this
              replaces is why a seller listed the same box twice just to
              show a second picture of it. */}
          <div className="flex-shrink-0">
            <input
              ref={(el) => { productImageInputRef.current[i] = el; }}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { onUploadImage(i, e.target.files); e.target.value = ''; }}
              data-testid={`wizard-product-image-input-${i}`}
            />
            {/* One column of photos on a phone, two from sm up: two columns
                left the name and price boxes too narrow to type in at 375. */}
            <div className="flex flex-wrap gap-1.5 w-20 sm:w-[10.5rem]">
              {productPhotos(p).map((url) => (
                <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(i, url)}
                    className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center"
                    aria-label={t('wizard.removePhoto', 'Remove photo')}
                    data-testid={`wizard-product-image-remove-${i}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {productPhotos(p).length < 6 && (
                <button
                  type="button"
                  onClick={() => productImageInputRef.current[i]?.click()}
                  /* Red while empty: a photo is required to continue, and a
                     neutral grey tile reads as optional. */
                  className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                    productPhotos(p).length === 0
                      ? 'border-red-300 bg-red-50/40 hover:bg-red-50'
                      : 'border-gray-300 hover:border-[var(--brand-primary)]'
                  }`}
                  title={productPhotos(p).length === 0 ? t('sweep.addAPhoto', 'Add a photo of this service') : undefined}
                  data-testid={`wizard-product-image-btn-${i}`}
                >
                  <ImagePlus size={20} className={productPhotos(p).length === 0 ? 'text-red-500' : 'text-gray-400'} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <input value={p.name} onChange={(e) => onUpdate(i, { name: e.target.value })}
              placeholder={t('wizard.productNamePh', 'Product name (e.g. Oak dining table)')}
              className="w-full px-3 py-2 rounded-lg border bg-white border-gray-300 text-sm font-semibold focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 placeholder:text-gray-400 placeholder:font-normal"
              data-testid={`wizard-product-name-${i}`} />
            <div className="flex gap-2 items-stretch">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-semibold text-sm">
                  {p.currency === 'USD' ? '$' : '₪'}
                </span>
                <select value={p.currency} onChange={(e) => onUpdate(i, { currency: e.target.value })}
                  className="appearance-none pl-7 pr-6 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
                  data-testid={`wizard-product-currency-${i}`}>
                  <option value="ILS">ILS</option>
                  <option value="USD">USD</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">▾</span>
              </div>
              <input type="number" value={p.price} onChange={(e) => onUpdate(i, { price: e.target.value })}
                placeholder={t("sweep.price", "Price")} className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm"
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
          placeholder={t('wizard.productDescPh', 'Short description (optional): size, materials, colours…')}
          className="w-full px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" />
        <SizeFields option={p} onChange={(patch) => onUpdate(i, patch)} testid={`wizard-product-size-${i}`} />
      </div>
    ))}
    <button type="button" onClick={onAdd} className="text-sm font-semibold text-[var(--brand-primary)] flex items-center gap-1" data-testid="wizard-product-add">
      <Plus size={14} /> {t('wizard.addProduct', 'Add another product')}
    </button>
  </div>
  );
};

// ---------- Step 4B — Deliverable + Appointment tiers ----------
const TiersStep = ({ gigType, tiers, onUpdate, onAdd, onRemove, onUploadImages, onRemoveImage, enableDateBooking, onToggleDateBooking }) => {
  const { t } = useTranslation();
  const isAppt = gigType === 'appointment';
  const fileInputsRef = React.useRef({});
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 p-3 text-xs text-[var(--brand-primary)] leading-snug">
        {isAppt
          ? t('wizard.tiersIntroAppt', 'List each service people can book. A barber might add Haircut (30 min · ₪60), Beard trim (15 min · ₪30) and Full grooming (45 min · ₪90). The length is what builds your booking times.')
          : t('wizard.tiersIntro', 'List each service or package as its own option. A designer might add Basic (3 samples · 3 days · ₪250) and Premium (5 samples · 5 days · ₪450).')}
      </div>
      {tiers.map((tt, i) => {
        const missingName = !tt.name.trim();
        const missingPrice = !(parseFloat(tt.price) > 0);
        // A photo is now required to leave this step. It was optional, and
        // the prompt for it was grey italic text under a small text link —
        // easy to read as a note rather than something to act on.
        const missingPhoto = !(tt.images || []).length;
        return (
        <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2" data-testid={`wizard-tier-${i}`}>
          <div className="flex items-end justify-between gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                {isAppt ? t('wizard.serviceName', 'Service name') : t('wizard.tierName', 'Service or package name')} <span className="text-red-500">*</span>
              </label>
              <input value={tt.name} onChange={(e) => onUpdate(i, { name: e.target.value })}
                placeholder={i === 0
                  ? (isAppt ? t('wizard.serviceNamePhAppt', 'e.g. Haircut') : t('wizard.serviceNamePh', 'e.g. Basic package'))
                  : t('wizard.serviceName', 'Service name')}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 ${
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
          {/* flex-wrap, and the price keeps a floor width: at 375px the
              currency select + price + "Days to complete" did not fit on one
              line and the days field was clipped off the right edge of the
              card. Wrapping puts it on its own line on a phone and leaves
              the desktop layout unchanged. */}
          <div className="flex flex-wrap gap-2 items-stretch">
            <div className="relative shrink-0">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-semibold text-sm">
                {tt.currency === 'USD' ? '$' : '₪'}
              </span>
              <select value={tt.currency} onChange={(e) => onUpdate(i, { currency: e.target.value })}
                className="appearance-none pl-7 pr-6 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
                data-testid={`wizard-tier-currency-${i}`}>
                <option value="ILS">ILS</option>
                <option value="USD">USD</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">▾</span>
            </div>
            <input type="number" value={tt.price} onChange={(e) => onUpdate(i, { price: e.target.value })}
              placeholder={t("sweep.price", "Price")}
              className={`flex-1 min-w-[5.5rem] px-3 py-2 rounded-lg border text-sm ${missingPrice ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}
              data-testid={`wizard-tier-price-${i}`} />
            {isAppt ? (
              <div className="relative shrink-0">
                <input type="number" min="5" step="5" value={tt.duration_minutes}
                  onChange={(e) => onUpdate(i, { duration_minutes: e.target.value })}
                  placeholder={t("sweep.duration", "Duration")}
                  className="w-28 pl-3 pr-8 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm"
                  data-testid={`wizard-tier-duration-${i}`} />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500">{t('wizard.min', 'min')}</span>
              </div>
            ) : (
              <input type="number" min="0" value={tt.delivery_days}
                onChange={(e) => onUpdate(i, { delivery_days: e.target.value })}
                placeholder={t('sweep.daysToComplete', 'Days to complete')}
                title={t('wizard.daysTitle', 'Turnaround in days. Leave blank for on-the-spot services.')}
                className="w-44 shrink-0 px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm"
                data-testid={`wizard-tier-days-${i}`} />
            )}
          </div>
          {i === 0 && (
            <p className="text-[11px] text-gray-500 leading-snug">
              {isAppt ? (
                <><span className="font-semibold">{t('sweep.duration', 'Duration')}</span> {t('wizard.durationHint', 'is how long this service takes. It builds your booking times.')}</>
              ) : (
                <><span className="font-semibold">{t('sweep.daysToComplete', 'Days to complete')}</span> {t('wizard.daysHint', 'is the turnaround time. Leave blank for on-the-spot services.')}</>
              )}
            </p>
          )}
          <textarea value={tt.description} onChange={(e) => onUpdate(i, { description: e.target.value })} rows={2}
            placeholder={t('wizard.includedPh', 'What is included (optional)')} className="w-full px-3 py-2 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" />

          {/* Per-tier photo uploader — lets a provider give each option
              its own visual identity (e.g. "Jerusalem tour" vs. "Tel Aviv
              tour" photos). Max 6 per option; falls back to the gig-wide
              gallery on the public page when a tier has no images. */}
          <div className="pt-1">
            {/* The shape hint. Businesses upload flyers; a portrait flyer
                is shown whole (never cropped) but small, between two soft
                bars, and one owner asked why his did not fill the page.
                Say what fills it, once, where the file is chosen. */}
            <p className="text-[11px] mb-1" style={{ color: 'var(--brand-muted)' }}>
              {t('sweep.photoShapeHint', 'Landscape photos fill the page best (16:9, about 1600 × 900). A portrait flyer is shown whole, but smaller.')}
            </p>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-gray-600">
                {t('sweep.tierPhotos', 'Photos of this service')}{' '}
                <span className={missingPhoto ? 'text-red-600 font-semibold' : 'text-gray-400 font-normal'}>
                  {missingPhoto
                    ? t('sweep.photoRequiredTag', '(required)')
                    : t('sweep.photoMax', '(max 6)')}
                </span>
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
                    className="text-[11px] font-semibold text-[var(--brand-primary)] flex items-center gap-0.5 hover:underline"
                    data-testid={`wizard-tier-images-add-${i}`}
                  >
                    <Plus size={11} /> {t('sweep.addPhotos', 'Add photos')}
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
              /* A dashed target the whole width of the card, rather than a
                 line of grey italic prose. The same tap it always was, but
                 it now looks like something to do. */
              <button
                type="button"
                onClick={() => fileInputsRef.current[i]?.click()}
                className="w-full rounded-lg border-2 border-dashed border-red-300 bg-red-50/40 py-3 px-3 flex flex-col items-center gap-0.5 text-center hover:bg-red-50 transition-colors"
                data-testid={`wizard-tier-images-empty-${i}`}
              >
                <ImagePlus size={16} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700">
                  {t('sweep.addAPhoto', 'Add a photo of this service')}
                </span>
                <span className="text-[11px] text-red-600/80 leading-snug">
                  {t('sweep.photoWhy', 'Listings with a photo get far more enquiries.')}
                </span>
              </button>
            )}
          </div>
          {(missingName || missingPrice) && (
            <p className="text-[11px] text-red-600 leading-snug flex items-center gap-1" data-testid={`wizard-tier-hint-${i}`}>
              <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
              {missingName && missingPrice
                ? t('wizard.tierNeedBoth', 'Add a service name and a price above to continue.')
                : missingName
                  ? t('wizard.tierNeedName', 'Give this service a name (e.g. Haircut, Deep clean).')
                  : t('wizard.tierNeedPrice', 'Add a price greater than 0.')}
            </p>
          )}
        </div>
      );})}
      {tiers.length < 15 && (
        <button type="button" onClick={onAdd} className="text-sm font-semibold text-[var(--brand-primary)] flex items-center gap-1" data-testid="wizard-tier-add">
          <Plus size={14} /> {t('wizard.addTier', 'Add another service')}
        </button>
      )}
      {gigType === 'deliverable' && (
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white cursor-pointer" data-testid="wizard-date-booking-toggle">
          <input type="checkbox" checked={!!enableDateBooking} onChange={onToggleDateBooking} className="mt-1" />
          <div>
            <div className="text-sm font-semibold text-gray-900">{t('wizard.dateBooking', 'Let customers pick a service date')}</div>
            <div className="text-xs text-gray-600 mt-0.5">
              {t('wizard.dateBookingHint', 'Best for cleaners, movers, plumbers, or anyone whose customer needs to fix the day the work happens. If off, customers describe what they need in a message.')}
            </div>
          </div>
        </label>
      )}
    </div>
  );
};

// ---------- Step 5 — Appointment weekly availability ----------
const AvailabilityStep = ({ weekly, slotDuration, onToggleDay, onUpdateWindow, onSlotDurationChange }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4" data-testid="wizard-hours-step">
    <div className="rounded-xl bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 p-3 text-xs text-[var(--brand-primary)] leading-snug">
      {t('wizard.hoursIntro', 'Tell us when you are open. We turn this into booking times on your page. You can change it or add exceptions later from your dashboard.')}
    </div>
    <div>
      <label className="text-sm font-semibold text-gray-700">{t('sweep.slotLength', 'Slot length')}</label>
      <div className="mt-2 flex gap-2">
        {[15, 30, 45, 60, 90].map((mm) => (
          <button key={mm} type="button" onClick={() => onSlotDurationChange(mm)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              slotDuration === mm ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
            }`} data-testid={`wizard-slot-${mm}`}>
            {mm} {t('wizard.min', 'min')}
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
              <span className="text-sm font-semibold text-gray-900">{t(`wizard.day_${d.k}`, d.label)}</span>
            </label>
            {open ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={win.start} onChange={(e) => onUpdateWindow(d.k, { start: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" data-testid={`wizard-day-start-${d.k}`} />
                <span className="text-gray-400 text-sm">–</span>
                <input type="time" value={win.end} onChange={(e) => onUpdateWindow(d.k, { end: e.target.value })}
                  className="px-2 py-1.5 rounded-lg border bg-white border-gray-300 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20 text-sm" data-testid={`wizard-day-end-${d.k}`} />
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">{t('wizard.closed', 'Closed')}</span>
            )}
          </div>
        );
      })}
    </div>
  </div>
  );
};

export default CreateGig;
