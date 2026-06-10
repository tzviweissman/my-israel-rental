/**
 * Quick Add Property form — admin → Import tab.
 *
 * The lightweight alternative to the bulk CSV flow: paste in a single
 * listing's details + drag-and-drop the photos, and the backend creates
 * (or reuses) the owner account by email and attaches the property under
 * it. Re-submissions with the same `owner_email` accumulate under the
 * same account, so brokers can add 5 properties for one landlord by
 * filling in this form 5 times without re-typing the email after the
 * first submit (we remember it).
 */
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Mail, User, Phone, MapPin, Home as HomeIcon, Bed, Bath, Banknote,
  ImageIcon, Loader2, CheckCircle2, X, Upload, Plus,
} from 'lucide-react';
import { uploadFilesFast } from '../../utils/fastUpload';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RENTAL_TYPES = [
  { v: 'long-term', label: 'Long-term' },
  { v: 'short-term', label: 'Short-term' },
  { v: 'vacation', label: 'Vacation' },
  { v: 'storage', label: 'Storage' },
];

const CURRENCIES = [
  { v: 'ILS', label: '₪ ILS' },
  { v: 'USD', label: '$ USD' },
];

const blankForm = {
  owner_email: '',
  owner_name: '',
  owner_phone: '',
  title: '',
  area: '',
  address: '',
  rental_type: 'long-term',
  bedrooms: '',
  bathrooms: '',
  monthly_price: '',
  nightly_price: '',
  currency: 'ILS',
  description: '',
};

