/**
 * Dashboard → Classes (backend routes/marketplace/classes.py): the week's
 * classes with who is booked, and the weekly timetable they come from.
 * Check-in staff see the week; the timetable is for Members.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronUp, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const btnOutline = 'inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border text-sm font-semibold';
const EMPTY = { title: '', weekday: 0, start: '18:00', duration_min: 60, capacity: 12, instructor: '', location: '', plan_ids: [], active: true };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dayNames = (lang) => (lang === 'he'
  ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

function TemplateForm({ initial, plans, onSave, onCancel, saving, lang }) {
  const { t } = useTranslation();
  const [c, setC] = useState(initial);
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...c, weekday: Number(c.weekday), duration_min: Number(c.duration_min), capacity: Number(c.capacity),
             instructor: c.instructor?.trim() || null, location: c.location?.trim() || null });
  };
  const L = ({ label, children }) => <label className="block text-sm" style={{ color: 'var(--ink)' }}>{label}<span className="block mt-1">{children}</span></label>;
  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 mb-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="class-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <L label={t('classes.name', 'Class')}><input required maxLength={80} value={c.title} onChange={set('title')} className={field} style={fieldStyle} placeholder={t('classes.namePh', 'e.g. Morning yoga')} data-testid="class-title" /></L>
        <L label={t('classes.day', 'Day')}>
          <select value={c.weekday} onChange={set('weekday')} className={field} style={fieldStyle} data-testid="class-day">
            {dayNames(lang).map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        </L>
        <L label={t('classes.time', 'Starts at')}><input required type="time" value={c.start} onChange={set('start')} className={field} style={fieldStyle} data-testid="class-start" /></L>
        <L label={t('classes.length', 'Minutes')}><input required type="number" min="10" max="600" value={c.duration_min} onChange={set('duration_min')} className={field} style={fieldStyle} /></L>
        <L label={t('classes.capacity', 'Places')}><input required type="number" min="1" max="500" value={c.capacity} onChange={set('capacity')} className={field} style={fieldStyle} data-testid="class-capacity" /></L>
        <L label={t('classes.instructor', 'Instructor (optional)')}><input maxLength={80} value={c.instructor || ''} onChange={set('instructor')} className={field} style={fieldStyle} /></L>
        <L label={t('classes.location', 'Room or place (optional)')}><input maxLength={80} value={c.location || ''} onChange={set('location')} className={field} style={fieldStyle} /></L>
      </div>
      {plans.length > 1 && (
        <fieldset>
          <legend className="text-sm mb-1" style={{ color: 'var(--ink)' }}>{t('classes.plans', 'Who can book (none ticked: every active member)')}</legend>
          <div className="flex flex-wrap gap-x-4">
            {plans.map((p) => (
              <label key={p.id} className="inline-flex items-center gap-2 text-sm min-h-[36px]" style={{ color: 'var(--ink)' }}>
                <input type="checkbox" checked={c.plan_ids.includes(p.id)} onChange={(e) => setC({ ...c, plan_ids: e.target.checked ? [...c.plan_ids, p.id] : c.plan_ids.filter((x) => x !== p.id) })} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="class-save">
          {saving && <Loader2 size={14} className="animate-spin" />} {t('classes.save', 'Save')}
        </button>
        <button type="button" className={btnOutline} style={fieldStyle} onClick={onCancel}>{t('classes.cancel', 'Cancel')}</button>
      </div>
    </form>
  );
}

export default function ClassesTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').startsWith('he') ? 'he' : 'en';
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem('orders.business') || ''; } catch { return ''; } });
  const [weekStart, setWeekStart] = useState(() => new Date());
  const [sessions, setSessions] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/my-workplaces`, { ...auth, params: { perm: 'checkin' } }).then(({ data }) => {
      if (!alive) return;
      const list = (data || []).filter((b) => b.active);
      setBusinesses(list);
      if (!list.find((b) => b.id === bizId) && list[0]) setBizId(list[0].id);
    }).catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);
  useEffect(() => { try { if (bizId) localStorage.setItem('orders.business', bizId); } catch { /* private mode */ } }, [bizId]);
  const biz = (businesses || []).find((b) => b.id === bizId);
  const canEdit = biz && (biz.role === 'owner' || (biz.permissions || []).includes('members'));
  const base = `${API}/marketplace/businesses/${bizId}`;

  const load = useCallback(() => {
    if (!biz) return;
    axios.get(`${base}/class-sessions`, { ...auth, params: { start: iso(weekStart), days: 7 } }).then(({ data }) => setSessions(data)).catch(() => setSessions([]));
    if (canEdit) {
      axios.get(`${base}/classes`, auth).then(({ data }) => setTemplates(data)).catch(() => {});
      axios.get(`${base}/membership-plans`, auth).then(({ data }) => setPlans(data)).catch(() => {});
    }
  }, [biz, base, auth, weekStart, canEdit]);
  useEffect(() => { load(); }, [load]);

  if (businesses === null) return <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (!businesses.length) return <p className="rounded-2xl border p-8 text-center text-sm" style={{ ...fieldStyle, color: 'var(--brand-muted)' }}>{t('classes.needBusiness', 'Add a business first.')}</p>;

  const save = async (body) => {
    setSaving(true);
    try {
      if (editing.id) await axios.put(`${base}/classes/${editing.id}`, body, auth); else await axios.post(`${base}/classes`, body, auth);
      setEditing(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || t('classes.failed', 'Could not save. Try again.')); } finally { setSaving(false); }
  };
  const removeTpl = async (c) => {
    if (!window.confirm(t('classes.removeConfirm', 'Take {{name}} off the timetable? Classes people already booked stay until you cancel them.', { name: c.title }))) return;
    await axios.delete(`${base}/classes/${c.id}`, auth).catch(() => {});
    load();
  };
  const cancelSession = async (s) => {
    const reason = window.prompt(t('classes.cancelPrompt', 'Cancel this class? Everyone booked gets an email. Add a reason (optional):'), '');
    if (reason === null) return;
    try { await axios.post(`${base}/class-sessions/${s.id}/cancel`, { reason: reason || null }, auth); load(); } catch (e) { toast.error(e?.response?.data?.detail || t('classes.failed', 'Could not save. Try again.')); }
  };
  const days = dayNames(lang);
  const fmtDay = (d) => new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${d}T00:00`));
  const byDay = (sessions || []).reduce((acc, s) => { (acc[s.date] = acc[s.date] || []).push(s); return acc; }, {});
  const shiftWeek = (n) => { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d); };

  return (
    <div data-testid="classes-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('classes.title', 'Classes')}</h2>
        {businesses.length > 1 && (
          <select value={bizId} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>{t('classes.body', 'Members book from their membership page, up to two weeks ahead. A full class takes a waiting list, and checking in at the door marks who came.')}</p>

      {/* The week */}
      <div className="flex items-center gap-2 mb-3">
        <button type="button" className="grid place-content-center w-11 h-11 rounded-full border" style={fieldStyle} aria-label={t('classes.prevWeek', 'Previous week')} onClick={() => shiftWeek(-1)}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('classes.weekOf', 'Week from {{d}}', { d: fmtDay(iso(weekStart)) })}</p>
        <button type="button" className="grid place-content-center w-11 h-11 rounded-full border" style={fieldStyle} aria-label={t('classes.nextWeek', 'Next week')} onClick={() => shiftWeek(1)}><ChevronRight size={16} className="rtl:rotate-180" /></button>
      </div>
      {sessions === null ? <Loader2 className="animate-spin" size={18} /> : sessions.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-sm mb-6" style={{ ...fieldStyle, color: 'var(--brand-muted)' }} data-testid="classes-empty">
          <CalendarDays size={22} className="inline mb-2" />
          <p>{canEdit ? t('classes.noneEdit', 'No classes this week. Add your first class to the timetable below.') : t('classes.none', 'No classes this week.')}</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {Object.entries(byDay).map(([d, list]) => (
            <section key={d}>
              <h3 className="text-sm font-bold mb-1.5" style={{ color: 'var(--ink)' }}>{fmtDay(d)}</h3>
              <ul className="space-y-1.5">
                {list.map((s) => (
                  <li key={s.id} className="rounded-xl border bg-white" style={{ borderColor: 'var(--brand-border)', opacity: s.cancelled ? 0.6 : 1 }} data-testid="session-row">
                    <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="w-full flex items-center justify-between gap-2 p-3 text-start min-h-[44px]" aria-expanded={open === s.id}>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{s.start} · {s.title}{s.cancelled && ` · ${t('classes.cancelled', 'Cancelled')}`}</span>
                        <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>
                          {t('classes.bookedOf', '{{n}} of {{cap}} booked', { n: s.booked, cap: s.capacity })}
                          {s.waitlist > 0 && ` · ${t('classes.waiting', '{{n}} waiting', { n: s.waitlist })}`}
                          {s.instructor && ` · ${s.instructor}`}{s.location && ` · ${s.location}`}
                        </span>
                      </span>
                      {open === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {open === s.id && (
                      <div className="px-3 pb-3">
                        {s.roster.length === 0 ? <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('classes.nobody', 'Nobody booked yet.')}</p> : (
                          <ol className="text-sm space-y-0.5 list-decimal ps-5" style={{ color: 'var(--ink)' }}>
                            {s.roster.map((r) => <li key={r.id}>{r.name} <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>· {t(`classes.status.${r.status}`, r.status)}</span></li>)}
                          </ol>
                        )}
                        {canEdit && !s.cancelled && (
                          <button type="button" onClick={() => cancelSession(s)} className="mt-2 text-xs underline" style={{ color: 'var(--ink)' }} data-testid="session-cancel">{t('classes.cancelThis', 'Cancel this class')}</button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* The timetable */}
      {canEdit && (
        <section data-testid="timetable">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('classes.timetable', 'Weekly timetable')}</h3>
            {!editing && <button type="button" className={btnOutline} style={fieldStyle} onClick={() => setEditing({ ...EMPTY })} data-testid="class-new"><Plus size={15} /> {t('classes.add', 'Add a class')}</button>}
          </div>
          {editing && <TemplateForm initial={editing} plans={plans} saving={saving} lang={lang} onCancel={() => setEditing(null)} onSave={save} />}
          {templates.length === 0 && !editing ? (
            <p className="text-sm rounded-2xl border p-4" style={{ ...fieldStyle, color: 'var(--brand-muted)' }}>{t('classes.noTimetable', 'No classes yet. Add each weekly class once and it repeats every week.')}</p>
          ) : (
            <ul className="space-y-1.5">
              {templates.map((c) => (
                <li key={c.id} className="rounded-xl border bg-white p-3 flex items-center justify-between gap-2" style={{ borderColor: 'var(--brand-border)' }} data-testid="template-row">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{days[c.weekday]} {c.start} · {c.title}</span>
                    <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{t('classes.summaryLine', '{{m}} min · {{cap}} places', { m: c.duration_min, cap: c.capacity })}{c.instructor && ` · ${c.instructor}`}</span>
                  </span>
                  <span className="flex">
                    <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('classes.edit', 'Edit')} onClick={() => setEditing({ ...c, instructor: c.instructor || '', location: c.location || '', plan_ids: c.plan_ids || [] })}><Pencil size={15} /></button>
                    <button type="button" className="grid place-content-center w-11 h-11" aria-label={t('classes.remove', 'Remove')} onClick={() => removeTpl(c)}><Trash2 size={15} /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
