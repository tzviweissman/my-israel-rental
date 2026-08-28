import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { isFoodBusiness } from '../marketplace/GoodToKnow';
import { needsDirectoryDisclaimer } from '../../lib/categories';

/**
 * Edit the facts behind a business's "Good to know" band (spec C6).
 *
 * Built because the band had nowhere to get its content from. Before
 * this the only editable thing about a business was its NAME — the model
 * and the API accepted hours, languages, delivery and a hechsher, but no
 * owner could reach any of it, so the band would only ever have rendered
 * for records seeded by hand.
 *
 * Everything here is optional and everything is plain text. A structured
 * weekly-hours grid is the "right" answer and it is also the reason
 * nobody fills hours in: a business that opens 7:00–13:00 on Friday and
 * closes for chagim cannot say so in a grid, and will abandon the form
 * rather than approximate. One line they write themselves is worse data
 * and far better information.
 *
 * Kosher certification only appears for food categories. Asking a
 * plumber for a hechsher is noise, and a form that asks irrelevant
 * questions teaches people to skip the whole thing.
 */
export default function BusinessDetailsForm({ business, API, token, onClose, onSaved }) {
  const { t } = useTranslation();
  const b = business || {};
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: b.description || '',
    hours: b.hours || '',
    // Kept as text while editing; split on save. A chip editor here means
    // the owner cannot type "Hebrew, English" the way they think of it.
    languages: (b.languages || []).join(', '),
    founded_year: b.founded_year || '',
    delivery_note: b.delivery_note || '',
    lead_time: b.lead_time || '',
    payment_note: b.payment_note || '',
    kosher_body: b.kosher_certification?.body || '',
    kosher_certificate_url: b.kosher_certification?.certificate_url || '',
    license_number: b.license_number || '',
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const showKosher = isFoodBusiness(b.categories);
  // Same principle as the hechsher: asked only where it means something.
  // Money exchange is licensed and supervised, so a licence number is
  // the fact a careful customer looks for — and asking a plumber for one
  // would be exactly the irrelevant question the note above warns about.
  const showLicence = (b.categories || []).some(needsDirectoryDisclaimer);

  const save = async () => {
    setSaving(true);
    try {
      const languages = form.languages
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

      // Blank means "not set", not empty string: the page tests presence
      // to decide whether a row exists at all, and "" would render a
      // label with nothing after it.
      const orNull = (v) => (String(v || '').trim() ? String(v).trim() : null);
      const year = parseInt(form.founded_year, 10);

      const payload = {
        description: form.description.trim(),
        hours: orNull(form.hours),
        languages,
        founded_year: Number.isFinite(year) && year > 1800 ? year : null,
        delivery_note: orNull(form.delivery_note),
        lead_time: orNull(form.lead_time),
        payment_note: orNull(form.payment_note),
        // Cleared to null when the field is emptied, so a business that
        // removes its licence number is not left showing a stale one.
        license_number: showLicence ? orNull(form.license_number) : undefined,
        kosher_certification: showKosher && form.kosher_body.trim()
          ? {
              body: form.kosher_body.trim(),
              logo_url: b.kosher_certification?.logo_url || null,
              certificate_url: orNull(form.kosher_certificate_url),
            }
          : null,
      };

      await axios.patch(`${API}/marketplace/businesses/${b.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(t('businesses.detailsSaved', 'Saved'));
      onSaved && onSaved();
      onClose && onClose();
    } catch {
      toast.error(t('businesses.detailsSaveFailed', 'Could not save — try again'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, placeholder, opts = {}) => (
    <label className="block">
      <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{label}</span>
      {opts.textarea ? (
        <textarea
          rows={3}
          value={form[key]}
          onChange={(e) => set({ [key]: e.target.value })}
          placeholder={placeholder}
          className="mt-1 w-full px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid={`biz-details-${key}`}
        />
      ) : (
        <input
          value={form[key]}
          onChange={(e) => set({ [key]: e.target.value })}
          placeholder={placeholder}
          inputMode={opts.numeric ? 'numeric' : undefined}
          className="mt-1 w-full px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid={`biz-details-${key}`}
        />
      )}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,.45)' }}
      role="dialog"
      aria-modal="true"
      data-testid="business-details-form"
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid var(--brand-border)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white"
          style={{ borderColor: 'var(--brand-border)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('businesses.editDetails', 'Business details')}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" data-testid="biz-details-close">
            <X size={18} style={{ color: 'var(--brand-muted)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('businesses.detailsHint', 'All optional. Anything you leave blank simply is not shown on your page.')}
          </p>

          {field('description', t('businesses.about', 'About your business'),
            t('businesses.aboutPh', 'What you do, and what makes you worth choosing.'), { textarea: true })}
          {field('hours', t('businessPage.hours', 'Hours'), 'Sun–Thu 9:00–18:00 · Fri 9:00–13:00')}
          {field('languages', t('businessPage.languages', 'Languages'), 'Hebrew, English')}
          {field('founded_year', t('businesses.foundedYear', 'Year started'), '2011', { numeric: true })}
          {field('delivery_note', t('businessPage.delivery', 'Delivery'), 'Jerusalem and Beit Shemesh, same day')}
          {field('lead_time', t('businessPage.leadTime', 'Notice needed'), '48 hours for large orders')}
          {field('payment_note', t('businessPage.payment', 'Payment'), 'Cash, Bit, bank transfer')}

          {showLicence && (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--brand-border)' }}>
              {field('license_number',
                t('directory.licence', 'Licence number'),
                t('directory.licencePh', 'Optional — shown on your page as supplied'))}
              <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
                {t('directory.licenceHint',
                  'Currency services are licensed in Israel. Adding your number helps customers trust the listing — we show it as supplied by you and do not verify it.')}
              </p>
            </div>
          )}

          {showKosher && (
            <div className="pt-2 border-t space-y-4" style={{ borderColor: 'var(--brand-border)' }}>
              {field('kosher_body', t('businessPage.kosher', 'Kosher certification'), 'Badatz Beit Yosef')}
              {field('kosher_certificate_url', t('businesses.certificateLink', 'Link to certificate'), 'https://…')}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t sticky bottom-0 bg-white"
          style={{ borderColor: 'var(--brand-border)' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ color: 'var(--brand-muted)' }}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--brand-primary)' }}
            data-testid="biz-details-save">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