const QuickAddPropertyForm = ({ token }) => {
  const [form, setForm] = useState(blankForm);
  const [photos, setPhotos] = useState([]); // [{url, preview, kind, name}]
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const fileRef = useRef(null);

  const onField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickPhotos = () => fileRef.current?.click();

  const onPickFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      const results = await uploadFilesFast(files, API, token);
      const next = [];
      results.forEach((r, idx) => {
        const src = files[idx];
        if (!r || r.error) {
          toast.error(`Couldn't upload ${src?.name || 'file'}: ${r?.error || 'unknown error'}`);
          return;
        }
        const kind = (src?.type || '').startsWith('video/') ? 'video' : 'image';
        next.push({
          url: r.url,
          preview: URL.createObjectURL(src),
          kind,
          name: src?.name || '',
        });
      });
      if (next.length) setPhotos((p) => [...p, ...next]);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx) => {
    setPhotos((p) => {
      const removed = p[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const isVacationLike = form.rental_type === 'vacation';
  const priceField = isVacationLike ? 'nightly_price' : 'monthly_price';
  const priceLabel = isVacationLike ? 'Nightly price' : 'Monthly rent';

  const canSubmit =
    form.owner_email.trim() &&
    form.title.trim() &&
    !submitting &&
    !uploading;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) {
      toast.error('Email and listing title are required');
      return;
    }
    setSubmitting(true);
    try {
      const image_urls = photos.filter((p) => p.kind === 'image').map((p) => p.url);
      const video_urls = photos.filter((p) => p.kind === 'video').map((p) => p.url);
      const payload = {
        owner_email: form.owner_email.trim(),
        owner_name: form.owner_name.trim() || null,
        owner_phone: form.owner_phone.trim() || null,
        title: form.title.trim(),
        area: form.area.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        rental_type: form.rental_type,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        monthly_price: form.monthly_price ? Number(form.monthly_price) : null,
        nightly_price: form.nightly_price ? Number(form.nightly_price) : null,
        currency: form.currency,
        image_urls,
        video_urls,
      };
      const res = await axios.post(
        `${API}/admin/import/quick-add`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setLastResult(res.data);
      if (res.data.owner?.was_created) {
        toast.success(
          `Created account for ${res.data.owner.email} and added "${res.data.property.title}"`,
          { duration: 6000 },
        );
      } else {
        toast.success(
          `Added "${res.data.property.title}" to ${res.data.owner.email}'s existing account`,
        );
      }
      // Reset the form fields but keep owner contact info pre-filled so
      // adding another listing for the same landlord takes 10 seconds.
      setForm((f) => ({
        ...blankForm,
        owner_email: f.owner_email,
        owner_name: f.owner_name,
        owner_phone: f.owner_phone,
        rental_type: f.rental_type,
        currency: f.currency,
      }));
      // Clear the photo strip — they belonged to the just-submitted listing.
      photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      setPhotos([]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Couldn\'t add property');
    } finally {
      setSubmitting(false);
    }
  };

  const resetEverything = () => {
    photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setForm(blankForm);
    setLastResult(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="quick-add-form">
      {/* Owner section */}
      <Section title="1. Owner" subtitle="An account will be created automatically if this email isn't on the platform yet — they'll get a 'set your password' email instantly.">
        <Field label="Email" required Icon={Mail}>
          <input
            type="email"
            value={form.owner_email}
            onChange={(e) => onField('owner_email', e.target.value)}
            placeholder="landlord@example.com"
            className={inputClass}
            data-testid="quick-add-owner-email"
            required
          />
        </Field>
        <Field label="Owner name (optional)" Icon={User}>
          <input
            type="text"
            value={form.owner_name}
            onChange={(e) => onField('owner_name', e.target.value)}
            placeholder="Cohen Family"
            className={inputClass}
            data-testid="quick-add-owner-name"
          />
        </Field>
        <Field label="Owner phone (optional)" Icon={Phone}>
          <input
            type="tel"
            value={form.owner_phone}
            onChange={(e) => onField('owner_phone', e.target.value)}
            placeholder="054-1234567"
            className={inputClass}
            data-testid="quick-add-owner-phone"
          />
        </Field>
      </Section>

      {/* Property section */}
      <Section title="2. Listing">
        <Field label="Title" required Icon={HomeIcon}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onField('title', e.target.value)}
            placeholder="Spacious 3BR in Sanhedria with porch"
            className={inputClass}
            data-testid="quick-add-title"
            required
          />
        </Field>
        <Field label="Location / area" Icon={MapPin}>
          <input
            type="text"
            value={form.area}
            onChange={(e) => onField('area', e.target.value)}
            placeholder="Jerusalem - Sanhedria"
            className={inputClass}
            data-testid="quick-add-area"
          />
        </Field>
        <Field label="Street address (optional)" Icon={MapPin}>
          <input
            type="text"
            value={form.address}
            onChange={(e) => onField('address', e.target.value)}
            placeholder="HaTaasiya St. 12"
            className={inputClass}
            data-testid="quick-add-address"
          />
        </Field>
        <Field label="Rental type">
          <select
            value={form.rental_type}
            onChange={(e) => onField('rental_type', e.target.value)}
            className={inputClass}
            data-testid="quick-add-rental-type"
          >
            {RENTAL_TYPES.map((t) => (
              <option key={t.v} value={t.v}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Bedrooms" Icon={Bed}>
          <input
            type="number"
            min="0"
            value={form.bedrooms}
            onChange={(e) => onField('bedrooms', e.target.value)}
            placeholder="3"
            className={inputClass}
            data-testid="quick-add-bedrooms"
          />
        </Field>
        <Field label="Bathrooms" Icon={Bath}>
          <input
            type="number"
            min="0"
            value={form.bathrooms}
            onChange={(e) => onField('bathrooms', e.target.value)}
            placeholder="2"
            className={inputClass}
            data-testid="quick-add-bathrooms"
          />
        </Field>
        <Field label={priceLabel} Icon={Banknote}>
          <input
            type="number"
            min="0"
            value={form[priceField]}
            onChange={(e) => onField(priceField, e.target.value)}
            placeholder={isVacationLike ? '350' : '8500'}
            className={inputClass}
            data-testid={`quick-add-${priceField.replace('_', '-')}`}
          />
        </Field>
        <Field label="Currency">
          <select
            value={form.currency}
            onChange={(e) => onField('currency', e.target.value)}
            className={inputClass}
            data-testid="quick-add-currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.v} value={c.v}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Description (optional)" span={2}>
          <textarea
            value={form.description}
            onChange={(e) => onField('description', e.target.value)}
            placeholder="Bright, recently-renovated, close to bus 75…"
            className={`${inputClass} h-20 resize-y`}
            data-testid="quick-add-description"
          />
        </Field>
      </Section>

      {/* Photos */}
      <Section title="3. Photos & videos">
        <div className="col-span-full">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <button
              type="button"
              onClick={pickPhotos}
              disabled={uploading || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              data-testid="quick-add-pick-photos"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Add photos / video'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={onPickFile}
              data-testid="quick-add-photo-input"
            />
            <span className="text-xs text-gray-500">
              {photos.length === 0 ? 'No photos yet' : `${photos.length} attached`}
            </span>
          </div>

          {photos.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="quick-add-photo-strip">
              {photos.map((p, i) => (
                <div key={i} className="relative shrink-0">
                  {p.kind === 'video' ? (
                    <div className="w-24 h-24 rounded-lg border border-gray-200 bg-black flex items-center justify-center overflow-hidden">
                      <video src={p.preview} className="w-full h-full object-cover opacity-80" muted playsInline />
                    </div>
                  ) : (
                    <img
                      src={p.preview}
                      alt={p.name}
                      className="w-24 h-24 rounded-lg object-cover border border-gray-200"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                    data-testid={`quick-add-remove-photo-${i}`}
                    aria-label="Remove"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length === 0 && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <ImageIcon size={12} /> Tip: you can pick many photos (and a short MP4) in one go — they all go to this listing.
            </p>
          )}
        </div>
      </Section>

      {/* Last result chip */}
      {lastResult && (
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2"
          data-testid="quick-add-last-result"
        >
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">
              {lastResult.owner.was_created ? 'New owner created + listing added' : 'Listing added to existing owner'}
            </p>
            <p className="text-emerald-800 text-xs mt-0.5">
              <span className="font-mono">{lastResult.owner.email}</span> · &quot;{lastResult.property.title}&quot;
              {lastResult.property.area ? ` · ${lastResult.property.area}` : ''}
            </p>
            <p className="text-emerald-700/80 text-[11px] mt-1.5">
              The owner contact info is kept in the form so you can add another listing for the same landlord in seconds.
            </p>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="sticky bottom-0 -mx-1 bg-white/95 backdrop-blur-sm border-t border-gray-100 pt-3 mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E6A6A] text-white text-sm font-bold hover:bg-[#175555] disabled:opacity-40"
          data-testid="quick-add-submit"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {submitting ? 'Adding…' : (lastResult ? 'Add another for this owner' : 'Create account + add listing')}
        </button>
        {(form.owner_email || lastResult) && (
          <button
            type="button"
            onClick={resetEverything}
            className="text-xs text-gray-500 hover:text-gray-700"
            data-testid="quick-add-reset"
          >
            Start fresh (new owner)
          </button>
        )}
      </div>
    </form>
  );
};

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#1E6A6A] focus:outline-none focus:ring-1 focus:ring-[#1E6A6A]/40 text-sm';

const Section = ({ title, subtitle, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="mb-3">
      <h3 className="font-bold text-gray-900">{title}</h3>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </div>
);

const Field = ({ label, Icon, required, span, children }) => (
  <label className={`block ${span === 2 ? 'sm:col-span-2' : ''}`}>
    <span className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">
      {Icon && <Icon size={11} />} {label}
      {required && <span className="text-red-500">*</span>}
    </span>
    {children}
  </label>
);

export default QuickAddPropertyForm;
