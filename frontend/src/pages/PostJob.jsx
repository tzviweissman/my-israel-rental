/**
 * PostJob — customer-facing wizard for creating a job request.
 *
 * Upwork-style flow: the customer says what they need, sets a budget +
 * date, and the job lands on `/businesses/jobs`. Providers whose gigs
 * cover the same category get an auto-notification email and can Apply
 * with a message + optional price quote.
 *
 * Kept to a single-screen form (not multi-step) — the fields are few
 * enough that a wizard would be overkill.
 */
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { API, AuthContext } from '../App';
import { useReturnDestination, backLabelFor } from '../hooks/useBackNavigation';
import PageMeta from '../components/PageMeta';
import DateField from '../components/common/DateField';
import { SUBCATEGORIES } from '../lib/categories';

const PostJob = () => {
  const { t } = useTranslation();
  // Back to wherever they came from — the dashboard, the jobs board, or a
  // filtered view of it — rather than always the board. Someone who starts
  // from their dashboard should end up back at their dashboard.
  const backTo = useReturnDestination(['/dashboard', '/businesses/jobs', '/services'], '/businesses/jobs');
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: '',
    subcategory: '',
    description: '',
    budget_type: 'open',
    budget_amount: '',
    budget_currency: 'ILS',
    preferred_date: '',
    area: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!token) { navigate('/auth'); return; }
    axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data));
  }, [token, navigate]);

  const missing = useMemo(() => {
    const m = [];
    if (form.title.trim().length < 6) m.push('Title (at least 6 characters)');
    if (!form.category) m.push('Category');
    if (form.description.trim().length < 10) m.push('Description (at least 10 characters)');
    if (form.budget_type === 'fixed' && !(parseFloat(form.budget_amount) > 0)) m.push('Budget amount');
    if (!form.area.trim()) m.push('Area / city');
    return m;
  }, [form]);
  const canSubmit = missing.length === 0;

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        budget_amount: form.budget_type === 'fixed' ? parseFloat(form.budget_amount) : null,
        preferred_date: form.preferred_date || null,
      };
      const { data } = await axios.post(`${API}/marketplace/jobs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Job posted — matching providers will be notified by email.', {
        action: {
          label: 'My jobs',
          onClick: () => navigate('/dashboard?tab=my-jobs'),
        },
      });
      navigate(`/businesses/jobs/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="post-job-page">
      <PageMeta title="Post a job request | MyIsraelRental" description="Say what you need done and let service providers come to you." path="/businesses/post-job" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate(backTo)} className="text-sm text-gray-500 flex items-center gap-1 mb-4" data-testid="post-job-back">
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {backLabelFor(backTo, t, 'services.backToJobs', 'Back to jobs')}
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: 'Playfair Display' }}>
          {t('services.postTitle', 'Post a job request')}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Tell us what you need. We&apos;ll email matching providers so they can reach out to you.
        </p>

        <div className="space-y-5 bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
          <Field label="What do you need?" required>
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Need someone to move a 2BR apartment on July 20th"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
              data-testid="post-job-title"
            />
          </Field>

          <Field label="Category" required>
            {/* 4-column grid on md+ so 15 categories fit cleanly in 4
                rows without cramping the labels; falls back to 2 on
                mobile where truncation would hurt more than height. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {categories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => set({ category: c.slug, subcategory: '' })}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    form.category === c.slug ? 'bg-black text-[var(--gold)] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
                  }`}
                  data-testid={`post-job-cat-${c.slug}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Optional subcategory picker — only shown for the four
              merged categories that carry sub-buckets. Providers who
              tagged their gigs with a matching subcategory get a
              tighter match, but the field is never required so a
              vague poster still lands somewhere sensible. */}
          {SUBCATEGORIES[form.category] && (
            <Field label="Specific type" hint="Optional — helps us match the right provider.">
              <div className="flex flex-wrap gap-2">
                {SUBCATEGORIES[form.category].map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => set({ subcategory: form.subcategory === s.slug ? '' : s.slug })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      form.subcategory === s.slug ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]'
                    }`}
                    data-testid={`post-job-sub-${s.slug}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Describe what you need" required hint="Min 10 characters. The more detail, the better the applicant quality.">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={5}
              placeholder="What's the scope? Any constraints? What does a great outcome look like?"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
              data-testid="post-job-description"
            />
          </Field>

          <Field label="Budget">
            <div className="flex gap-2 mb-2">
              {[
                { v: 'open', label: 'Open to offers' },
                { v: 'fixed', label: 'Fixed price' },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => set({ budget_type: o.v })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${
                    form.budget_type === o.v ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--gold)]'
                  }`}
                  data-testid={`post-job-budget-${o.v}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {form.budget_type === 'fixed' && (
              <div className="flex gap-2 items-stretch">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-semibold text-sm">
                    {form.budget_currency === 'USD' ? '$' : '₪'}
                  </span>
                  <select
                    value={form.budget_currency}
                    onChange={(e) => set({ budget_currency: e.target.value })}
                    className="appearance-none pl-7 pr-6 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
                    data-testid="post-job-currency"
                  >
                    <option value="ILS">ILS</option>
                    <option value="USD">USD</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">▾</span>
                </div>
                <input
                  type="number"
                  value={form.budget_amount}
                  onChange={(e) => set({ budget_amount: e.target.value })}
                  placeholder="Amount"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  data-testid="post-job-budget-amount"
                />
              </div>
            )}
          </Field>

          <Field label="Preferred date (optional)">
            <DateField
              value={form.preferred_date}
              onChange={(v) => set({ preferred_date: v })}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              testid="post-job-date"
            />
          </Field>

          <Field label="Area / city" required hint="Free-form — Tel Aviv, Jerusalem, Haifa, or a neighbourhood.">
            <input
              value={form.area}
              onChange={(e) => set({ area: e.target.value })}
              placeholder="e.g. Tel Aviv, Florentin"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              data-testid="post-job-area"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={submit}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] disabled:opacity-40 flex items-center gap-1"
            data-testid="post-job-submit"
          >
            {saving ? <><Loader2 className="animate-spin" size={14} /> Posting…</> : <>Post job <ArrowRight size={14} /></>}
          </button>
          {!canSubmit && (
            <div className="text-[11px] text-red-600 leading-snug text-end max-w-xs" data-testid="post-job-blocked-reason">
              <p className="font-semibold">Still needed:</p>
              <ul className="list-disc ms-5 space-y-0.5">
                {missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, hint, required, children }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{hint}</p>}
  </div>
);

export default PostJob;
