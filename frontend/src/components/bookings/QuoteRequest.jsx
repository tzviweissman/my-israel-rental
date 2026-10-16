/**
 * "Get a quote" on a service listing (backend routes/marketplace/quotes.py):
 * describe the job, add up to six photos, a date and the area, and how to
 * reach you. No account; the price comes back on your own link and by
 * email. The button opens the form in place.
 */
import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ImagePlus, X, Calculator } from 'lucide-react';
import { API, AuthContext } from '../../App';

const MAX = 6;
const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export const quotesOpen = (gig) => (gig?.quotes_on === true || gig?.quotes_on === false
  ? gig.quotes_on : (gig?.gig_type || 'deliverable') === 'deliverable');

export default function QuoteRequest({ gig }) {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ description: '', preferred_date: '', area: '', name: user?.name || '', phone: user?.phone || '', email: user?.email || '' });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!quotesOpen(gig)) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const addPhotos = async (files) => {
    const list = Array.from(files || []).slice(0, MAX - photos.length);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const form = new FormData();
        form.append('file', file);
        // eslint-disable-next-line no-await-in-loop
        const { data } = await axios.post(`${API}/marketplace/quote-photo`, form);
        if (data?.url) setPhotos((p) => [...p, data.url].slice(0, MAX));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('quote.photoFailed', 'Could not add that photo. Try another.'));
    } finally { setUploading(false); }
  };

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/gigs/${gig.id}/quote-requests`, {
        description: f.description.trim(), photos, preferred_date: f.preferred_date || null, area: f.area.trim() || null,
        name: f.name.trim(), phone: f.phone.trim() || null, email: f.email.trim() || null,
        lang: String(i18n.language || 'en').startsWith('he') ? 'he' : 'en',
      });
      toast.success(t('quote.sent', 'Sent. The business will reply with a price.'));
      navigate(data.track_path);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('quote.failed', 'Could not send. Try again.'));
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold border"
              style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="quote-open">
        <Calculator size={14} /> {t('quote.open', 'Get a quote for your job')}
      </button>
    );
  }
  return (
    <form onSubmit={send} className="mt-3 rounded-xl border p-3 space-y-3 text-start" style={{ borderColor: 'var(--brand-border)' }} data-testid="quote-form">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('quote.title', 'Get a quote')}</p>
        <button type="button" onClick={() => setOpen(false)} className="grid place-content-center w-9 h-9" aria-label={t('orders.close', 'Close')}><X size={16} /></button>
      </div>
      <label className="block text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
        {t('quote.what', 'What needs doing?')}
        <textarea required minLength={10} maxLength={2000} rows={4} dir="auto" value={f.description} onChange={set('description')}
                  placeholder={t('quote.whatPh', 'e.g. Move a 3-room flat from the 2nd floor, no lift, to Haifa')} className={`${field} mt-1`} style={fieldStyle} data-testid="quote-description" />
      </label>
      <div>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }}>{t('quote.photos', 'Photos (optional, up to 6)')}</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((u) => (
            <span key={u} className="relative w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--brand-border)' }}>
              <img src={u} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((x) => x !== u))} className="absolute top-0 end-0 bg-white/90 w-6 h-6 grid place-content-center" aria-label={t('quote.removePhoto', 'Remove photo')}><X size={12} /></button>
            </span>
          ))}
          {photos.length < MAX && (
            <label className="w-16 h-16 rounded-lg border-2 border-dashed grid place-content-center cursor-pointer" style={{ borderColor: 'var(--brand-border)' }} aria-label={t('quote.addPhoto', 'Add a photo')}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} data-testid="quote-photo-input" />
            </label>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {t('quote.when', 'When (optional)')}
          <input type="date" value={f.preferred_date} onChange={set('preferred_date')} className={`${field} mt-1`} style={fieldStyle} />
        </label>
        <label className="block text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {t('quote.where', 'Where (optional)')}
          <input maxLength={120} dir="auto" value={f.area} onChange={set('area')} placeholder={t('quote.wherePh', 'City or area')} className={`${field} mt-1`} style={fieldStyle} />
        </label>
      </div>
      <input required minLength={2} maxLength={80} dir="auto" value={f.name} onChange={set('name')} placeholder={t('quote.name', 'Your name')} className={field} style={fieldStyle} data-testid="quote-name" />
      <div className="grid grid-cols-2 gap-2">
        <input type="tel" maxLength={40} value={f.phone} onChange={set('phone')} placeholder={t('quote.phone', 'Phone')} className={field} style={fieldStyle} dir="ltr" />
        <input type="email" maxLength={200} value={f.email} onChange={set('email')} placeholder={t('quote.email', 'Email')} className={field} style={fieldStyle} dir="ltr" data-testid="quote-email" />
      </div>
      <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>{t('quote.reach', 'An email or a phone, so the business can reach you. The price arrives by email and on a page of your own.')}</p>
      <button type="submit" disabled={busy || uploading} className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="quote-send">
        {busy && <Loader2 size={15} className="animate-spin" />} {t('quote.send', 'Ask for a price')}
      </button>
    </form>
  );
}
