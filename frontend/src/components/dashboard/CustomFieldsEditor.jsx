/**
 * The business writes its own questions for one of its forms (backend
 * routes/marketplace/custom_fields.py): `membership` or `order`.
 * Collapsed to one line until opened, so it never crowds the tab it sits in.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, ListPlus } from 'lucide-react';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const btnOutline = 'inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border text-sm font-semibold';

const blank = () => ({ id: null, label: '', type: 'text', required: false, options: [], help: '', tr: { label: '', help: '', options: [] } });
const isHebrew = (s) => {
  const he = (String(s).match(/[\u0590-\u05FF]/g) || []).length;
  const all = (String(s).match(/[A-Za-z\u0590-\u05FF]/g) || []).length;
  return all > 0 && he / all >= 0.3;
};
// What the editor holds: the translation as plain strings, '' = not yet.
const fromServer = (f) => ({ ...f, help: f.help || '', tr: { label: f.tr?.label || '', help: f.tr?.help || '', options: f.tr?.options || [] } });

export default function CustomFieldsEditor({ API, auth, businessId, form }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(null);
    if (!businessId) return;
    axios.get(`${API}/marketplace/businesses/${businessId}/custom-fields`, auth)
      .then(({ data }) => setFields((data[form] || []).map(fromServer)))
      .catch(() => setFields([]));
  }, [API, auth, businessId, form]);

  const examples = form === 'membership'
    ? t('fields.examplesMembership', 'For example: “I have read and agree to the gym rules” (a tick-box), an emergency contact, or any injuries we should know about.')
    : t('fields.examplesOrder', 'For example: allergies, a message for the card, or “Who is it for?”.');
  const types = [
    ['text', t('fields.type.text', 'Short answer')],
    ['longtext', t('fields.type.longtext', 'Long answer')],
    ['checkbox', t('fields.type.checkbox', 'Tick-box (e.g. agree to terms)')],
    ['choice', t('fields.type.choice', 'Choose from a list')],
    ['number', t('fields.type.number', 'Number')],
    ['date', t('fields.type.date', 'Date')],
  ];
  const upd = (i, patch) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  // Changing the original makes its translation stale: clear that part so
  // the next save translates it again.
  const updSource = (i, key, value) => setFields(fields.map((f, j) => (j === i
    ? { ...f, [key]: value, tr: { ...f.tr, [key]: key === 'options' ? [] : '' } }
    : f)));
  const updTr = (i, key, value) => setFields(fields.map((f, j) => (j === i ? { ...f, tr: { ...f.tr, [key]: value } } : f)));

  const save = async () => {
    setSaving(true);
    try {
      const body = { fields: fields.filter((f) => f.label.trim()).map((f) => ({
        id: f.id, label: f.label, type: f.type, required: f.required, help: f.help,
        options: f.type === 'choice' ? f.options : [],
        tr_label: f.tr.label, tr_help: f.tr.help, tr_options: f.type === 'choice' ? f.tr.options : [],
      })) };
      const { data } = await axios.put(`${API}/marketplace/businesses/${businessId}/custom-fields/${form}`, body, auth);
      setFields(data.fields.map(fromServer));
      toast.success(t('fields.saved', 'Questions saved'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('fields.saveFailed', 'Could not save. Try again.'));
    } finally { setSaving(false); }
  };

  const count = (fields || []).length;
  return (
    <section className="rounded-2xl border bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid={`fields-editor-${form}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 p-4 text-start min-h-[44px]" aria-expanded={open}>
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <ListPlus size={16} aria-hidden="true" />
          {form === 'membership' ? t('fields.titleMembership', 'Your questions on the sign-up form') : t('fields.titleOrder', 'Your questions on the order form')}
          {count > 0 && <span className="text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>({count})</span>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('fields.body', 'Ask customers anything you need. Their answers show with the sign-up or order.')} {examples}</p>
          {fields === null ? <Loader2 className="animate-spin" size={16} /> : (
            <>
              {fields.map((f, i) => (
                <div key={f.id || `new-${i}`} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="field-row">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input value={f.label} maxLength={200} onChange={(e) => updSource(i, 'label', e.target.value)} className={field} style={fieldStyle}
                           placeholder={t('fields.question', 'The question')} aria-label={t('fields.question', 'The question')} data-testid="field-label" />
                    <select value={f.type} onChange={(e) => upd(i, { type: e.target.value })} className={field} style={fieldStyle} aria-label={t('fields.kind', 'Kind of answer')} data-testid="field-type">
                      {types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  {f.type === 'choice' && (
                    <textarea rows={3} value={(f.options || []).join('\n')} onChange={(e) => updSource(i, 'options', e.target.value.split('\n'))} className={field} style={fieldStyle}
                              placeholder={t('fields.optionsPh', 'One option per line')} aria-label={t('fields.options', 'Options')} data-testid="field-options" />
                  )}
                  <input value={f.help} maxLength={300} onChange={(e) => updSource(i, 'help', e.target.value)} className={field} style={fieldStyle}
                         placeholder={t('fields.helpPh', 'A line of explanation under it (optional)')} aria-label={t('fields.help', 'Explanation')} />
                  {f.label.trim() && (() => {
                    const other = isHebrew(`${f.label} ${f.help}`) ? 'en' : 'he';
                    const dir = other === 'he' ? 'rtl' : 'ltr';
                    return (
                      <div className="rounded-lg p-2 space-y-2" style={{ background: 'var(--surface-muted, #F9FAFB)' }} data-testid="field-translation">
                        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                          <b style={{ color: 'var(--ink)' }}>{other === 'he' ? t('fields.inHebrew', 'In Hebrew') : t('fields.inEnglish', 'In English')}</b>
                          {' · '}{t('fields.trNote', 'For customers browsing in that language. Leave it empty and we translate it when you save. You can correct it.')}
                        </p>
                        <input value={f.tr.label} maxLength={300} dir={dir} onChange={(e) => updTr(i, 'label', e.target.value)} className={field} style={fieldStyle}
                               placeholder={t('fields.trAuto', 'Translated when you save')} aria-label={t('fields.trLabel', 'The question, translated')} data-testid="field-tr-label" />
                        {f.help.trim() && (
                          <input value={f.tr.help} maxLength={400} dir={dir} onChange={(e) => updTr(i, 'help', e.target.value)} className={field} style={fieldStyle}
                                 placeholder={t('fields.trAuto', 'Translated when you save')} aria-label={t('fields.trHelp', 'The explanation, translated')} />
                        )}
                        {f.type === 'choice' && (f.options || []).some((o) => o.trim()) && (
                          <textarea rows={3} value={(f.tr.options || []).join('\n')} dir={dir} onChange={(e) => updTr(i, 'options', e.target.value.split('\n'))} className={field} style={fieldStyle}
                                    placeholder={t('fields.trAutoOptions', 'Translated when you save, one per line in the same order')} aria-label={t('fields.trOptions', 'The options, translated')} />
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm min-h-[44px]" style={{ color: 'var(--ink)' }}>
                      <input type="checkbox" checked={f.required} onChange={(e) => upd(i, { required: e.target.checked })} data-testid="field-required" />
                      {f.type === 'checkbox' ? t('fields.mustTick', 'Must be ticked') : t('fields.required', 'Required')}
                    </label>
                    <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('fields.remove', 'Remove question')} onClick={() => setFields(fields.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {fields.length < 12 && (
                  <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setFields([...fields, blank()])} data-testid="field-add">
                    <Plus size={15} /> {t('fields.add', 'Add a question')}
                  </button>
                )}
                <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                        style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="fields-save">
                  {saving && <Loader2 size={15} className="animate-spin" />} {t('fields.save', 'Save questions')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
