/**
 * Network → Automations (docs/business-network-spec.md, Phases 2 and 3).
 *
 * One sentence an owner writes themselves: WHEN this happens, DO that.
 * Never a list of pre-written automations (Tzvi, 21 Sep 2026): the two
 * lists below grow instead, and every word added multiplies with the
 * others. The starter cards at the top only FILL the form in; the owner
 * edits from there.
 *
 *   When:  an order reaches a status · I tap Send · an appointment is
 *          booked / cancelled · a customer taps to message me · every
 *          week on given days at a time
 *   Then:  an order appears at a partner · notify me · message the customer
 *
 * Three things live on this screen because they are one idea: the rules,
 * which partners' automated orders skip the waiting step (auto-accept,
 * which only the RECEIVING business can grant), and what actually
 * happened (the run log), which is how an owner answers "why did this
 * order appear?".
 *
 * Every field the API validates is validated here too, in the same words,
 * so the form does not let someone press Save into a 400.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Zap, Plus, Send, Trash2, History, CheckCircle2, AlertTriangle, Loader2, Bell, MessageSquare, Truck, CalendarClock, Sparkles, KeyRound } from 'lucide-react';

const FIRES_ON = ['preparing', 'ready', 'done'];
// Python weekdays, Sunday first because the week does here.
const WEEK = [6, 0, 1, 2, 3, 4, 5];

const EMPTY = {
  partner_business_id: '',
  name: '',
  trigger: { type: 'order.status_changed', status: 'ready', schedule: { weekdays: [6], time: '08:00' }, property_id: '' },
  action: { type: 'send_order', text: '' },
  template: { copy_from_source: true, items: '', notes: '', fulfilment: 'pickup', address: '', total: '' },
};

/* The starter cards. Each is a filled-in form, nothing more: the owner
   can change every word before saving, and the list is not what the
   feature can do - the two selects are. */
const RECIPES = [
  { key: 'courierReady', Icon: Truck, needsPartner: true,
    form: { trigger: { type: 'order.status_changed', status: 'ready' }, action: { type: 'send_order', text: '' }, template: { copy_from_source: true } } },
  { key: 'weeklyReorder', Icon: CalendarClock, needsPartner: true,
    form: { trigger: { type: 'schedule', status: null, schedule: { weekdays: [6], time: '08:00' } }, action: { type: 'send_order', text: '' }, template: { copy_from_source: false } } },
  { key: 'bookedThanks', Icon: MessageSquare,
    form: { trigger: { type: 'appointment.booked' }, action: { type: 'message_customer' }, textKey: 'bookedThanksText' } },
  { key: 'cancelledTellMe', Icon: Bell,
    form: { trigger: { type: 'appointment.cancelled' }, action: { type: 'notify_me', text: '' } } },
  { key: 'leadTellMe', Icon: Bell,
    form: { trigger: { type: 'lead.received' }, action: { type: 'notify_me', text: '' } } },
  { key: 'doneThanks', Icon: MessageSquare,
    form: { trigger: { type: 'order.status_changed', status: 'done' }, action: { type: 'message_customer' }, textKey: 'doneThanksText' } },
  // Hosts only: shown when the account has listings.
  { key: 'cleaningBetweenGuests', Icon: Sparkles, needsPartner: true, forHosts: true,
    form: { trigger: { type: 'booking.confirmed' }, action: { type: 'send_order', text: '' }, template: { copy_from_source: false, fulfilment: 'delivery' }, itemsKey: 'cleaningItems' } },
  { key: 'checkInDetails', Icon: KeyRound, forHosts: true,
    form: { trigger: { type: 'booking.confirmed' }, action: { type: 'message_customer' }, textKey: 'checkInDetailsText' } },
];

