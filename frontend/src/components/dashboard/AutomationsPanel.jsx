/**
 * Network → Automations (docs/business-network-spec.md, Phase 2).
 *
 * WHEN something happens here, an order appears at a partner. The shop
 * marks an order ready and the courier's board shows the delivery; a
 * saved reorder goes to a supplier with one tap.
 *
 * Three things live on this screen because they are one idea:
 *   - the rules themselves,
 *   - which partners' automated orders skip the waiting step
 *     (auto-accept, which only the RECEIVING business can grant), and
 *   - what actually happened (the run log), which is how an owner
 *     answers "why did this order appear?".
 *
 * Every field the API validates is validated here too, in the same words,
 * so the form does not let someone press Save into a 400.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Zap, Plus, Send, Trash2, History, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const FIRES_ON = ['preparing', 'ready', 'done'];

const EMPTY = {
  partner_business_id: '',
  name: '',
  trigger: { type: 'order.status_changed', status: 'ready' },
  template: { copy_from_source: true, items: '', notes: '', fulfilment: 'pickup', address: '', total: '' },
};

export default function AutomationsPanel({ API, token, bizId, partners }) {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [rules, setRules] = useState(null);
  const [runs, setRuns] = useState([]);
  const [autoAccept, setAutoAccept] = useState([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    if (!bizId) return;
    setFailed(false);
    try {
      const [a, r, aa] = await Promise.all([
        axios.get(`${API}/marketplace/businesses/${bizId}/automations`, auth),
        axios.get(`${API}/marketplace/businesses/${bizId}/automations/runs?limit=20`, auth),
        axios.get(`${API}/marketplace/businesses/${bizId}/orders/auto-accept`, auth),
      ]);
      setRules(a.data.automations || []);
      setRuns(r.data.runs || []);
      setAutoAccept(aa.data.auto_accept_from || []);
    } catch {
      // An empty list and a failed load look the same, and one of them
      // says "nothing is running" when things are.
      setFailed(true);
    }
  }, [API, auth, bizId]);

  useEffect(() => { setRules(null); load(); }, [load]);

  const partnerName = (id) => partners.find((p) => p.id === id)?.name || t('automations.aPartner', 'a partner');

  const triggerLine = (rule) => (rule.trigger?.type === 'manual.reorder'
    ? t('automations.whenManual', 'When you tap Send')
    : t('automations.whenStatus', 'When one of my orders is {{status}}', {
      status: t(`orders.status.${rule.trigger?.status}`, rule.trigger?.status),
    }));

  const save = async () => {
    const f = form;
    const copy = f.trigger.type === 'order.status_changed' && f.template.copy_from_source;
    if (!f.partner_business_id) return toast.error(t('automations.pickPartner', 'Pick a partner business'));
    if (!f.name.trim()) return toast.error(t('automations.nameIt', 'Give this automation a name'));
    if (!copy && !f.template.items.trim()) return toast.error(t('automations.sayWhat', 'Say what to order'));
    if (!copy && f.template.fulfilment === 'delivery' && !f.template.address.trim()) {
      return toast.error(t('automations.needAddress', 'A delivery needs an address'));
    }
    setBusy('new');
    try {
      await axios.post(`${API}/marketplace/businesses/${bizId}/automations`, {
        partner_business_id: f.partner_business_id,
        name: f.name.trim(),
        trigger: f.trigger,
        template: copy
          ? { copy_from_source: true, notes: f.template.notes, fulfilment: 'delivery', items: '' }
          : {
            copy_from_source: false,
            items: f.template.items,
            notes: f.template.notes,
            fulfilment: f.template.fulfilment,
            address: f.template.fulfilment === 'delivery' ? f.template.address : null,
            total: f.template.total === '' ? null : Number(f.template.total),
          },
      }, auth);
      toast.success(t('automations.saved', 'Automation saved'));
      setForm(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('automations.saveFailed', 'That could not be saved'));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (rule) => {
    setBusy(rule.id);
    try {
      await axios.patch(`${API}/marketplace/automations/${rule.id}`, { enabled: !rule.enabled }, auth);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('automations.saveFailed', 'That could not be saved'));
    } finally { setBusy(null); }
  };

  const remove = async (rule) => {
    if (!window.confirm(t('automations.confirmDelete', 'Delete "{{name}}"? Orders it already made stay.', { name: rule.name }))) return;
    setBusy(rule.id);
    try {
      await axios.delete(`${API}/marketplace/automations/${rule.id}`, auth);
      toast.success(t('automations.deleted', 'Automation deleted'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('automations.saveFailed', 'That could not be saved'));
    } finally { setBusy(null); }
  };

  const sendNow = async (rule) => {
    setBusy(rule.id);
    try {
      await axios.post(`${API}/marketplace/automations/${rule.id}/run`, {}, auth);
      toast.success(t('automations.sent', 'Sent to {{name}}', { name: rule.partner_name || partnerName(rule.partner_business_id) }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('automations.sendFailed', 'That could not be sent'));
    } finally { setBusy(null); }
  };

  /* Auto-accept is saved through its own endpoint, never through the
     order settings one, which replaces the whole settings object. */
  const saveAutoAccept = async (next) => {
    setAutoAccept(next);
    try {
      await axios.put(`${API}/marketplace/businesses/${bizId}/orders/auto-accept`, { auto_accept_from: next }, auth);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('automations.saveFailed', 'That could not be saved'));
      load();
    }
  };

  const entryFor = (id) => autoAccept.find((e) => e.business_id === id);

  const setAuto = (id, on) => saveAutoAccept(on
    ? [...autoAccept, { business_id: id, max_amount: null, max_per_day: null, land_in_status: 'preparing' }]
    : autoAccept.filter((e) => e.business_id !== id));

  const setCap = (id, field, value) => saveAutoAccept(autoAccept.map((e) => (
    e.business_id === id ? { ...e, [field]: value === '' ? null : Number(value) } : e
  )));

  const btn = 'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50';
  const field = 'w-full rounded-lg border px-3 py-2 text-sm';

  if (partners.length === 0) {
    return (
      <div className="text-center py-6" data-testid="automations-no-partners">
        <p style={{ color: 'var(--ink)' }}>{t('automations.needPartner', 'Connect with a business first. Automations send orders to a partner.')}</p>
      </div>
    );
  }

  return (
    <div data-testid="automations-panel">
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('automations.intro', 'Hand work to a partner without retyping it: when an order here reaches a status, an order appears at theirs.')}
      </p>

      {failed && (
        <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }} data-testid="automations-failed">
          {t('automations.loadFailed', 'Your automations could not be loaded.')}{' '}
          <button type="button" className="underline" onClick={load}>{t('network.retry', 'Try again')}</button>
        </p>
      )}
      {!failed && rules === null && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={15} /></p>
      )}

      {rules !== null && (
        <>
          <ul className="mb-4">
            {rules.map((rule) => (
              <li key={rule.id} className="py-3 border-t first:border-t-0" style={{ borderColor: 'var(--brand-border)' }} data-testid="automation-row">
                <div className="flex items-start gap-3 flex-wrap">
                  <span className="h-9 w-9 rounded-lg inline-flex items-center justify-center shrink-0"
                    style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}>
                    <Zap size={16} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{rule.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                      {triggerLine(rule)} → {t('automations.orderFor', 'order for {{name}}', { name: rule.partner_name || partnerName(rule.partner_business_id) })}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                      {rule.run_count > 0
                        ? t('automations.ranCount', 'Ran {{count}} times', { count: rule.run_count })
                        : t('automations.neverRan', 'Has not run yet')}
                      {rule.paused_reason && ` · ${t('automations.paused', 'Paused: you are no longer connected')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {rule.trigger?.type === 'manual.reorder' && (
                      <button type="button" disabled={busy === rule.id} onClick={() => sendNow(rule)}
                        className={`${btn} btn-primary border-transparent`} data-testid="automation-send">
                        <Send size={13} aria-hidden="true" /> {t('automations.sendNow', 'Send now')}
                      </button>
                    )}
                    <label className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
                      <input type="checkbox" checked={!!rule.enabled} disabled={busy === rule.id}
                        onChange={() => toggle(rule)} data-testid="automation-enabled" />
                      {t('automations.on', 'On')}
                    </label>
                    <button type="button" disabled={busy === rule.id} onClick={() => remove(rule)}
                      className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} aria-label={t('automations.delete', 'Delete')}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {rules.length === 0 && !form && (
              <li className="py-4 text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="automations-empty">
                {t('automations.none', 'No automations yet.')}
              </li>
            )}
          </ul>

          {form ? (
            <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="automation-form">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.partner', 'Partner')}</span>
                  <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.partner_business_id}
                    onChange={(e) => setForm({ ...form, partner_business_id: e.target.value })} data-testid="automation-partner">
                    <option value="">{t('automations.choose', 'Choose…')}</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.name', 'Name')}</span>
                  <input className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.name} dir="auto"
                    placeholder={t('automations.namePlaceholder', 'Send deliveries to Dan')}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="automation-name" />
                </label>
                <label className="text-sm">
                  <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.when', 'When')}</span>
                  <select className={field} style={{ borderColor: 'var(--brand-border)' }}
                    value={form.trigger.type === 'manual.reorder' ? 'manual' : form.trigger.status}
                    onChange={(e) => setForm({
                      ...form,
                      trigger: e.target.value === 'manual'
                        ? { type: 'manual.reorder', status: null }
                        : { type: 'order.status_changed', status: e.target.value },
                      template: { ...form.template, copy_from_source: e.target.value !== 'manual' && form.template.copy_from_source },
                    })} data-testid="automation-trigger">
                    {FIRES_ON.map((s) => (
                      <option key={s} value={s}>{t('automations.whenStatus', 'When one of my orders is {{status}}', { status: t(`orders.status.${s}`, s) })}</option>
                    ))}
                    <option value="manual">{t('automations.whenManual', 'When you tap Send')}</option>
                  </select>
                </label>
                {form.trigger.type === 'order.status_changed' && (
                  <label className="text-sm flex items-end gap-2">
                    <input type="checkbox" checked={form.template.copy_from_source} className="mb-2.5"
                      onChange={(e) => setForm({ ...form, template: { ...form.template, copy_from_source: e.target.checked } })}
                      data-testid="automation-copy" />
                    <span className="mb-2" style={{ color: 'var(--ink)' }}>{t('automations.copy', 'Send that order as it is (the delivery IS the order)')}</span>
                  </label>
                )}
                {!(form.trigger.type === 'order.status_changed' && form.template.copy_from_source) && (
                  <>
                    <label className="text-sm sm:col-span-2">
                      <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.items', 'What to order')}</span>
                      <textarea rows={2} className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.template.items}
                        onChange={(e) => setForm({ ...form, template: { ...form.template, items: e.target.value } })} data-testid="automation-items" />
                    </label>
                    <label className="text-sm">
                      <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.fulfilment', 'Pickup or delivery')}</span>
                      <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.template.fulfilment}
                        onChange={(e) => setForm({ ...form, template: { ...form.template, fulfilment: e.target.value } })}>
                        <option value="pickup">{t('orders.pickup', 'Pickup')}</option>
                        <option value="delivery">{t('orders.delivery', 'Delivery')}</option>
                      </select>
                    </label>
                    {form.template.fulfilment === 'delivery' && (
                      <label className="text-sm">
                        <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.address', 'Address')}</span>
                        <input className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.template.address}
                          onChange={(e) => setForm({ ...form, template: { ...form.template, address: e.target.value } })} />
                      </label>
                    )}
                  </>
                )}
                <label className="text-sm sm:col-span-2">
                  <span className="block mb-1 font-semibold" style={{ color: 'var(--ink)' }}>{t('automations.notes', 'Note for them (optional)')}</span>
                  <input className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.template.notes}
                    onChange={(e) => setForm({ ...form, template: { ...form.template, notes: e.target.value } })} />
                </label>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button" className="btn-primary text-sm px-4 py-2" disabled={busy === 'new'} onClick={save} data-testid="automation-save">
                  {t('automations.save', 'Save automation')}
                </button>
                <button type="button" className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} onClick={() => setForm(null)}>
                  {t('automations.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={`${btn} mb-5`} style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
              onClick={() => setForm({ ...EMPTY, partner_business_id: partners[0]?.id || '' })} data-testid="automation-new">
              <Plus size={13} aria-hidden="true" /> {t('automations.new', 'New automation')}
            </button>
          )}

          {/* Granted by the RECEIVING business, one named sender at a time.
              Nobody can grant it to themselves, which is why it lives here
              and not in the rule. */}
          <section className="border-t pt-4 mb-5" style={{ borderColor: 'var(--brand-border)' }}>
            <h3 className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--brand-muted)' }}>
              {t('automations.autoAcceptTitle', 'Orders you accept automatically')}
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--brand-muted)' }}>
              {t('automations.autoAcceptBody', 'Their automated orders skip the waiting step and start on your board. Leave a limit empty for no limit.')}
            </p>
            <ul>
              {partners.map((p) => {
                const e = entryFor(p.id);
                return (
                  <li key={p.id} className="py-2 border-t first:border-t-0 flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--brand-border)' }}>
                    <label className="inline-flex items-center gap-2 text-sm flex-1 min-w-[160px]" style={{ color: 'var(--ink)' }}>
                      <input type="checkbox" checked={!!e} onChange={(ev) => setAuto(p.id, ev.target.checked)} data-testid={`auto-accept-${p.id}`} />
                      <span dir="auto">{p.name}</span>
                    </label>
                    {e && (
                      <>
                        <label className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                          {t('automations.maxAmount', 'Up to ₪')}
                          <input type="number" min="1" className="ms-1 w-20 rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--brand-border)' }}
                            value={e.max_amount ?? ''} onChange={(ev) => setCap(p.id, 'max_amount', ev.target.value)} />
                        </label>
                        <label className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                          {t('automations.maxPerDay', 'a day, at most')}
                          <input type="number" min="1" className="ms-1 w-16 rounded border px-2 py-1 text-sm" style={{ borderColor: 'var(--brand-border)' }}
                            value={e.max_per_day ?? ''} onChange={(ev) => setCap(p.id, 'max_per_day', ev.target.value)} />
                        </label>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="border-t pt-4" style={{ borderColor: 'var(--brand-border)' }}>
            <h3 className="text-xs font-semibold uppercase mb-2 inline-flex items-center gap-1" style={{ color: 'var(--brand-muted)' }}>
              <History size={13} aria-hidden="true" /> {t('automations.runs', 'What automations did')}
            </h3>
            {runs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="automation-runs-empty">
                {t('automations.noRuns', 'Nothing yet.')}
              </p>
            ) : (
              <ul className="text-sm">
                {runs.map((r) => {
                  const bad = r.result === 'failed';
                  return (
                    <li key={r.id} className="py-2 border-t first:border-t-0 flex items-start gap-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="automation-run">
                      {bad
                        ? <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--destructive-solid, #DC2626)' }} aria-hidden="true" />
                        : <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success, #1F8A50)' }} aria-hidden="true" />}
                      <span style={{ color: 'var(--ink)' }}>
                        {r.direction === 'sent'
                          ? t('automations.runSent', '{{name}} sent an order to {{to}}', { name: r.automation_name, to: r.to_business })
                          : t('automations.runReceived', '{{from}} sent you an order', { from: r.from_business })}
                        {r.result === 'auto_accepted' && ` · ${t('automations.runAccepted', 'accepted automatically')}`}
                        {bad && ` · ${r.error || t('automations.runFailed', 'did not work')}`}
                        <span className="ms-2 text-xs" style={{ color: 'var(--brand-muted)' }}>{String(r.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
