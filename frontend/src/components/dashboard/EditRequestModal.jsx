/**
 * Fix a request that was posted wrong: a typo, the budget, the WhatsApp
 * number. Modelled on EditJobModal.
 *
 * Only fields `RequestPatch` accepts are offered, and only the ones that
 * actually changed are sent, so saving a new budget never rewrites the
 * title (and never re-runs the translation, which the server skips unless
 * the title or description moved).
 *
 * The WhatsApp number is never returned by the API (only
 * `whatsapp_available`), so the field starts empty. Blank means "keep what
 * is there"; the explicit remove checkbox sends '' which the server stores
 * as no number.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

const inputCls = 'mt-1 w-full px-3 py-2 rounded-xl border text-sm min-h-[44px]';
const labelStyle = { color: 'var(--brand-muted)' };
const borderStyle = { borderColor: 'var(--brand-border)' };

export default function EditRequestModal({ request, API, token, onClose, onSaved }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [removeWhatsapp, setRemoveWhatsapp] = useState(false);
  const [form, setForm] = useState({
    title: request.title || '',
    description: request.description || '',
    area: request.area || '',
    budget_type: request.budget_type === 'fixed' ? 'fixed' : 'open',
    budget_amount: request.budget_amount ? String(request.budget_amount) : '',
    budget_currency: request.budget_currency === 'USD' ? 'USD' : 'ILS',
    whatsapp: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const title = form.title.trim();
    const description = form.description.trim();
    const area = form.area.trim();
    // Mirrors the server's limits so the message is shown here, not as a
    // bare 422.
    if (title.length < 6) {
      toast.error(t('requests.editNeedTitle', 'Give the request a title of at least 6 characters.'));
      return;
    }
    if (description.length < 10) {
      toast.error(t('requests.editNeedDescription', 'Describe the request in a little more detail.'));
      return;
    }
    if (area.length < 2) {
      toast.error(t('requests.editNeedArea', 'Say which city or area this is in.'));
      return;
    }
    const amount = parseFloat(form.budget_amount);
    if (form.budget_type === 'fixed' && !(amount > 0)) {
      toast.error(t('requests.editNeedAmount', 'Enter a budget greater than 0, or choose open budget.'));
      return;
    }

    const next = { title, description, area, budget_type: form.budget_type };
    if (form.budget_type === 'fixed') {
      next.budget_amount = amount;
      next.budget_currency = form.budget_currency;
    }
    const changes = {};
    Object.entries(next).forEach(([k, v]) => {
      if (v !== request[k]) changes[k] = v;
    });
    if (removeWhatsapp) changes.whatsapp = '';
    else if (form.whatsapp.trim()) changes.whatsapp = form.whatsapp.trim();

    if (Object.keys(changes).length === 0) {
      onClose?.();
      return;
    }

    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${API}/marketplace/requests/${request.id}`,
        changes,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t('requests.editSaved', 'Request updated'));
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(
        (typeof detail === 'string' && detail)
        || t('requests.editFailed', 'Could not update the request. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,.45)' }}
      role="dialog"
      aria-modal="true"
      data-testid="edit-request-modal"
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid var(--brand-border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white"
          style={borderStyle}
        >
          <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('requests.editTitle', 'Edit request')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            data-testid="edit-request-close"
          >
            <X size={18} style={{ color: 'var(--brand-muted)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold" style={labelStyle}>{t('requests.editFieldTitle', 'Title')}</span>
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              maxLength={140}
              className={inputCls}
              style={borderStyle}
              data-testid="edit-request-title"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold" style={labelStyle}>{t('requests.editFieldArea', 'City or area')}</span>
            <input
              value={form.area}
              onChange={(e) => set({ area: e.target.value })}
              maxLength={120}
              className={inputCls}
              style={borderStyle}
              data-testid="edit-request-area"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold" style={labelStyle}>{t('requests.editFieldDescription', 'Description')}</span>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={5}
              maxLength={4000}
              className={inputCls}
              style={borderStyle}
              data-testid="edit-request-description"
            />
          </label>

          <div>
            <span className="text-xs font-semibold" style={labelStyle}>{t('requests.editFieldBudget', 'Budget')}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                value={form.budget_type}
                onChange={(e) => set({ budget_type: e.target.value })}
                className="px-3 py-2 rounded-xl border text-sm min-h-[44px] bg-white"
                style={borderStyle}
                aria-label={t('requests.editFieldBudget', 'Budget')}
                data-testid="edit-request-budget-type"
              >
                <option value="open">{t('requests.editBudgetOpen', 'Open budget')}</option>
                <option value="fixed">{t('requests.editBudgetFixed', 'Fixed budget')}</option>
              </select>
              {form.budget_type === 'fixed' && (
                <>
                  <input
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={form.budget_amount}
                    onChange={(e) => set({ budget_amount: e.target.value })}
                    className="w-32 px-3 py-2 rounded-xl border text-sm min-h-[44px]"
                    style={borderStyle}
                    aria-label={t('requests.editFieldAmount', 'Amount')}
                    data-testid="edit-request-budget-amount"
                  />
                  <select
                    value={form.budget_currency}
                    onChange={(e) => set({ budget_currency: e.target.value })}
                    className="px-3 py-2 rounded-xl border text-sm min-h-[44px] bg-white"
                    style={borderStyle}
                    aria-label={t('requests.editFieldCurrency', 'Currency')}
                    data-testid="edit-request-budget-currency"
                  >
                    <option value="ILS">₪ ILS</option>
                    <option value="USD">$ USD</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block">
              <span className="text-xs font-semibold" style={labelStyle}>{t('requests.editFieldWhatsapp', 'WhatsApp number')}</span>
              <input
                value={form.whatsapp}
                onChange={(e) => { set({ whatsapp: e.target.value }); setRemoveWhatsapp(false); }}
                inputMode="tel"
                dir="ltr"
                placeholder={request.whatsapp_available
                  ? t('requests.editWhatsappKeep', 'A number is saved. Type a new one to replace it.')
                  : '+972 50 123 4567'}
                className={inputCls}
                style={borderStyle}
                disabled={removeWhatsapp}
                data-testid="edit-request-whatsapp"
              />
            </label>
            {request.whatsapp_available && (
              <label className="mt-2 flex items-center gap-2 text-xs min-h-[44px]" style={labelStyle}>
                <input
                  type="checkbox"
                  checked={removeWhatsapp}
                  onChange={(e) => { setRemoveWhatsapp(e.target.checked); if (e.target.checked) set({ whatsapp: '' }); }}
                  data-testid="edit-request-whatsapp-remove"
                />
                {t('requests.editWhatsappRemove', 'Remove my WhatsApp number')}
              </label>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t sticky bottom-0 bg-white"
          style={borderStyle}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold border min-h-[44px]"
            style={{ ...borderStyle, color: 'var(--brand-muted)' }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 min-h-[44px]"
            data-testid="edit-request-save"
          >
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {t('common.save', 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
