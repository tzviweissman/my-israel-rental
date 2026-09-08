/**
 * /orders/courier/:token — the courier's run sheet (spec O5 + O6).
 *
 * One ordered list, not five notifications. Each stop: navigate (Waze,
 * Israel's default — we build no map), the items and notes, the time it
 * is needed, the amount due and how the customer pays the STORE, the
 * customer's phone only while the order is ready, and two ways to close
 * it: Delivered (with a photo) or Couldn't deliver (with a reason).
 *
 * This is the real test in the spec: Hebrew, at 375px, on a scooter. So
 * the primary control on every stop is one big button, the photo is
 * taken with the phone camera straight from the page, and nothing here
 * needs a login or a second screen.
 *
 * No site chrome (nav links go to pages this person has no account for).
 * Refreshes every 30 seconds so an order marked ready at the counter
 * shows up on the road without a pull-to-refresh.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, ClipboardList, RefreshCw, Navigation as NavIcon, Phone, MessageCircle, Camera, Check, X, MapPin, Clock,
} from 'lucide-react';
import { API } from '../lib/apiBase';
import { pillStyle } from '../components/dashboard/OrderCard';
import { buildWhatsAppLink } from '../utils/whatsappLink';

const REFRESH_MS = 30_000;
const REASONS = ['nobody_home', 'wrong_address', 'refused', 'not_found', 'other'];

export default function CourierRunSheet() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);      // null loading, false bad link
  const [lastLoaded, setLastLoaded] = useState(null);

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/marketplace/orders/courier/${encodeURIComponent(token)}`);
      setData(d);
      setLastLoaded(new Date());
    } catch (err) {
      if (err?.response?.status === 404) setData(false);
      else toast.error(t('orders.loadFailed', 'Could not load orders'));
    }
  }, [token, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const lang = String(i18n.language || 'en').split('-')[0];

  if (data === null) {
    return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  }
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="courier-bad-link">
        <ClipboardList size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('orders.staff.badLinkTitle', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.badLinkBody', 'Ask the store for a new one.')}</p>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business?.name_he) || data.business?.name || '';
  const open = data.stops.filter((s) => ['new', 'preparing', 'ready'].includes(s.status));
  const closed = data.stops.filter((s) => !['new', 'preparing', 'ready'].includes(s.status));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="courier-sheet">
      <header className="sticky top-0 z-10 px-4 py-3 border-b bg-white" style={{ borderColor: 'var(--brand-border)' }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {data.business?.logo_url && <img src={data.business.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{bizName}</h1>
            <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {t('orders.courier.subtitle', 'Run sheet for {{name}}', { name: data.courier?.name })}
              {lastLoaded && ` · ${t('orders.staff.updated', 'updated {{time}}', { time: lastLoaded.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) })}`}
            </p>
          </div>
          <button type="button" onClick={load} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.staff.refresh', 'Refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-4">
        {open.length === 0 && closed.length === 0 && (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
            <ClipboardList size={22} className="inline mb-2" />
            <p className="text-sm">{t('orders.courier.empty', 'Nothing to deliver right now.')}</p>
          </div>
        )}
        <div className="space-y-3">
          {open.map((s, i) => (
            <Stop key={s.id} stop={s} index={i + 1} business={data.business} token={token} onChanged={load} t={t} />
          ))}
        </div>
        {closed.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.doneToday', 'Done today')} · {closed.length}</h2>
            <div className="space-y-2">
              {closed.map((s) => (
                <div key={s.id} className="rounded-2xl border bg-white p-3 text-sm" style={{ borderColor: 'var(--brand-border)', opacity: 0.7 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{s.customer_name}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={pillStyle(s.status, false)}>
                      {s.status === 'done' ? t('orders.action.delivered', 'Delivered') : t('orders.status.failed', 'Failed')}
                    </span>
                    {s.payment?.method === 'cash' && <span className="text-[11px] ms-auto" style={{ color: 'var(--ink)' }}>₪{Number(s.payment.amount).toLocaleString()} {t('orders.courier.cashShort', 'cash')}</span>}
                  </div>
                  <div className="text-xs mt-1" dir="auto" style={{ color: 'var(--brand-muted)' }}>{s.address}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        <p className="text-[11px] text-center mt-8" style={{ color: 'var(--brand-muted)' }}>
          {t('orders.courier.footer', 'Payment goes to the store, never through MyIsraelRental.')}
        </p>
      </main>
    </div>
  );
}

function Stop({ stop: s, index, business, token, onChanged, t }) {
  const [mode, setMode] = useState(null);         // null | 'deliver' | 'fail'
  const [photo, setPhoto] = useState(null);       // uploaded url
  const [uploading, setUploading] = useState(false);
  const [pay, setPay] = useState('store');        // store | cash | none
  const [amount, setAmount] = useState(s.total != null ? String(s.total) : '');
  const [reason, setReason] = useState('nobody_home');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const ready = s.status === 'ready';
  const time = (s.needed_by || '').includes('T') ? s.needed_by.slice(11, 16) : '';
  const waze = s.address ? `https://waze.com/ul?q=${encodeURIComponent(s.address)}&navigate=yes` : null;
  const wa = s.customer_phone_e164 ? buildWhatsAppLink(s.customer_phone_e164) : null;

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API}/marketplace/orders/courier/${encodeURIComponent(token)}/${s.id}/photo`, fd);
      setPhoto(data.url);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.courier.photoFailed', 'Could not upload the photo'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (status) => {
    setBusy(true);
    try {
      const body = { status, note };
      if (status === 'done') {
        body.photo_url = photo;
        if (pay === 'cash') body.payment = { method: 'cash', amount: amount === '' ? null : Number(amount) };
        else if (pay === 'store') body.payment = { method: 'bit', amount: s.total };
      } else {
        body.reason = reason;
        if (photo) body.photo_url = photo;
      }
      await axios.patch(`${API}/marketplace/orders/courier/${encodeURIComponent(token)}/${s.id}/status`, body);
      toast.success(status === 'done' ? t('orders.courier.markedDelivered', 'Marked delivered') : t('orders.courier.markedFailed', 'Marked as not delivered'));
      setMode(null);
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const big = 'inline-flex items-center justify-center gap-1.5 min-h-[48px] rounded-full text-sm font-semibold px-4 disabled:opacity-50';
  const outline = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

  return (
    <article className="rounded-2xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid={`stop-${s.id}`} data-status={s.status}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full grid place-content-center text-sm font-bold" style={{ background: 'var(--ink)', color: 'var(--action-ink)' }}>{index}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{s.customer_name}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={pillStyle(s.status, false)}>
              {ready ? t('orders.courier.go', 'Ready to go') : t('orders.courier.notReady', 'Not ready yet')}
            </span>
            {time && <span className="inline-flex items-center gap-1 text-[12px] ms-auto tabular-nums" style={{ color: 'var(--ink)' }}><Clock size={12} /> {time}</span>}
          </div>
          <p className="text-sm mt-1 inline-flex items-start gap-1" dir="auto" style={{ color: 'var(--ink)' }}><MapPin size={14} className="mt-0.5 shrink-0" /> <span>{s.address}</span></p>
          <p className="text-sm mt-1 whitespace-pre-line" dir="auto" style={{ color: 'var(--brand-muted)' }}>{s.items}</p>
          {s.notes && <p className="text-xs mt-1 italic" dir="auto" style={{ color: 'var(--brand-muted)' }}>{s.notes}</p>}
          {s.total != null && (
            <p className="text-sm mt-2 font-semibold" style={{ color: 'var(--ink)' }}>
              {t('orders.courier.due', 'Due: ₪{{n}}', { n: Number(s.total).toLocaleString() })}
              {s.payment?.method && <span className="font-normal ms-2" style={{ color: 'var(--status-open)' }}>· {t('orders.paidShort', 'paid')}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Row 1: get there, reach them. */}
      <div className="flex items-center gap-2 mt-3">
        {waze && (
          <a href={waze} target="_blank" rel="noopener noreferrer" className={`${big} flex-1`} style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="stop-waze">
            <NavIcon size={16} /> {t('orders.courier.navigate', 'Waze')}
          </a>
        )}
        {ready && s.customer_phone_e164 ? (
          <>
            <a href={`tel:+${s.customer_phone_e164}`} className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full border" style={outline} aria-label={t('orders.call', 'Call {{name}}', { name: s.customer_name })} data-testid="stop-call"><Phone size={18} /></a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full border" style={outline} aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </>
        ) : (
          <span className="text-[11px] px-1" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.phoneWhenReady', 'Phone shows when the store marks it ready')}</span>
        )}
      </div>

      {/* Row 2: close it. Only when ready. */}
      {ready && mode === null && (
        <div className="flex items-center gap-2 mt-2">
          <button type="button" onClick={() => setMode('deliver')} className={`${big} flex-1`} style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="stop-deliver">
            <Check size={16} /> {t('orders.action.delivered', 'Delivered')}
          </button>
          <button type="button" onClick={() => setMode('fail')} className={`${big} border`} style={outline} data-testid="stop-fail">
            <X size={16} /> {t('orders.courier.couldNot', "Couldn't deliver")}
          </button>
        </div>
      )}

      {mode === 'deliver' && (
        <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="stop-deliver-form">
          {/* Photo first: required, and the camera is one tap. */}
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} data-testid="stop-photo-input" />
            {photo ? (
              <div className="flex items-center gap-2">
                <img src={photo} alt="" className="w-14 h-14 rounded-lg object-cover" />
                <span className="text-xs" style={{ color: 'var(--status-open)' }}>{t('orders.courier.photoOk', 'Photo added')}</span>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs underline ms-auto" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.retake', 'Retake')}</button>
              </div>
            ) : (
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${big} w-full border`} style={outline} data-testid="stop-photo">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {t('orders.courier.takePhoto', 'Take a photo of the delivery')}
              </button>
            )}
          </div>

          {/* Then money. The store's way first; cash one tap further. */}
          {s.total != null && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.paymentQ', 'How did they pay?')}</p>
              <div className="grid grid-cols-3 gap-1 rounded-lg p-1" style={{ background: 'var(--surface-muted)' }} role="radiogroup">
                {[['store', t('orders.courier.paidStore', 'To the store')], ['cash', t('orders.courier.paidCash', 'Cash to me')], ['none', t('orders.courier.notPaid', 'Not yet')]].map(([v, lbl]) => (
                  <button key={v} type="button" role="radio" aria-checked={pay === v} onClick={() => setPay(v)} className="min-h-[40px] rounded-md text-xs font-semibold" style={pay === v ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--ink)' }} data-testid={`stop-pay-${v}`}>{lbl}</button>
                ))}
              </div>
              {pay === 'store' && (
                <div className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {t('orders.courier.storeHint', 'Show the customer the store\'s payment:')}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(business.payment_links || []).map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 min-h-[36px] inline-flex items-center rounded-full border text-xs font-semibold" style={outline}>{l.label || l.url}</a>
                    ))}
                    {business.payment_note && <span className="px-1 py-2" dir="auto">{business.payment_note}</span>}
                    {!(business.payment_links || []).length && !business.payment_note && <span className="px-1 py-2">{t('orders.courier.noStorePayment', 'The store has not set up a payment link yet.')}</span>}
                  </div>
                </div>
              )}
              {pay === 'cash' && (
                <div className="mt-2">
                  <label className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }} htmlFor={`amt-${s.id}`}>{t('orders.courier.amount', 'Amount collected (₪)')}</label>
                  <input id={`amt-${s.id}`} type="number" inputMode="decimal" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 min-h-[44px] rounded-lg border text-base bg-white mt-1" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="stop-amount" />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || !photo || (pay === 'cash' && amount === '')} onClick={() => submit('done')} className={`${big} flex-1`} style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="stop-confirm-delivered">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {t('orders.courier.confirmDelivered', 'Confirm delivered')}
            </button>
            <button type="button" onClick={() => setMode(null)} className="px-3 min-h-[48px] text-sm font-semibold" style={{ color: 'var(--brand-muted)' }}>{t('orders.cancel', 'Cancel')}</button>
          </div>
        </div>
      )}

      {mode === 'fail' && (
        <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="stop-fail-form">
          <div role="radiogroup" className="space-y-1">
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className="w-full text-start px-3 min-h-[44px] rounded-lg border text-sm font-semibold" style={reason === r ? { background: 'var(--ink)', color: 'var(--action-ink)', borderColor: 'var(--ink)' } : outline} data-testid={`stop-reason-${r}`}>
                {t(`orders.courier.reason.${r}`, r)}
              </button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('orders.courier.notePh', 'Anything the store should know')} dir="auto" className="w-full px-3 min-h-[44px] rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} />
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full border text-xs font-semibold" style={outline}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {photo ? t('orders.courier.photoOk', 'Photo added') : t('orders.courier.photoWhere', 'Photo of where you were (optional)')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy} onClick={() => submit('failed')} className={`${big} flex-1 border`} style={outline} data-testid="stop-confirm-failed">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} {t('orders.courier.confirmFailed', 'Mark as not delivered')}
            </button>
            <button type="button" onClick={() => setMode(null)} className="px-3 min-h-[48px] text-sm font-semibold" style={{ color: 'var(--brand-muted)' }}>{t('orders.cancel', 'Cancel')}</button>
          </div>
        </div>
      )}
    </article>
  );
}
