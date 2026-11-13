/**
 * Customers → Leads (backend routes/marketplace/leads.py): every enquiry in
 * stages, New → Replied → Price sent → Won / Lost, built from the chats about
 * the business's listings, its quote requests and prices, and leads it adds
 * itself (a phone call, a walk-in), and emails to the business's own address
 * (InboxCard, email_inbox.py). Any card can be moved; a move holds until the
 * enquiry itself changes.
 *
 * A new chat or email card carries a suggested reply (lead_nudge.py,
 * utils/lead_assist.py) the owner can edit and send from the card. Nothing
 * is sent without them pressing Send.
 *
 * Columns side by side on a laptop, swiped one at a time on a phone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Calculator, PhoneCall, Plus, Trash2, X, Mail, Sparkles, Send, Copy, Search } from 'lucide-react';
import { money } from '../../utils/currency';
import { buildWhatsAppLinkWithMessage } from '../../utils/whatsappLink';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const SOURCE_ICON = { chat: MessageCircle, quote: Calculator, manual: PhoneCall, email: Mail };
const btn = 'px-3 min-h-[44px] inline-flex items-center gap-1 rounded-lg border text-xs font-semibold';

/**
 * Writes a personal message for any lead, or for a post on the Requests board
 * (backend leads.py draft_message, POST .../leads/write): follow up on a price,
 * check in, win back, introduce the business, in English or Hebrew. The owner
 * edits it, then copies it or opens it in email or WhatsApp. Nothing is sent
 * by us. A new chat or email card has its own reply-and-send box (ReplyBox).
 * Modelled on the AI first-line writers in Lemlist and Clay (Tzvi, 12 Nov 2026).
 */
