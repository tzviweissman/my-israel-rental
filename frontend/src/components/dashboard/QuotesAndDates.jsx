/**
 * Appointments → quote requests (backend quotes.py) and tours/workshops
 * dates with who is coming (sessions.py). Each section shows only when it
 * has something in it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Calculator, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { money } from '../../utils/currency';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
const boxStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

function QuoteCard({ q, API, auth, onChanged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(q.status === 'new');
  const [price, setPrice] = useState(q.quote?.price || '');
  const [note, setNote] = useState(q.quote?.note || '');
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState('');
  const reply = async (action) => {
    setBusy(action);
    try {
      await axios.post(`${API}/marketplace/quote-requests/${q.id}/reply`, { action, price: action === 'quote' ? Number(price) : null, note, valid_days: Number(days) }, auth);
      toast.success(action === 'quote' ? t('quotes.sentPrice', 'Price sent. The customer can accept it with one tap.') : t('quotes.declinedOk', 'Declined. The customer is told.'));
      onChanged();
    } catch (err) { toast.error(err?.response?.data?.detail || t('auto.failed', 'Could not save. Try again.')); } finally { setBusy(''); }
  };
  const STATUS = {
    new: t('quotes.st.new', 'Waiting for your price'), quoted: t('quotes.st.quoted', 'Price sent, waiting for the customer'),
    accepted: t('quotes.st.accepted', 'Accepted: arrange it with them'), declined_by_customer: t('quotes.st.custDeclined', 'The customer declined'),
    declined: t('quotes.st.declined', 'You declined'),
  };
  return (
    <li className="rounded-xl border bg-white" style={{ borderColor: q.status === 'new' || q.status === 'accepted' ? 'var(--ink)' : 'var(--brand-border)' }} data-testid={`quote-${q.id}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-start justify-between gap-2 p-3 text-start" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }} dir="auto">{q.name} · {q.gig_title}</span>
          <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{STATUS[q.status]}{q.quote ? ` · ${money(q.quote.price, 'ILS')}` : ''}</span>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-sm" style={{ color: 'var(--ink)' }}>
          <p className="whitespace-pre-line text-start" dir="auto">{q.description}</p>
          {q.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">{q.photos.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" className="w-20 h-20 rounded-lg object-cover" /></a>)}</div>
          )}
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{[q.preferred_date, q.area].filter(Boolean).join(' · ')}</p>
          <p className="text-xs" dir="ltr">{[q.phone, q.email].filter(Boolean).join(' · ')}</p>
          {(q.status === 'new' || q.status === 'quoted') && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: '#F9FAFB' }}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2">{t('quotes.price', 'Price ₪')}
                  <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} className={`${box} w-28`} style={boxStyle} data-testid={`quote-price-${q.id}`} />
                </label>
                <label className="inline-flex items-center gap-2">{t('quotes.valid', 'Holds for')}
                  <select value={days} onChange={(e) => setDays(e.target.value)} className={box} style={boxStyle}>
                    {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{t('quotes.days', '{{n}} days', { n: d })}</option>)}
                  </select>
                </label>
              </div>
              <textarea rows={2} maxLength={1000} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('quotes.notePh', 'What the price includes, e.g. two movers, half a day')}
                        className={`${box} w-full`} style={boxStyle} />
              <div className="flex gap-2">
                <button type="button" disabled={!!busy || !Number(price)} onClick={() => reply('quote')} className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-sm font-semibold disabled:opacity-50"
                        style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid={`quote-send-${q.id}`}>
                  {busy === 'quote' && <Loader2 size={13} className="animate-spin" />} {q.status === 'quoted' ? t('quotes.update', 'Send a new price') : t('quotes.send', 'Send price')}
                </button>
                <button type="button" disabled={!!busy} onClick={() => reply('decline')} className="px-3 min-h-[40px] text-sm underline" style={{ color: 'var(--brand-muted)' }}>{t('quotes.decline', "Can't take it")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function QuotesAndDates({ API, token }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [quotes, setQuotes] = useState([]);
  const [dates, setDates] = useState([]);
  const [openDate, setOpenDate] = useState(null);
  const load = useCallback(() => {
    axios.get(`${API}/marketplace/quote-requests`, auth).then(({ data }) => setQuotes(data.quotes || [])).catch(() => {});
    axios.get(`${API}/marketplace/session-reservations`, auth).then(({ data }) => setDates(data || [])).catch(() => {});
  }, [API, auth]);
  useEffect(() => { load(); }, [load]);
  if (!quotes.length && !dates.length) return null;
  const label = (d) => new Date(`${d.date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="space-y-8 mb-8">
      {quotes.length > 0 && (
        <section data-testid="quotes-inbox">
          <h2 className="text-lg font-bold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}><Calculator size={18} /> {t('quotes.title', 'Quote requests')}</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>{t('quotes.body', 'Customers describe a job and ask for your price. Send one, and they accept or decline with a tap.')}</p>
          <ul className="space-y-2">{quotes.map((q) => <QuoteCard key={q.id} q={q} API={API} auth={auth} onChanged={load} />)}</ul>
        </section>
      )}
      {dates.length > 0 && (
        <section data-testid="dates-overview">
          <h2 className="text-lg font-bold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}><CalendarDays size={18} /> {t('sessions.ownerTitle', 'Tours and workshops')}</h2>
          <ul className="space-y-2">
            {dates.map((d) => {
              const k = `${d.gig_id}:${d.id}`;
              return (
                <li key={k} className="rounded-xl border bg-white" style={{ borderColor: 'var(--brand-border)' }}>
                  <button type="button" onClick={() => setOpenDate(openDate === k ? null : k)} className="w-full flex items-center justify-between gap-2 p-3 text-start" aria-expanded={openDate === k}>
                    <span className="text-sm" style={{ color: 'var(--ink)' }}><b>{label(d)}{d.time ? ` · ${d.time}` : ''}</b> · {d.gig_title}</span>
                    <span className="text-xs shrink-0" style={{ color: d.taken >= d.places ? '#B42318' : 'var(--brand-muted)' }}>{t('sessions.ownerCount', '{{n}} of {{total}} taken', { n: d.taken, total: d.places })}</span>
                  </button>
                  {openDate === k && (
                    <ul className="px-3 pb-3 text-sm space-y-1" style={{ color: 'var(--ink)' }}>
                      {d.people.length ? d.people.map((p, i) => (
                        <li key={i} className="flex flex-wrap justify-between gap-2"><span dir="auto">{p.name} · {t('sessions.placesN', '{{n}} places', { n: p.seats })}</span>
                          <span className="text-xs" dir="ltr" style={{ color: 'var(--brand-muted)' }}>{[p.phone, p.email].filter(Boolean).join(' · ')}</span></li>
                      )) : <li className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('sessions.nobody', 'Nobody yet.')}</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
