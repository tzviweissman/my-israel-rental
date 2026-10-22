/**
 * Customers → Leads (backend routes/marketplace/leads.py): every enquiry in
 * stages, New → Replied → Price sent → Won / Lost, built from the chats about
 * the business's listings, its quote requests and prices, and leads it adds
 * itself (a phone call, a walk-in). Any card can be moved; a move holds until
 * the enquiry itself changes.
 *
 * Columns side by side on a laptop, swiped one at a time on a phone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Calculator, PhoneCall, Plus, Trash2, X } from 'lucide-react';
import { money } from '../../utils/currency';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const SOURCE_ICON = { chat: MessageCircle, quote: Calculator, manual: PhoneCall };

export default function LeadsBoard({ API, auth, businessId }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const base = `${API}/marketplace/businesses/${businessId}/leads`;
  const load = useCallback(() => axios.get(base, auth).then(({ data: d }) => setData(d)).catch(() => setData(false)), [base, auth]);
  useEffect(() => { setData(null); load(); }, [load]);

  const STAGE = {
    new: t('leads.st.new', 'New'), replied: t('leads.st.replied', 'Replied'), quoted: t('leads.st.quoted', 'Price sent'),
    won: t('leads.st.won', 'Won'), lost: t('leads.st.lost', 'Lost'),
  };
  const HINT = {
    new: t('leads.hint.new', 'Waiting for your answer'), replied: t('leads.hint.replied', 'You answered'),
    quoted: t('leads.hint.quoted', 'Waiting for the customer'), won: t('leads.hint.won', 'Booked or accepted'), lost: t('leads.hint.lost', 'Not going ahead'),
  };
  const ago = (iso) => {
    if (!iso) return '';
    const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 2) return t('leads.justNow', 'Just now');
    const rtf = new Intl.RelativeTimeFormat(String(i18n.language || '').startsWith('he') ? 'he' : 'en', { numeric: 'auto' });
    // Chrome's Hebrew adds the number in brackets to the singular and the
    // dual ("לפני שעתיים (2)"); the word already says it.
    const f = (n, unit) => rtf.format(-n, unit).replace(/\s*\(\d+\)/, '');
    if (mins < 60) return f(mins, 'minute');
    if (mins < 60 * 24) return f(Math.round(mins / 60), 'hour');
    return f(Math.round(mins / 1440), 'day');
  };

  const move = async (c, stage) => {
    setData({ ...data, leads: data.leads.map((x) => (x.key === c.key ? { ...x, stage } : x)) });
    try { await axios.post(`${base}/move`, { key: c.key, stage }, auth); } catch { toast.error(t('leads.failed', 'Could not save. Try again.')); }
    load();
  };
  const add = async (e) => {
    e.preventDefault();
    try {
      await axios.post(base, { ...form, phone: form.phone || null }, auth);
      setForm({ name: '', phone: '', note: '' }); setAdding(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || t('leads.failed', 'Could not save. Try again.')); }
  };
  const remove = async (c) => {
    if (!window.confirm(t('leads.confirmDelete', 'Delete this lead?'))) return;
    try { await axios.delete(`${base}/${c.id}`, auth); load(); } catch { toast.error(t('leads.failed', 'Could not save. Try again.')); }
  };

  if (data === null) return <div className="py-10 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (data === false) return <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('leads.loadFailed', 'Could not load your leads. Refresh to try again.')}</p>;

  return (
    <div data-testid="leads-board" data-tour="leads-board">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
          {t('leads.body', 'Every enquiry in one place: chats about your listings, quote requests and the prices you sent. Add a phone call yourself, and move a card when it changes.')}
        </p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="leads-add-open" data-tour="leads-add-open">
            <Plus size={14} /> {t('leads.add', 'Add a lead')}
          </button>
        )}
      </div>
      {adding && (
        <form onSubmit={add} className="rounded-xl border bg-white p-3 mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] items-end" style={{ borderColor: 'var(--brand-border)' }} data-testid="leads-add-form">
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.name', 'Name')}
            <input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="auto" required />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.phone', 'Phone (optional)')}
            <input type="tel" value={form.phone} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="ltr" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.note', 'What they want')}
            <input value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="auto"
                   placeholder={t('leads.notePh', 'Called about a deep clean before Pesach')} />
          </label>
          <div className="flex gap-1">
            <button type="submit" disabled={!form.name.trim()} className="px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--action)', color: 'var(--action-ink)' }}>{t('leads.save', 'Add')}</button>
            <button type="button" onClick={() => setAdding(false)} className="grid place-content-center w-11 h-11" aria-label={t('customers.close', 'Close')}><X size={16} /></button>
          </div>
        </form>
      )}

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        {data.stages.map((s) => {
          const cards = data.leads.filter((c) => c.stage === s);
          return (
            <section key={s} className="snap-start shrink-0 w-[82%] sm:w-[240px] xl:w-auto xl:flex-1 xl:min-w-0 rounded-2xl p-2" style={{ background: '#F9FAFB', border: '1px solid var(--brand-border)' }} data-testid={`leads-col-${s}`}>
              <header className="px-1 pb-2">
                <h3 className="text-sm font-semibold flex items-center justify-between" style={{ color: 'var(--ink)' }}>{STAGE[s]} <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{cards.length}</span></h3>
                <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{HINT[s]}</p>
              </header>
              <ul className="space-y-2">
                {cards.map((c) => {
                  const Icon = SOURCE_ICON[c.source] || MessageCircle;
                  return (
                    <li key={c.key} className="rounded-xl border bg-white p-3" style={{ borderColor: s === 'new' ? 'var(--ink)' : 'var(--brand-border)' }} data-testid="lead-card">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold min-w-0 truncate" style={{ color: 'var(--ink)' }} dir="auto">{c.name || t('leads.someone', 'A customer')}</p>
                        <Icon size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-muted)' }} aria-label={t(`leads.src.${c.source}`)} />
                      </div>
                      {c.title && <p className="text-xs truncate" style={{ color: 'var(--brand-muted)' }} dir="auto">{c.title}</p>}
                      {c.last_text && c.last_text !== c.title && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink)' }} dir="auto">{c.last_text}</p>}
                      <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>
                        {c.price ? <b style={{ color: 'var(--ink)' }}>{money(c.price, 'ILS')} · </b> : null}{ago(c.last_at)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        <select value={c.stage} onChange={(e) => move(c, e.target.value)} aria-label={t('leads.moveTo', 'Stage')}
                                className="flex-1 min-w-[120px] px-2 min-h-[36px] rounded-lg border text-xs bg-white" style={fieldStyle} data-testid="lead-move">
                          {data.stages.map((x) => <option key={x} value={x}>{STAGE[x]}</option>)}
                        </select>
                        {c.link && <Link to={c.link} className="px-3 min-h-[36px] inline-flex items-center rounded-lg border text-xs font-semibold" style={fieldStyle}>{t('leads.open', 'Open')}</Link>}
                        {c.phone && <a href={`tel:${c.phone}`} className="px-3 min-h-[36px] inline-flex items-center rounded-lg border text-xs font-semibold" style={fieldStyle} dir="ltr">{t('leads.call', 'Call')}</a>}
                        {c.source === 'manual' && (
                          <button type="button" onClick={() => remove(c)} className="grid place-content-center w-9 h-9" aria-label={t('leads.delete', 'Delete')}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </li>
                  );
                })}
                {!cards.length && <li className="text-xs px-1 py-2" style={{ color: 'var(--brand-muted)' }}>{t('leads.empty', 'Nothing here')}</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
