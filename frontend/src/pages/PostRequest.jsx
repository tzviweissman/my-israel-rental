/**
 * PostRequest — /requests/post. Signed-in only (gated at the route).
 *
 * One form, two shapes. Picking "I'm looking for a place" vs "I need a
 * service" swaps the variant fields, because the backend requires
 * `rental_kind` on one and `category` on the other and rejects the post
 * otherwise — so the form must not let someone reach Submit without the
 * field their type needs.
 *
 * Structure follows PostJob.jsx.
 */
import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Home, Wrench, Loader2, ArrowLeft } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const RENTAL_KINDS = ['long-term', 'short-term', 'vacation'];

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--brand-muted)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{hint}</p>}
  </div>
);

const inputCls = 'w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-primary)]';

const PostRequest = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    request_type: 'rental',
    title: '',
    description: '',
    area: '',
    budget_type: 'open',
    budget_amount: '',
    budget_currency: 'ILS',
    // rental
    rental_kind: 'long-term',
    bedrooms_min: '',
    move_in_date: '',
    lease_months: '',
    // service
    category: '',
    preferred_date: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isRental = form.request_type === 'rental';

  useEffect(() => {
    axios.get(`${API}/marketplace/categories`)
      .then((r) => setCategories(r.data || []))
      .catch(() => setCategories([]));
  }, []);

  // Mirrors the server's own validation so the button explains itself
  // rather than the user discovering the rule via a 400.
  const missing = (() => {
    if (form.title.trim().length < 6) return t('requests.needTitle', 'Give your request a title (at least 6 characters).');
    if (form.description.trim().length < 10) return t('requests.needDescription', 'Describe what you need — at least 10 characters.');
    if (form.area.trim().length < 2) return t('requests.needArea', 'Which area?');
    if (!isRental && !form.category) return t('requests.needCategory', 'Pick a service category.');
    if (form.budget_type === 'fixed' && !(Number(form.budget_amount) > 0)) {
      return t('requests.needBudget', 'Enter a budget amount, or switch to "open to offers".');
    }
    return null;
  })();

  const submit = async (e) => {
    e.preventDefault();
    if (missing) { toast.error(missing); return; }
    setSaving(true);
    try {
      const payload = {
        request_type: form.request_type,
        title: form.title.trim(),
        description: form.description.trim(),
        area: form.area.trim(),
        budget_type: form.budget_type,
        budget_amount: form.budget_type === 'fixed' ? Number(form.budget_amount) : null,
        budget_currency: form.budget_currency,
        ...(isRental
          ? {
              rental_kind: form.rental_kind,
              bedrooms_min: form.bedrooms_min === '' ? null : Number(form.bedrooms_min),
              move_in_date: form.move_in_date || null,
              lease_months: form.lease_months === '' ? null : Number(form.lease_months),
            }
          : {
              category: form.category,
              preferred_date: form.preferred_date || null,
            }),
      };
      const { data } = await axios.post(`${API}/marketplace/requests`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(t('requests.posted', 'Your request is live — owners and pros can now reach you.'));
      navigate(`/requests/${data.id}`);
    } catch (err) {
      // The server owns the real rules (open cap, cooldown); surface its
      // message rather than inventing a generic one.
      toast.error(err.response?.data?.detail || t('requests.postFailed', 'Could not post your request'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="post-request-page"
    >
      <PageMeta
        title="Post a request | MyIsraelRental"
        description="Tell owners and service providers what you're looking for."
        path="/requests/post"
        noindex
      />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => navigate('/requests')}
          className="inline-flex items-center gap-2 text-sm font-semibold mb-6"
          style={{ color: 'var(--brand-muted)' }}
          data-testid="post-request-back"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('requests.backToBoard', 'Back to the board')}
        </button>

        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
        >
          {t('requests.postTitle', 'What are you looking for?')}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--brand-muted)' }}>
          {t('requests.postSub', 'Free to post. Owners and pros reply through on-platform chat — your phone and email are never shown.')}
        </p>

        <form onSubmit={submit} className="space-y-5" data-testid="post-request-form">
          {/* Type picker — swaps the variant fields below. */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: 'rental', Icon: Home, label: t('requests.typeRentalLong', "I'm looking for a place") },
              { v: 'service', Icon: Wrench, label: t('requests.typeServiceLong', 'I need a service') },
            ].map(({ v, Icon, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => set({ request_type: v })}
                aria-pressed={form.request_type === v}
                className="rounded-xl border p-4 text-start transition-colors"
                style={{
                  borderColor: form.request_type === v ? 'var(--brand-primary)' : 'var(--brand-border)',
                  background: form.request_type === v ? 'rgb(var(--brand-primary-rgb) / 0.06)' : '#fff',
                }}
                data-testid={`post-request-type-${v}`}
              >
                <Icon size={18} style={{ color: 'var(--brand-primary)' }} />
                <span className="block mt-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>{label}</span>
              </button>
            ))}
          </div>

          <Field label={t('requests.fieldTitle', 'Title')}>
            <input
              className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
              value={form.title} onChange={(e) => set({ title: e.target.value })}
              placeholder={isRental
                ? t('requests.titlePhRental', 'e.g. 3-bed wanted in Ramat Eshkol')
                : t('requests.titlePhService', 'e.g. Mover needed on the 14th')}
              maxLength={140} data-testid="post-request-title"
            />
          </Field>

          <Field label={t('requests.fieldDescription', 'Details')}>
            <textarea
              className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
              rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })}
              placeholder={t('requests.descriptionPh', 'The things that would make an offer right or wrong for you.')}
              maxLength={4000} data-testid="post-request-description"
            />
          </Field>

          <Field label={t('requests.fieldArea', 'Area')}>
            <input
              className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
              value={form.area} onChange={(e) => set({ area: e.target.value })}
              placeholder={t('requests.areaPh', 'e.g. Jerusalem, Ramat Eshkol')}
              maxLength={120} data-testid="post-request-area"
            />
          </Field>

          {isRental ? (
            <div className="grid sm:grid-cols-2 gap-4" data-testid="post-request-rental-fields">
              <Field label={t('requests.fieldRentalKind', 'Rental type')}>
                <select
                  className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                  value={form.rental_kind} onChange={(e) => set({ rental_kind: e.target.value })}
                  data-testid="post-request-rental-kind"
                >
                  {RENTAL_KINDS.map((k) => (
                    <option key={k} value={k}>{t(`requests.rentalKind_${k}`, k)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('requests.fieldBedrooms', 'Bedrooms (minimum)')}>
                <input
                  type="number" min="0" max="20"
                  className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                  value={form.bedrooms_min} onChange={(e) => set({ bedrooms_min: e.target.value })}
                  data-testid="post-request-bedrooms"
                />
              </Field>
              <Field label={t('requests.fieldMoveIn', 'Move-in date')}>
                <input
                  type="date"
                  className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                  value={form.move_in_date} onChange={(e) => set({ move_in_date: e.target.value })}
                  data-testid="post-request-movein"
                />
              </Field>
              <Field label={t('requests.fieldLease', 'Lease length (months)')}>
                <input
                  type="number" min="1" max="120"
                  className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                  value={form.lease_months} onChange={(e) => set({ lease_months: e.target.value })}
                  data-testid="post-request-lease"
                />
              </Field>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4" data-testid="post-request-service-fields">
              <Field label={t('requests.fieldCategory', 'Category')}>
                <select
                  className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                  value={form.category} onChange={(e) => set({ category: e.target.value })}
                  data-testid="post-request-category"
                >
                  <option value="">{t('requests.pickCategory', 'Pick a category…')}</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('requests.fieldPreferredDate', 'Preferred date')}>
                <input
                  type="date"
                  className={inputCls} style={{ borderColor: 'var(--brand-border)' }}
                  value={form.preferred_date} onChange={(e) => set({ preferred_date: e.target.value })}
                  data-testid="post-request-preferred-date"
                />
              </Field>
            </div>
          )}

          <Field label={t('requests.fieldBudget', 'Budget')}>
            <div className="flex flex-wrap gap-2 items-center">
              {['open', 'fixed'].map((v) => (
                <button
                  key={v} type="button" onClick={() => set({ budget_type: v })}
                  aria-pressed={form.budget_type === v}
                  className="px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
                  style={{
                    borderColor: form.budget_type === v ? 'var(--brand-primary)' : 'var(--brand-border)',
                    background: form.budget_type === v ? 'var(--brand-primary)' : '#fff',
                    color: form.budget_type === v ? '#fff' : 'var(--ink)',
                  }}
                  data-testid={`post-request-budget-${v}`}
                >
                  {v === 'open' ? t('requests.budgetOpen', 'Open to offers') : t('requests.budgetFixed', 'I have a budget')}
                </button>
              ))}
              {form.budget_type === 'fixed' && (
                <>
                  <input
                    type="number" min="1"
                    className="rounded-xl border bg-white px-3 py-2 text-sm w-32 outline-none"
                    style={{ borderColor: 'var(--brand-border)' }}
                    value={form.budget_amount} onChange={(e) => set({ budget_amount: e.target.value })}
                    placeholder="8000" data-testid="post-request-budget-amount"
                  />
                  <select
                    className="rounded-xl border bg-white px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--brand-border)' }}
                    value={form.budget_currency} onChange={(e) => set({ budget_currency: e.target.value })}
                    data-testid="post-request-budget-currency"
                  >
                    <option value="ILS">₪ ILS</option>
                    <option value="USD">$ USD</option>
                  </select>
                </>
              )}
            </div>
          </Field>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-blue-solid inline-flex items-center gap-2 disabled:opacity-60"
              data-testid="post-request-submit"
            >
              {saving && <Loader2 className="animate-spin" size={15} />}
              {t('requests.submit', 'Post my request')}
            </button>
            {missing && (
              <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }} data-testid="post-request-hint">
                {missing}
              </p>
            )}
            <p className="text-[11px] mt-3" style={{ color: 'var(--brand-muted)' }}>
              {t('requests.expiryNote', 'Requests stay on the board for 30 days. You can renew or mark it found at any time.')}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostRequest;