export default function AutomationsPanel({ API, token, bizId, partners, listings = [] }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
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

  const dayName = (py) => {
    // Python weekday 0 = Monday; 5 Jan 2026 is a Monday.
    const d = new Date(2026, 0, 5 + py);
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short' }).format(d);
  };

  const isHost = listings.length > 0;
  const listingName = (id) => (id
    ? t('automations.atListing', 'at {{title}}', { title: listings.find((l) => l.id === id)?.title || t('automations.aListing', 'one of my listings') })
    : t('automations.anyListing', 'at any of my listings'));

  const whenLine = (trigger) => {
    const s = trigger?.schedule;
    return {
      'order.status_changed': t('automations.whenStatus', 'When one of my orders is {{status}}', { status: t(`orders.status.${trigger?.status}`, trigger?.status) }),
      'manual.reorder': t('automations.whenManual', 'When you tap Send'),
      'appointment.booked': t('automations.whenBooked', 'When an appointment is booked'),
      'appointment.cancelled': t('automations.whenCancelled', 'When an appointment is cancelled'),
      'lead.received': t('automations.whenLead', 'When a customer taps to message me'),
      'booking.confirmed': t('automations.whenStay', 'When guests book {{where}}', { where: listingName(trigger?.property_id) }),
      'booking.cancelled': t('automations.whenStayCancelled', 'When guests cancel {{where}}', { where: listingName(trigger?.property_id) }),
      schedule: s ? t('automations.whenSchedule', 'Every {{days}} at {{time}}', { days: (s.weekdays || []).map(dayName).join(', '), time: s.time }) : '',
    }[trigger?.type] || '';
  };

  const thenLine = (rule) => ({
    send_order: t('automations.orderFor', 'order for {{name}}', { name: rule.partner_name || partnerName(rule.partner_business_id) }),
    notify_me: t('automations.doNotify', 'notify me'),
    message_customer: t('automations.doMessage', 'message the customer'),
  }[rule.action?.type || 'send_order']);

  // What the form can say, given what it already says.
  const canMessage = (tt) => ['order.status_changed', 'appointment.booked', 'appointment.cancelled', 'booking.confirmed', 'booking.cancelled'].includes(tt);
  const canSendOrder = partners.length > 0;

  const startForm = (recipe) => {
    const base = { ...EMPTY, partner_business_id: partners[0]?.id || '', template: { ...EMPTY.template }, trigger: { ...EMPTY.trigger, schedule: { ...EMPTY.trigger.schedule } } };
    if (!recipe) {
      if (!canSendOrder) base.action = { type: 'notify_me', text: '' };
      return setForm(base);
    }
    const f = recipe.form;
    setForm({
      ...base,
      name: t(`automations.recipe_${recipe.key}`, recipe.key),
      trigger: { ...base.trigger, ...f.trigger, schedule: f.trigger.schedule || base.trigger.schedule },
      action: { type: f.action.type, text: f.textKey ? t(`automations.${f.textKey}`, '') : (f.action.text || '') },
      template: { ...base.template, ...(f.template || {}), ...(f.itemsKey ? { items: t(`automations.${f.itemsKey}`, '') } : {}) },
    });
  };

  const save = async () => {
    const f = form;
    const tt = f.trigger.type;
    const at = f.action.type;
    if (!f.name.trim()) return toast.error(t('automations.nameIt', 'Give this automation a name'));
    if (at === 'send_order') {
      const copy = tt === 'order.status_changed' && f.template.copy_from_source;
      if (!f.partner_business_id) return toast.error(t('automations.pickPartner', 'Pick a partner business'));
      if (!copy && !f.template.items.trim()) return toast.error(t('automations.sayWhat', 'Say what to order'));
      if (!copy && f.template.fulfilment === 'delivery' && !f.template.address.trim() && !tt.startsWith('booking.')) {
        return toast.error(t('automations.needAddress', 'A delivery needs an address'));
      }
    }
    if (at === 'message_customer' && !f.action.text.trim()) return toast.error(t('automations.writeIt', 'Write the message'));
    if (tt === 'schedule' && !f.trigger.schedule.weekdays.length) return toast.error(t('automations.pickDays', 'Pick at least one day'));
    setBusy('new');
    try {
      const copy = tt === 'order.status_changed' && f.template.copy_from_source;
      await axios.post(`${API}/marketplace/businesses/${bizId}/automations`, {
        partner_business_id: at === 'send_order' ? f.partner_business_id : null,
        name: f.name.trim(),
        trigger: tt === 'schedule'
          ? { type: tt, schedule: f.trigger.schedule }
          : { type: tt, status: tt === 'order.status_changed' ? f.trigger.status : null, property_id: tt.startsWith('booking.') ? (f.trigger.property_id || null) : null },
        action: { type: at, text: f.action.text },
        template: at !== 'send_order' ? null : copy
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
      toast.success(rule.action?.type === 'send_order' || !rule.action
        ? t('automations.sent', 'Sent to {{name}}', { name: rule.partner_name || partnerName(rule.partner_business_id) })
        : t('automations.ran', 'Done'));
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
  const labelCls = 'block mb-1 font-semibold';

  const setTrigger = (value) => {
    const next = { ...form };
    if (FIRES_ON.includes(value)) next.trigger = { ...form.trigger, type: 'order.status_changed', status: value };
    else if (value === 'manual') next.trigger = { ...form.trigger, type: 'manual.reorder', status: null };
    else next.trigger = { ...form.trigger, type: value, status: null };
    // An action the new trigger cannot carry falls back to one it can.
    if (next.action.type === 'message_customer' && !canMessage(next.trigger.type)) next.action = { ...next.action, type: 'notify_me' };
    if (next.trigger.type !== 'order.status_changed') next.template = { ...next.template, copy_from_source: false };
    setForm(next);
  };

  const triggerValue = form && (form.trigger.type === 'order.status_changed' ? form.trigger.status
    : form.trigger.type === 'manual.reorder' ? 'manual' : form.trigger.type);

  return (
    <div data-testid="automations-panel">
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('automations.intro', 'One sentence, in your words: when this happens, do that. Hand a job to a partner, get told, or message the customer, without retyping anything.')}
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
                      {whenLine(rule.trigger)} → {thenLine(rule)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                      {rule.run_count > 0
                        ? t('automations.ranCount', 'Ran {{count}} times', { count: rule.run_count })
                        : t('automations.neverRan', 'Has not run yet')}
                      {rule.enabled && rule.next_run_at && ` · ${t('automations.next', 'Next: {{when}}', { when: new Date(rule.next_run_at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: 'Asia/Jerusalem' }) })}`}
                      {rule.paused_reason && ` · ${t('automations.paused', 'Paused: you are no longer connected')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {['manual.reorder', 'schedule'].includes(rule.trigger?.type) && (
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
                <label className="text-sm sm:col-span-2">
                  <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.name', 'Name')}</span>
                  <input className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.name} dir="auto"
                    placeholder={t('automations.namePlaceholder', 'Send deliveries to Dan')}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="automation-name" />
                </label>

                <label className="text-sm">
                  <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.when', 'When')}</span>
                  <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={triggerValue}
                    onChange={(e) => setTrigger(e.target.value)} data-testid="automation-trigger">
                    {FIRES_ON.map((s) => (
                      <option key={s} value={s}>{t('automations.whenStatus', 'When one of my orders is {{status}}', { status: t(`orders.status.${s}`, s) })}</option>
                    ))}
                    <option value="appointment.booked">{t('automations.whenBooked', 'When an appointment is booked')}</option>
                    <option value="appointment.cancelled">{t('automations.whenCancelled', 'When an appointment is cancelled')}</option>
                    <option value="lead.received">{t('automations.whenLead', 'When a customer taps to message me')}</option>
                    {isHost && <option value="booking.confirmed">{t('automations.whenStayOption', 'When guests book one of my listings')}</option>}
                    {isHost && <option value="booking.cancelled">{t('automations.whenStayCancelledOption', 'When guests cancel a stay')}</option>}
                    <option value="schedule">{t('automations.whenWeekly', 'Every week, on days I pick')}</option>
                    <option value="manual">{t('automations.whenManual', 'When you tap Send')}</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.then', 'Then')}</span>
                  <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.action.type}
                    onChange={(e) => setForm({ ...form, action: { ...form.action, type: e.target.value } })} data-testid="automation-action">
                    {canSendOrder && <option value="send_order">{t('automations.doSendOrder', 'An order appears at a partner')}</option>}
                    <option value="notify_me">{t('automations.doNotifyMe', 'Notify me')}</option>
                    {canMessage(form.trigger.type) && <option value="message_customer">{t('automations.doMessageCustomer', 'Message the customer')}</option>}
                  </select>
                </label>

                {form.trigger.type === 'schedule' && (
                  <div className="text-sm sm:col-span-2 flex flex-wrap items-end gap-3" data-testid="automation-schedule">
                    <div>
                      <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.onDays', 'On')}</span>
                      <div className="flex flex-wrap gap-1">
                        {WEEK.map((d) => {
                          const on = form.trigger.schedule.weekdays.includes(d);
                          return (
                            <button key={d} type="button" aria-pressed={on}
                              onClick={() => setForm({ ...form, trigger: { ...form.trigger, schedule: { ...form.trigger.schedule, weekdays: on ? form.trigger.schedule.weekdays.filter((x) => x !== d) : [...form.trigger.schedule.weekdays, d] } } })}
                              className={`${btn} ${on ? 'btn-primary border-transparent' : ''}`}
                              style={on ? undefined : { borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
                              {dayName(d)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label>
                      <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.atTime', 'At')}</span>
                      <input type="time" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--brand-border)' }} value={form.trigger.schedule.time}
                        onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, schedule: { ...form.trigger.schedule, time: e.target.value } } })} data-testid="automation-time" />
                    </label>
                  </div>
                )}

                {form.trigger.type.startsWith('booking.') && (
                  <label className="text-sm sm:col-span-2">
                    <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.whichListing', 'Which listing')}</span>
                    <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.trigger.property_id || ''}
                      onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, property_id: e.target.value } })} data-testid="automation-listing">
                      <option value="">{t('automations.allListings', 'All my listings')}</option>
                      {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </label>
                )}

                {form.action.type === 'send_order' && (
                  <>
                    <label className="text-sm">
                      <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.partner', 'Partner')}</span>
                      <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.partner_business_id}
                        onChange={(e) => setForm({ ...form, partner_business_id: e.target.value })} data-testid="automation-partner">
                        <option value="">{t('automations.choose', 'Choose…')}</option>
                        {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                          <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.items', 'What to order')}</span>
                          <textarea rows={2} className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.template.items}
                            onChange={(e) => setForm({ ...form, template: { ...form.template, items: e.target.value } })} data-testid="automation-items" />
                        </label>
                        <label className="text-sm">
                          <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.fulfilment', 'Pickup or delivery')}</span>
                          <select className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.template.fulfilment}
                            onChange={(e) => setForm({ ...form, template: { ...form.template, fulfilment: e.target.value } })}>
                            <option value="pickup">{t('orders.pickup', 'Pickup')}</option>
                            <option value="delivery">{t('orders.delivery', 'Delivery')}</option>
                          </select>
                        </label>
                        {form.template.fulfilment === 'delivery' && (
                          <label className="text-sm">
                            <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.address', 'Address')}</span>
                            <input className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.template.address}
                              placeholder={form.trigger.type.startsWith('booking.') ? t('automations.addressFromListing', "Leave empty: the listing's address is used") : ''}
                              onChange={(e) => setForm({ ...form, template: { ...form.template, address: e.target.value } })} />
                          </label>
                        )}
                        {/* The price. "What to order" says how MUCH ("20 kg flour");
                            this says what it costs, and it is what the partner's
                            auto-accept money limit is checked against. */}
                        <label className="text-sm">
                          <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.total', 'Price, ₪ (optional)')}</span>
                          <input type="number" min="0" step="1" className={field} style={{ borderColor: 'var(--brand-border)' }} value={form.template.total}
                            onChange={(e) => setForm({ ...form, template: { ...form.template, total: e.target.value } })} data-testid="automation-total" />
                        </label>
                        {form.trigger.type.startsWith('booking.') && (
                          <p className="text-xs sm:col-span-2" style={{ color: 'var(--brand-muted)' }}>
                            {t('automations.stayTiming', 'The job is due when the guests leave, and says when the next guests arrive. Guest names and phone numbers are never passed on.')}
                          </p>
                        )}
                      </>
                    )}
                    <label className="text-sm sm:col-span-2">
                      <span className={labelCls} style={{ color: 'var(--ink)' }}>{t('automations.notes', 'Note for them (optional)')}</span>
                      <input className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.template.notes}
                        onChange={(e) => setForm({ ...form, template: { ...form.template, notes: e.target.value } })} />
                    </label>
                  </>
                )}

                {form.action.type !== 'send_order' && (
                  <label className="text-sm sm:col-span-2">
                    <span className={labelCls} style={{ color: 'var(--ink)' }}>
                      {form.action.type === 'message_customer' ? t('automations.messageText', 'The message') : t('automations.notifyText', 'What to tell me (optional)')}
                    </span>
                    <textarea rows={2} className={field} style={{ borderColor: 'var(--brand-border)' }} dir="auto" value={form.action.text}
                      placeholder={form.action.type === 'message_customer' ? t('automations.messagePlaceholder', 'Thanks for booking, see you then!') : ''}
                      onChange={(e) => setForm({ ...form, action: { ...form.action, text: e.target.value } })} data-testid="automation-text" />
                  </label>
                )}
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
            <>
              <button type="button" className={`${btn} mb-4`} style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                onClick={() => startForm(null)} data-testid="automation-new">
                <Plus size={13} aria-hidden="true" /> {t('automations.new', 'New automation')}
              </button>
              <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--brand-muted)' }}>{t('automations.starters', 'Or start from one of these')}</h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-5" data-testid="automation-recipes">
                {RECIPES.filter((r) => !r.forHosts || isHost).map((r) => {
                  const off = r.needsPartner && !canSendOrder;
                  return (
                    <li key={r.key}>
                      <button type="button" disabled={off} onClick={() => startForm(r)}
                        className="w-full text-start rounded-xl border p-3 flex items-start gap-2 transition-colors hover:bg-[var(--surface-muted,#f9fafb)] disabled:opacity-50"
                        style={{ borderColor: 'var(--brand-border)' }} data-testid={`recipe-${r.key}`}>
                        <r.Icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t(`automations.recipe_${r.key}`, r.key)}</span>
                          {off && <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{t('automations.needsPartner', 'Connect with a business first')}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Granted by the RECEIVING business, one named sender at a time.
              Nobody can grant it to themselves, which is why it lives here
              and not in the rule. */}
          {canSendOrder && (
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
          )}

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
                  const line = {
                    notified: t('automations.runNotified', '{{name}} told you', { name: r.automation_name }),
                    messaged: t('automations.runMessaged', '{{name}} messaged the customer', { name: r.automation_name }),
                    skipped: t('automations.runSkipped', '{{name}} did nothing', { name: r.automation_name }),
                  }[r.result] || (r.direction === 'sent'
                    ? t('automations.runSent', '{{name}} sent an order to {{to}}', { name: r.automation_name, to: r.to_business })
                    : t('automations.runReceived', '{{from}} sent you an order', { from: r.from_business }));
                  return (
                    <li key={r.id} className="py-2 border-t first:border-t-0 flex items-start gap-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="automation-run">
                      {bad || r.result === 'skipped'
                        ? <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: bad ? 'var(--destructive-solid, #DC2626)' : 'var(--brand-muted)' }} aria-hidden="true" />
                        : <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success, #1F8A50)' }} aria-hidden="true" />}
                      <span style={{ color: 'var(--ink)' }}>
                        {line}
                        {r.result === 'auto_accepted' && ` · ${t('automations.runAccepted', 'accepted automatically')}`}
                        {(bad || r.result === 'skipped') && r.error && ` · ${r.error}`}
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
