/**
 * Dashboard → Customers (backend routes/marketplace/customers.py).
 *
 * Everyone who has ordered from, joined, or booked with the business, as
 * one list: what they bought, their membership, their appointments, and
 * the business's own note and tags. Tap a row to see their history.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Search, Download, Upload, Users, X, Phone, MessageCircle, Tag, Mail } from 'lucide-react';
import { money } from '../../utils/currency';
import { stateLabel } from '../members/memberText';
import MessageComposer from './MessageComposer';
import OccasionsCard from './OccasionsCard';
import { ImportCustomersPanel } from './OrdersTab';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
const chip = 'px-3 min-h-[36px] rounded-full border text-xs font-semibold';
const memberStatus = (t, st) => (st === 'active' ? t('members.okToEnter', 'Active') : stateLabel(t, st));
const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  return d.startsWith('0') ? `972${d.slice(1)}` : d;
};

function Detail({ API, auth, businessId, row, onClose, onSaved, lang }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  const [note, setNote] = useState(row.note || '');
  const [tags, setTags] = useState(row.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const fmt = (s) => (s ? new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s.length > 10 ? s : `${s}T00:00`)) : '');

  useEffect(() => {
    axios.get(`${API}/marketplace/businesses/${businessId}/customer-list/detail`, { ...auth, params: { key: row.key } })
      .then(({ data }) => setD(data)).catch(() => setD(false));
  }, [API, auth, businessId, row.key]);

  const save = async (nextTags = tags) => {
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/marketplace/businesses/${businessId}/customer-list`, { key: row.key, note, tags: nextTags }, auth);
      setTags(data.tags);
      onSaved(data);
      toast.success(t('customers.saved', 'Saved'));
    } catch { toast.error(t('customers.saveFailed', 'Could not save. Try again.')); } finally { setSaving(false); }
  };
  const addTag = () => {
    const v = tagInput.trim().replace(/,/g, '');
    if (!v || tags.includes(v)) { setTagInput(''); return; }
    const next = [...tags, v];
    setTags(next); setTagInput(''); save(next);
  };
  const wa = waNumber(row.phone);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={row.name || row.key} data-testid="customer-detail">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label={t('customers.close', 'Close')} onClick={onClose} />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{row.name || t('customers.noName', 'No name')}</h3>
            <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
              {row.phone && <span dir="ltr">{row.phone}</span>}{row.phone && row.email && ' · '}{row.email}
            </p>
            {row.address && <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{row.address}</p>}
          </div>
          <button type="button" className="grid place-content-center w-11 h-11 shrink-0" aria-label={t('customers.close', 'Close')} onClick={onClose}><X size={18} /></button>
        </div>
        {(row.phone || wa) && (
          <div className="flex gap-2 mb-4">
            {row.phone && <a href={`tel:${row.phone}`} className={`${chip} inline-flex items-center gap-1.5`} style={fieldStyle}><Phone size={14} /> {t('customers.call', 'Call')}</a>}
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${chip} inline-flex items-center gap-1.5`} style={fieldStyle}><MessageCircle size={14} /> WhatsApp</a>}
          </div>
        )}

        <section className="mb-4">
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('customers.tags', 'Tags')}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tg) => (
              <span key={tg} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(36,175,235,.33)', color: '#111827' }}>
                {tg}
                <button type="button" aria-label={t('customers.removeTag', 'Remove tag {{tag}}', { tag: tg })} onClick={() => { const next = tags.filter((x) => x !== tg); setTags(next); save(next); }}><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} maxLength={30} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                   className={field} style={fieldStyle} placeholder={t('customers.tagPh', 'e.g. VIP, wholesale, allergic to nuts')} data-testid="customer-tag-input" />
            <button type="button" onClick={addTag} className={`${chip} shrink-0`} style={fieldStyle} data-testid="customer-tag-add">{t('customers.addTag', 'Add')}</button>
          </div>
        </section>

        <section className="mb-5">
          <label className="text-sm font-semibold block mb-1" style={{ color: 'var(--ink)' }} htmlFor="customer-note">{t('customers.note', 'Your note')}</label>
          <textarea id="customer-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={field} style={fieldStyle}
                    placeholder={t('customers.notePh', 'Only you see this.')} data-testid="customer-note" />
          <button type="button" disabled={saving || note === (row.note || '')} onClick={() => save()} className="mt-2 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="customer-note-save">
            {saving && <Loader2 size={14} className="animate-spin" />} {t('customers.saveNote', 'Save note')}
          </button>
        </section>

        {d === null ? <Loader2 className="animate-spin" size={18} /> : d === false ? null : (
          <>
            {d.memberships.length > 0 && (
              <section className="mb-4">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('customers.memberships', 'Memberships')}</p>
                <ul className="space-y-1.5">
                  {d.memberships.map((m) => (
                    <li key={m.id} className="text-sm rounded-xl border p-2.5" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
                      <b>{m.plan}</b> · {memberStatus(t, m.status)}
                      {m.renews_on && ` · ${t('members.renews', 'Renews')} ${fmt(m.renews_on)}`} · {t('customers.visits', '{{n}} visits', { n: m.visits })}
                      {(m.answers || []).map((a) => <span key={a.id} className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{a.label}: {a.type === 'checkbox' ? (a.value ? t('fields.yes', 'Yes') : t('fields.no', 'No')) : a.value}</span>)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.orders.length > 0 && (
              <section className="mb-4">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('customers.orders', 'Orders')}</p>
                <ul className="space-y-1.5">
                  {d.orders.map((o) => (
                    <li key={o.id} className="text-sm rounded-xl border p-2.5" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
                      <span className="flex justify-between gap-2">
                        <span style={{ color: 'var(--brand-muted)' }}>{fmt(o.created_at)} · {t(`orders.status.${o.status}`, o.status)}</span>
                        {o.total != null && <b className="tabular-nums">{money(o.total, o.currency)}</b>}
                      </span>
                      <span className="block whitespace-pre-line" dir="auto">{o.items}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.bookings.length > 0 && (
              <section className="mb-4">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('customers.bookings', 'Appointments')}</p>
                <ul className="space-y-1.5">
                  {d.bookings.map((b) => (
                    <li key={b.id} className="text-sm rounded-xl border p-2.5" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
                      {b.tier_name || t('customers.booking', 'Appointment')} · {fmt(b.preferred_date || b.created_at)}{b.time_slot ? ` ${b.time_slot}` : ''} · {b.status}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CustomersTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').split('-')[0];
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem('orders.business') || ''; } catch { return ''; } });
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('recent');
  const [open, setOpen] = useState(null);
  const [composing, setComposing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/my-workplaces`, { ...auth, params: { perm: 'customers' } }).then(({ data: d }) => {
      if (!alive) return;
      const active = (d || []).filter((b) => b.active);
      setBusinesses(active);
      if (!active.find((b) => b.id === bizId) && active[0]) setBizId(active[0].id);
    }).catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);
  useEffect(() => { try { if (bizId) localStorage.setItem('orders.business', bizId); } catch { /* private mode */ } }, [bizId]);

  const ready = businesses && businesses.some((b) => b.id === bizId);
  const load = useCallback(() => {
    if (!ready) return;
    axios.get(`${API}/marketplace/businesses/${bizId}/customer-list`, { ...auth, params: { q, kind, tag, sort } })
      .then(({ data: d }) => setData(d)).catch(() => { setData({ customers: [], count: 0, tags: [], totals: {} }); toast.error(t('customers.loadFailed', 'Could not load your customers. Try again.')); });
  }, [ready, API, bizId, auth, q, kind, tag, sort, t]);
  useEffect(() => { const id = setTimeout(load, q ? 250 : 0); return () => clearTimeout(id); }, [load, q]);

  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/marketplace/businesses/${bizId}/customer-list/export.csv`, { ...auth, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'customers.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error(t('customers.exportFailed', 'Could not export. Try again.')); }
  };
  const fmt = (s) => (s ? new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s.length > 10 ? s : `${s}T00:00`)) : '');

  if (businesses === null) return <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (businesses.length === 0) {
    return <p className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>{t('customers.needBusiness', 'Add a business first. Customers belong to a business.')}</p>;
  }
  const biz = businesses.find((b) => b.id === bizId) || businesses[0];
  const totals = data?.totals || {};
  const kinds = [
    ['', t('customers.kind.all', 'Everyone'), totals.customers],
    ['orders', t('customers.kind.orders', 'Ordered'), totals.with_orders],
    ['active_members', t('customers.kind.activeMembers', 'Active members'), totals.active_members],
    ['bookings', t('customers.kind.bookings', 'Booked'), totals.with_bookings],
  ].filter(([k, , n]) => !k || n);

  return (
    <div data-testid="customers-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('customers.title', 'Customers')}</h2>
        <div className="flex items-center gap-2">
          {businesses.length > 1 && (
            <select value={biz.id} onChange={(e) => setBizId(e.target.value)} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle} aria-label={t('orders.pickBusiness', 'Business')}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {(biz.permissions || []).includes('messages') && <button type="button" onClick={() => setComposing(true)} className={`${chip} inline-flex items-center gap-1.5 min-h-[44px]`} style={fieldStyle} data-testid="customers-email">
            <Mail size={14} /> {t('messages.open', 'Email customers')}
          </button>}
          <button type="button" onClick={() => setImporting(!importing)} aria-pressed={importing} className={`${chip} inline-flex items-center gap-1.5 min-h-[44px]`} style={fieldStyle} data-testid="customers-import">
            <Upload size={14} /> {t('customers.import', 'Import')}
          </button>
          <button type="button" onClick={exportCsv} className={`${chip} inline-flex items-center gap-1.5 min-h-[44px]`} style={fieldStyle} data-testid="customers-export">
            <Download size={14} /> {t('customers.export', 'Export')}
          </button>
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('customers.body', 'Everyone who ordered, joined or booked with you, in one place. Add a note or tags to remember who is who.')}
      </p>

      {importing && (
        <div className="mb-4">
          <ImportCustomersPanel API={API} auth={auth} businessId={biz.id} onClose={() => { setImporting(false); load(); }} onDone={load} />
        </div>
      )}

      {!composing && (biz.permissions || []).includes('messages') && (
        <OccasionsCard API={API} auth={auth} biz={biz} onCompose={(m) => setComposing(m)} />
      )}

      {composing && (
        <MessageComposer key={composing === true ? 'blank' : composing.subject} API={API} auth={auth} businessId={biz.id} tags={data?.tags || []}
                         initialKind={kind || 'all'} initialTag={tag} initial={composing === true ? null : composing}
                         onClose={() => setComposing(false)} />
      )}

      <div className="relative mb-3">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className={`${field} ps-9`} style={fieldStyle}
               placeholder={t('customers.searchPh', 'Search by name, phone, email, tag or note')} aria-label={t('customers.search', 'Search customers')} data-testid="customers-search" />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {kinds.map(([k, label, n]) => (
          <button key={k || 'all'} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={chip}
                  style={kind === k ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : fieldStyle}>
            {label}{n ? ` ${n}` : ''}
          </button>
        ))}
        {(data?.tags || []).length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="px-3 min-h-[36px] rounded-full border text-xs font-semibold bg-white" style={fieldStyle} aria-label={t('customers.tagFilter', 'Tag')}>
            <option value="">{t('customers.anyTag', 'Any tag')}</option>
            {data.tags.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="ms-auto px-3 min-h-[36px] rounded-full border text-xs font-semibold bg-white" style={fieldStyle} aria-label={t('customers.sort', 'Sort')}>
          <option value="recent">{t('customers.sortRecent', 'Most recent')}</option>
          <option value="spent">{t('customers.sortSpent', 'Spent the most')}</option>
          <option value="name">{t('customers.sortName', 'Name')}</option>
        </select>
      </div>

      {data === null ? <div className="py-8 text-center"><Loader2 className="animate-spin inline" size={18} /></div>
        : data.customers.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} data-testid="customers-empty">
            <Users size={22} className="inline mb-2" />
            <p>{q || kind || tag ? t('customers.noMatch', 'No one matches.') : t('customers.none', 'No customers yet. Everyone who orders, joins or books with you will appear here.')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.customers.map((c) => {
              const bits = [
                c.orders ? t('customers.ordersN', '{{n}} orders', { count: c.orders, n: c.orders }) + (c.spent ? ` · ${money(c.spent, c.currency)}` : '') : null,
                c.membership ? `${c.membership.plan} · ${memberStatus(t, c.membership.status)}` : null,
                c.bookings ? t('customers.bookingsN', '{{n}} appointments', { count: c.bookings, n: c.bookings }) : null,
                c.imported && !c.orders && !c.membership && !c.bookings ? t('customers.imported', 'From your imported list') : null,
              ].filter(Boolean);
              return (
                <li key={c.key}>
                  <button type="button" onClick={() => setOpen(c)} className="w-full text-start rounded-2xl border bg-white p-3 hover:bg-black/[0.02]" style={{ borderColor: 'var(--brand-border)' }} data-testid="customer-row">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{c.name || c.phone || c.email}</span>
                        <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{bits.join(' · ')}</span>
                        {c.note && <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--ink)' }}>{c.note}</span>}
                      </span>
                      <span className="text-xs shrink-0" style={{ color: 'var(--brand-muted)' }}>{fmt(c.last_seen)}</span>
                    </span>
                    {c.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1 mt-1.5">
                        {c.tags.map((tg) => <span key={tg} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(36,175,235,.33)', color: '#111827' }}><Tag size={10} aria-hidden="true" />{tg}</span>)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      {data && data.count > data.customers.length && (
        <p className="text-xs mt-3" style={{ color: 'var(--brand-muted)' }}>{t('customers.more', 'Showing the first {{shown}} of {{count}}. Search to find the rest.', { shown: data.customers.length, count: data.count })}</p>
      )}

      {open && (
        <Detail API={API} auth={auth} businessId={biz.id} row={open} lang={lang} onClose={() => setOpen(null)}
                onSaved={(c) => { setOpen((o) => ({ ...o, note: c.note, tags: c.tags })); load(); }} />
      )}
    </div>
  );
}
