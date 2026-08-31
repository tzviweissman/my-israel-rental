/**
 * Fix a job that was posted wrong.
 *
 * WHY THIS EXISTS. A poster reported having chosen the wrong place and
 * the wrong category and finding no way to change either. They were
 * right twice over: there was no edit UI for a job's content anywhere in
 * the app, and `category` was not even in the API's patch model — so the
 * only remedy was to delete and repost, which discards every application
 * already received. Deleting your own work to fix a typo is not a
 * remedy.
 *
 * SCOPE. The fields somebody actually gets wrong in a hurry: what it is,
 * where it is, and what it says. Budget and dates are left to the public
 * job page rather than crowding this — the reported problem was place
 * and category, and a modal that edits everything is one nobody reads.
 *
 * The category control is the SAME `CategoryPicker` the post form uses.
 * Two different pickers for one taxonomy is how they drift, and a person
 * correcting a mistake should meet the control they met when they made
 * it.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import CategoryPicker from '../marketplace/CategoryPicker';

export default function EditJobModal({ job, API, token, onClose, onSaved }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: job.title || '',
    description: job.description || '',
    category: job.category || '',
    subcategory: job.subcategory || '',
    area: job.area || '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    axios.get(`${API}/marketplace/categories`)
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
  }, [API]);

  const save = async () => {
    const title = form.title.trim();
    const description = form.description.trim();
    const area = form.area.trim();
    // Mirrors the server's own limits so the person is told here rather
    // than by a 422 with no field attached to it.
    if (title.length < 6) {
      toast.error(t('editJob.needTitle', 'Give the job a title of at least 6 characters.'));
      return;
    }
    if (description.length < 10) {
      toast.error(t('editJob.needDescription', 'Describe the job in a little more detail.'));
      return;
    }
    if (!form.category) {
      toast.error(t('editJob.needCategory', 'Pick a category.'));
      return;
    }
    if (area.length < 2) {
      toast.error(t('editJob.needArea', 'Say which city or area this is in.'));
      return;
    }

    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${API}/marketplace/jobs/${job.id}`,
        {
          title,
          description,
          category: form.category,
          // '' would fail the server's subcategory check; null is how the
          // API is told "this job has none".
          subcategory: form.subcategory || null,
          area,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t('editJob.saved', 'Job updated.'));
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      toast.error(
        err.response?.data?.detail
        || t('editJob.failed', 'Could not update the job. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const categoryChanged = form.category && form.category !== job.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,.45)' }}
      role="dialog"
      aria-modal="true"
      data-testid="edit-job-modal"
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid var(--brand-border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white"
          style={{ borderColor: 'var(--brand-border)' }}
        >
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('editJob.title', 'Edit job')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')} data-testid="edit-job-close">
            <X size={18} style={{ color: 'var(--brand-muted)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('editJob.jobTitle', 'Title')}
            </span>
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-job-title"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('editJob.area', 'City or area')}
            </span>
            <input
              value={form.area}
              onChange={(e) => set({ area: e.target.value })}
              placeholder="Jerusalem"
              className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-job-area"
            />
          </label>

          <div>
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('editJob.category', 'Category')}
            </span>
            <div className="mt-2">
              <CategoryPicker
                categories={categories}
                value={form.category}
                onChange={(slug) => set({ category: slug, subcategory: '' })}
                testidPrefix="edit-job-cat"
              />
            </div>
            {/* Said before saving, not after. Moving trade re-announces the
                job to the providers who should have heard about it first
                time — and they are strangers to the poster, so it should
                not be a surprise. */}
            {categoryChanged && (
              <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }} data-testid="edit-job-recat-note">
                {t('editJob.recategorised',
                  'Moving this to a new category will let businesses in that category know about it.')}
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('editJob.description', 'Description')}
            </span>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={5}
              className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="edit-job-description"
            />
          </label>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t sticky bottom-0 bg-white"
          style={{ borderColor: 'var(--brand-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            data-testid="edit-job-save"
          >
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {t('common.save', 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