function MessageWriter({ API, auth, businessId, target, onClose }) {
  const { t, i18n } = useTranslation();
  const GOALS = {
    answer: t('leads.goal.answer', 'Answer their enquiry'),
    follow_up: t('leads.goal.follow_up', 'Follow up on the price'),
    check_in: t('leads.goal.check_in', 'Check in, it went quiet'),
    win_back: t('leads.goal.win_back', 'Win them back'),
    introduce: t('leads.goal.introduce', 'Introduce your business'),
  };
  const [goal, setGoal] = useState(target.goal);
  const [lang, setLang] = useState(String(i18n.language || '').startsWith('he') ? 'he' : 'en');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const write = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/businesses/${businessId}/leads/write`,
        { key: target.key || null, request_id: target.requestId || null, goal, lang, extra }, auth);
      setMsg(data);
    } catch (err) { toast.error(err?.response?.data?.detail || t('leads.writeFailed', 'Could not write it right now. Try again.')); }
    setBusy(false);
  };
  const text = msg ? msg.body : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success(t('leads.copied', 'Copied. Paste it and send.')); }
    catch { toast.error(t('leads.copyFailed', 'Could not copy. Select the text and copy it.')); }
  };
  const wa = msg && target.phone ? buildWhatsAppLinkWithMessage(target.phone, text) : null;
  const mail = msg && target.email ? `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(msg.subject || '')}&body=${encodeURIComponent(text)}` : null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'rgba(17,24,39,.45)' }} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="lead-writer-h" onClick={(e) => e.stopPropagation()}
           className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5" style={{ boxShadow: '0 20px 50px rgba(0,0,0,.2)' }} data-testid="lead-writer">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 id="lead-writer-h" className="text-base font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
              {t('leads.writeTitle', 'A personal message')}
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--brand-muted)' }} dir="auto">{target.label}</p>
          </div>
          <button type="button" onClick={onClose} className="grid place-content-center w-11 h-11 -m-2" aria-label={t('customers.close', 'Close')}><X size={16} /></button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.goalLabel', 'What it should do')}
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className={`${field} mt-1`} style={fieldStyle} data-testid="lead-writer-goal">
              {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.langLabel', 'Language')}
            <select value={lang} onChange={(e) => setLang(e.target.value)} className={`${field} mt-1`} style={fieldStyle}>
              <option value="en">English</option><option value="he">עברית</option>
            </select>
          </label>
        </div>
        <label className="block text-sm mt-2" style={{ color: 'var(--ink)' }}>{t('leads.extraLabel', 'Anything to add? (optional)')}
          <input value={extra} maxLength={300} onChange={(e) => setExtra(e.target.value)} className={`${field} mt-1`} style={fieldStyle} dir="auto"
                 placeholder={t('leads.extraPh', 'Free on Thursday morning')} />
        </label>
        <button type="button" onClick={write} disabled={busy} className="mt-3 w-full inline-flex justify-center items-center gap-1.5 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="lead-writer-go">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {msg ? t('leads.writeAgain', 'Write another') : t('leads.write', 'Write it for me')}
        </button>
        {msg && (
          <div className="mt-3 grid gap-2">
            {target.email && (
              <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.subject', 'Email subject')}
                <input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="auto" />
              </label>
            )}
            <textarea value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} rows={8} dir="auto" aria-label={t('leads.message', 'Message')}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white leading-relaxed" style={fieldStyle} data-testid="lead-writer-body" />
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('leads.checkIt', 'Read it and change anything before you send. We never send it for you.')}</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={copy} className={btn} style={fieldStyle} data-testid="lead-writer-copy"><Copy size={13} /> {t('leads.copy', 'Copy')}</button>
              {mail && <a href={mail} className={btn} style={fieldStyle}><Mail size={13} /> {t('leads.email', 'Open in email')}</a>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btn} style={fieldStyle}><MessageCircle size={13} /> WhatsApp</a>}
              {target.link && <Link to={target.link} className={btn} style={fieldStyle}>{target.requestId ? t('leads.replyOnPost', 'Reply on their post') : t('leads.openChat', 'Open')}</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadsBoard({ API, auth, businessId, refreshKey }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' });
  const [writing, setWriting] = useState(null);
  const closeWriter = useCallback(() => setWriting(null), []);
  const base = `${API}/marketplace/businesses/${businessId}/leads`;
  const load = useCallback(() => axios.get(base, auth).then(({ data: d }) => setData(d)).catch(() => setData(false)), [base, auth]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { if (refreshKey) load(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const STAGE = {
    new: t('leads.st.new', 'New'), replied: t('leads.st.replied', 'Replied'), quoted: t('leads.st.quoted', 'Price sent'),
    won: t('leads.st.won', 'Won'), lost: t('leads.st.lost', 'Lost'),
  };
  const HINT = {
    new: t('leads.hint.new', 'Waiting for your answer'), replied: t('leads.hint.replied', 'You answered'),
    quoted: t('leads.hint.quoted', 'Waiting for the customer'), won: t('leads.hint.won', 'Booked or accepted'), lost: t('leads.hint.lost', 'Not going ahead'),
  };
  const NEXT = {
    answer: t('leads.next.answer', 'Answer now'), follow_up: t('leads.next.follow_up', 'Follow up'), check_in: t('leads.next.check_in', 'Check in'),
  };
  const writeFor = (c) => setWriting({
    key: c.key, phone: c.phone, email: c.email || c.customer_email, link: c.link, label: [c.name, c.title].filter(Boolean).join(' · '),
    goal: c.next || (c.stage === 'lost' ? 'win_back' : c.stage === 'quoted' ? 'follow_up' : 'answer'),
  });
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
      await axios.post(base, { ...form, phone: form.phone || null, email: form.email || null }, auth);
      setForm({ name: '', phone: '', email: '', note: '' }); setAdding(false); load();
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
          {t('leads.body', 'Every enquiry in one place: chats, emails, quote requests and the prices you sent. A new chat or email comes with a suggested reply. Add a phone call yourself, and move a card when it changes.')}
        </p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="leads-add-open" data-tour="leads-add-open">
            <Plus size={14} /> {t('leads.add', 'Add a lead')}
          </button>
        )}
      </div>
      {adding && (
        <form onSubmit={add} className="rounded-xl border bg-white p-3 mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] items-end" style={{ borderColor: 'var(--brand-border)' }} data-testid="leads-add-form">
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.name', 'Name')}
            <input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="auto" required />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.phone', 'Phone (optional)')}
            <input type="tel" value={form.phone} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="ltr" />
          </label>
          <label className="text-sm" style={{ color: 'var(--ink)' }}>{t('leads.emailField', 'Email (optional)')}
            <input type="email" value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${field} mt-1`} style={fieldStyle} dir="ltr" />
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

      {!!data.found?.length && (
        <section className="rounded-2xl border bg-white p-3 mb-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="leads-found">
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
            <Search size={14} style={{ color: 'var(--gold)' }} /> {t('leads.foundTitle', 'People looking for what you do')}
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{data.found.length}</span>
          </h3>
          <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>{t('leads.foundBody', 'Posted on the Requests board in your line of work. Be the first to answer: a personal reply wins the job.')}</p>
          <ul className="flex gap-2 overflow-x-auto snap-x pb-1" style={{ scrollbarWidth: 'thin' }}>
            {data.found.map((r) => (
              <li key={r.id} className="snap-start shrink-0 w-[80%] sm:w-[260px] rounded-xl border p-3 flex flex-col" style={{ borderColor: 'var(--brand-border)', background: '#F9FAFB' }} data-testid="found-card">
                <p className="text-sm font-semibold line-clamp-2" style={{ color: 'var(--ink)' }} dir="auto">{r.title}</p>
                {r.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink)' }} dir="auto">{r.description}</p>}
                <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }} dir="auto">
                  {[r.poster_display_name, r.area, r.budget_type === 'fixed' && r.budget_amount ? money(r.budget_amount, r.budget_currency || 'ILS') : null, ago(r.created_at)].filter(Boolean).join(' · ')}
                </p>
                <div className="flex flex-wrap gap-1 mt-auto pt-2">
                  <button type="button" onClick={() => setWriting({ requestId: r.id, link: `/requests/${r.id}`, label: r.title, goal: 'introduce' })}
                          className={btn} style={{ background: 'var(--action)', color: 'var(--action-ink)', borderColor: 'var(--action)' }} data-testid="found-write">
                    <Sparkles size={13} /> {t('leads.writeReply', 'Write a reply')}
                  </button>
                  <Link to={`/requests/${r.id}`} className={btn} style={fieldStyle}>{t('leads.open', 'Open')}</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
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
                      {c.next && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" data-testid="lead-next"
                              style={c.next === 'answer' ? { background: 'var(--ink)', color: '#fff' } : { background: 'rgba(36,175,235,.33)', color: 'var(--ink)' }}>
                          {NEXT[c.next]}
                        </span>
                      )}
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
                        {!(s === 'new' && (c.source === 'chat' || c.source === 'email')) && (
                          <button type="button" onClick={() => writeFor(c)} className={btn} style={fieldStyle} data-testid="lead-write">
                            <Sparkles size={13} /> {t('leads.writeShort', 'Write')}
                          </button>
                        )}
                        {c.link && <Link to={c.link} className="px-3 min-h-[36px] inline-flex items-center rounded-lg border text-xs font-semibold" style={fieldStyle}>{t('leads.open', 'Open')}</Link>}
                        {c.phone && <a href={`tel:${c.phone}`} className="px-3 min-h-[36px] inline-flex items-center rounded-lg border text-xs font-semibold" style={fieldStyle} dir="ltr">{t('leads.call', 'Call')}</a>}
                        {c.source === 'manual' && (
                          <button type="button" onClick={() => remove(c)} className="grid place-content-center w-11 h-11" aria-label={t('leads.delete', 'Delete')}><Trash2 size={14} /></button>
                        )}
                      </div>
                      {s === 'new' && (c.source === 'chat' || c.source === 'email') && (
                        <ReplyBox card={c} base={base} auth={auth} onSent={load} />
                      )}
                    </li>
                  );
                })}
                {!cards.length && <li className="text-xs px-1 py-2" style={{ color: 'var(--brand-muted)' }}>{t('leads.empty', 'Nothing here')}</li>}
              </ul>
            </section>
          );
        })}
      </div>
      {writing && <MessageWriter API={API} auth={auth} businessId={businessId} target={writing} onClose={closeWriter} />}
    </div>
  );
}

