/**
 * Dashboard → Deliveries: the courier's own screen (Tzvi, 2026-09-08).
 *
 * A courier is an ordinary account that a business invited. Invites are
 * accepted here; from then on every delivery that business assigns
 * appears here by itself, refreshing every half minute. Each stop:
 * Waze, the items and notes, the window, the amount due and how the
 * customer pays the STORE, the customer's phone only while the order is
 * ready, and two ways to close it - Delivered with a photo (the proof
 * the customer gets by email), or Couldn't deliver with a reason.
 *
 * Designed at 375px first: it is read on a scooter.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, ClipboardList, RefreshCw, Navigation as NavIcon, Phone, MessageCircle, Camera, Check, X, MapPin, Clock, Store as StoreIcon,
} from 'lucide-react';
import { pillStyle } from './OrderCard';
import { buildWhatsAppLink } from '../../utils/whatsappLink';
import { uploadOneFile } from '../../utils/fastUpload';

const REFRESH_MS = 30_000;
const REASONS = ['nobody_home', 'wrong_address', 'refused', 'not_found', 'other'];

export default function DeliveriesTab({ API, token, onChanged }) {
  const { t, i18n } = useTranslation();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [me, setMe] = useState(null);
  const [stops, setStops] = useState(null);
  const [lastLoaded, setLastLoaded] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ data: m }, { data: d }] = await Promise.all([
        axios.get(`${API}/marketplace/courier/me`, auth),
        axios.get(`${API}/marketplace/courier/deliveries`, auth),
      ]);
      setMe(m);
      setStops(d.stops || []);
      setLastLoaded(new Date());
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.loadFailed', 'Could not load orders'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const respond = async (bizId, action) => {
    setBusy(bizId);
    try {
      await axios.post(`${API}/marketplace/courier/invites/${bizId}/${action}`, null, auth);
      toast.success(action === 'accept' ? t('deliveries.accepted', 'You are on their courier list') : t('deliveries.declined', 'Invite declined'));
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.saveFailed', 'Could not save'));
    } finally {
      setBusy(null);
    }
  };

  const lang = String(i18n.language || 'en').split('-')[0];
  if (stops === null || me === null) {
    return <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={18} /></div>;
  }
  const open = stops.filter((s) => ['new', 'preparing', 'ready'].includes(s.status));
  const closed = stops.filter((s) => !['new', 'preparing', 'ready'].includes(s.status));

  return (
    <div data-testid="deliveries-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('deliveries.title', 'Deliveries')}</h2>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
          <RefreshCw size={13} /> {lastLoaded ? t('orders.staff.updated', 'updated {{time}}', { time: lastLoaded.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) }) : t('orders.staff.refresh', 'Refresh')}
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {me.businesses.length
          ? t('deliveries.bodyFor', 'You deliver for {{names}}. New deliveries appear here by themselves.', { names: me.businesses.map((b) => b.business_name).join(', ') })
          : t('deliveries.body', 'A business that invites you appears here. Accept, and their deliveries come to this tab.')}
      </p>

      {me.invites.length > 0 && (
        <div className="rounded-2xl border p-4 mb-4 bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="courier-invites">
          <h3 className="font-bold mb-2" style={{ color: 'var(--ink)' }}>{t('deliveries.invites', 'Invites')}</h3>
          <ul className="space-y-2">
            {me.invites.map((inv) => (
              <li key={inv.business_id} className="flex flex-wrap items-center gap-2" data-testid={`invite-${inv.business_id}`}>
                {inv.logo_url && <img src={inv.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />}
                <span className="text-sm font-semibold flex-1 min-w-0" dir="auto" style={{ color: 'var(--ink)' }}>{t('deliveries.inviteFrom', '{{name}} wants you as their courier', { name: inv.business_name })}</span>
                <button type="button" disabled={busy === inv.business_id} onClick={() => respond(inv.business_id, 'accept')} className="px-4 min-h-[44px] rounded-full text-sm font-semibold" style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="invite-accept">{t('deliveries.accept', 'Accept')}</button>
                <button type="button" disabled={busy === inv.business_id} onClick={() => respond(inv.business_id, 'decline')} className="px-3 min-h-[44px] text-sm font-semibold" style={{ color: 'var(--brand-muted)' }}>{t('deliveries.decline', 'Decline')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open.length === 0 && closed.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} data-testid="deliveries-empty">
          <ClipboardList size={22} className="inline mb-2" />
          <p className="text-sm">{t('orders.courier.empty', 'Nothing to deliver right now.')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {open.map((s, i) => <Stop key={s.id} stop={s} index={i + 1} API={API} token={token} onChanged={load} t={t} />)}
          </div>
          {closed.length > 0 && (
            <section className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.doneToday', 'Done today')} · {closed.length}</h3>
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
                    <div className="text-xs mt-1" dir="auto" style={{ color: 'var(--brand-muted)' }}>{s.business?.name} · {s.address}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <p className="text-[11px] text-center mt-8" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.footer', 'Payment goes to the store, never through MyIsraelRental.')}</p>
    </div>
  );
}

function Stop({ stop: s, index, API, token, onChanged, t }) {
  const [mode, setMode] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pay, setPay] = useState('store');
  const [amount, setAmount] = useState(s.total != null ? String(s.total) : '');
  const [reason, setReason] = useState('nobody_home');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const ready = s.status === 'ready';
  const time = (s.needed_by || '').includes('T') ? s.needed_by.slice(11, 16) : '';
  const dayIso = (s.needed_by || '').slice(0, 10);
  const day = dayIso ? new Intl.DateTimeFormat(document.documentElement.lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${dayIso}T00:00`)) : '';
  const waze = s.address ? `https://waze.com/ul?q=${encodeURIComponent(s.address)}&navigate=yes` : null;
  const wa = s.customer_phone_e164 ? buildWhatsAppLink(s.customer_phone_e164) : null;
  const biz = s.business || {};

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      setPhoto(await uploadOneFile(file, API, token));
    } catch (err) {
      toast.error(err?.message || t('orders.courier.photoFailed', 'Could not upload the photo'));
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
      await axios.patch(`${API}/marketplace/courier/deliveries/${s.id}/status`, body, auth);
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
            <span className="inline-flex items-center gap-1 text-[12px] ms-auto tabular-nums" style={{ color: 'var(--ink)' }}>
              <Clock size={12} /> {day}{s.window ? ` ${s.window.start}–${s.window.end}` : time ? ` ${time}` : ''}
            </span>
          </div>
          <p className="text-[11px] inline-flex items-center gap-1 mt-0.5" style={{ color: 'var(--brand-muted)' }}><StoreIcon size={11} /> {biz.name}</p>
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

      <div className="flex items-center gap-2 mt-3">
        {waze && <a href={waze} target="_blank" rel="noopener noreferrer" className={`${big} flex-1`} style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="stop-waze"><NavIcon size={16} /> {t('orders.courier.navigate', 'Waze')}</a>}
        {ready && s.customer_phone_e164 ? (
          <>
            <a href={`tel:+${s.customer_phone_e164}`} className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full border" style={outline} aria-label={t('orders.call', 'Call {{name}}', { name: s.customer_name })} data-testid="stop-call"><Phone size={18} /></a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full border" style={outline} aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </>
        ) : (
          <span className="text-[11px] px-1" style={{ color: 'var(--brand-muted)' }}>{t('orders.courier.phoneWhenReady', 'Phone shows when the store marks it ready')}</span>
        )}
      </div>

      {ready && mode === null && (
        <div className="flex items-center gap-2 mt-2">
          <button type="button" onClick={() => setMode('deliver')} className={`${big} flex-1`} style={{ background: 'var(--status-open-bg)', color: 'var(--status-open)' }} data-testid="stop-deliver"><Check size={16} /> {t('orders.action.delivered', 'Delivered')}</button>
          <button type="button" onClick={() => setMode('fail')} className={`${big} border`} style={outline} data-testid="stop-fail"><X size={16} /> {t('orders.courier.couldNot', "Couldn't deliver")}</button>
        </div>
      )}

      {mode === 'deliver' && (
        <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'var(--brand-border)' }} data-testid="stop-deliver-form">
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
            <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{t('deliveries.photoWhy', 'The customer gets this photo as proof it arrived.')}</p>
          </div>
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
                  {t('orders.courier.storeHint', "Show the customer the store's payment:")}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(biz.payment_links || []).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 min-h-[36px] inline-flex items-center rounded-full border text-xs font-semibold" style={outline}>{l.label || l.url}</a>)}
                    {biz.payment_note && <span className="px-1 py-2" dir="auto">{biz.payment_note}</span>}
                    {!(biz.payment_links || []).length && !biz.payment_note && <span className="px-1 py-2">{t('orders.courier.noStorePayment', 'The store has not set up a payment link yet.')}</span>}
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