/** The suggested reply on a new chat or email card: ask for one, edit it, send it. */
function ReplyBox({ card, base, auth, onSent }) {
  const { t } = useTranslation();
  const [text, setText] = useState(card.draft || '');
  const [subject, setSubject] = useState(card.draft_subject || (card.subject ? `Re: ${card.subject}` : ''));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(card.draft || ''); }, [card.draft]);
  const isEmail = card.source === 'email';
  if (isEmail && !card.can_send) return <p className="text-[11px] mt-2" style={{ color: 'var(--brand-muted)' }}>{t('leads.noAddress', 'This email has no address to answer. Reply from your own email.')}</p>;

  const suggest = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${base}/draft`, { key: card.key }, auth);
      setText(data.draft || ''); if (data.draft_subject) setSubject(data.draft_subject); setOpen(true);
    } catch (err) { toast.error(err?.response?.data?.detail || t('leads.failed', 'Could not save. Try again.')); }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    try {
      await axios.post(`${base}/reply`, { key: card.key, text, subject: isEmail ? subject : null }, auth);
      toast.success(t('leads.sent', 'Sent')); onSent();
    } catch (err) { toast.error(err?.response?.data?.detail || t('leads.sendFailed', 'That did not send. Try again.')); }
    setBusy(false);
  };
  const markEmail = async (status) => {
    try { await axios.post(base.replace(/\/leads$/, `/inbox/${card.email_id}/status`), { status }, auth); onSent(); } catch { toast.error(t('leads.failed', 'Could not save. Try again.')); }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {text ? (
          <button type="button" onClick={() => setOpen(true)} className="px-3 min-h-[36px] inline-flex items-center gap-1 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--ink)' }} data-testid="lead-draft-open">
            <Sparkles size={12} /> {t('leads.seeDraft', 'Suggested reply ready')}
          </button>
        ) : (
        <button type="button" onClick={suggest} disabled={busy} className="px-3 min-h-[36px] inline-flex items-center gap-1 rounded-lg border text-xs font-semibold disabled:opacity-50" style={fieldStyle} data-testid="lead-suggest">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {busy ? t('leads.suggesting', 'Writing…') : t('leads.suggest', 'Suggest a reply')}
        </button>
        )}
        {isEmail && <EmailMarks t={t} mark={markEmail} />}
      </div>
    );
  }
  return (
    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="lead-reply">
      <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--ink)' }}><Sparkles size={12} style={{ color: 'var(--gold)' }} aria-hidden="true" /> {t('leads.draftLabel', 'Suggested reply')}</p>
      {isEmail && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} aria-label={t('leads.subject', 'Subject')}
               className="w-full px-2 py-1.5 mt-1 rounded-lg border text-xs bg-white" style={fieldStyle} dir="auto" />
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={8000} dir="auto" aria-label={t('leads.draftLabel', 'Suggested reply')}
                className="w-full px-2 py-1.5 mt-1 rounded-lg border text-xs bg-white" style={fieldStyle} data-testid="lead-reply-text" />
      <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
        {isEmail ? t('leads.emailTo', { email: card.customer_email, defaultValue: 'To {{email}}. If they answer, it comes to your own email.' }) + ' ' : ''}
        {t('leads.draftNote', 'Written by AI from what your page says. Check it before you send.')}
      </p>
      <div className="flex flex-wrap gap-1 mt-1">
        <button type="button" onClick={send} disabled={busy || !text.trim() || (isEmail && !subject.trim())}
                className="px-4 min-h-[36px] inline-flex items-center gap-1 rounded-full text-xs font-semibold disabled:opacity-50"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="lead-reply-send">
          <Send size={12} /> {t('leads.send', 'Send')}
        </button>
        <button type="button" onClick={suggest} disabled={busy} className="px-3 min-h-[36px] inline-flex items-center gap-1 rounded-lg border text-xs font-semibold disabled:opacity-50" style={fieldStyle}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t('leads.suggest', 'Suggest a reply')}
        </button>
        {isEmail && <EmailMarks t={t} mark={markEmail} />}
      </div>
    </div>
  );
}

function EmailMarks({ t, mark }) {
  return (
    <>
      <button type="button" onClick={() => mark('done')} className="px-3 min-h-[36px] inline-flex items-center rounded-lg border text-xs font-semibold" style={fieldStyle}>{t('leads.markDone', 'Done')}</button>
      <button type="button" onClick={() => mark('spam')} className="px-3 min-h-[36px] inline-flex items-center rounded-lg border text-xs font-semibold" style={fieldStyle}>{t('leads.markSpam', 'Spam')}</button>
    </>
  );
}
