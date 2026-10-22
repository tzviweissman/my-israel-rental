/**
 * /pay/:token — a payment request a business sent by message (backend
 * routes/marketplace/payment_requests.py).
 *
 * The amount, what it is for, and the business's own payment buttons. We
 * never take the money: the customer pays on Bit, PayBox, Grow and so on,
 * then presses "I have paid", which tells the business to check. No sign-in;
 * the link is the proof. Written in the language the business chose for the
 * request, whatever the site language is.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '../lib/apiBase';

const fmt = (n) => `₪${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function PaymentRequestPage() {
  const { token } = useParams();
  const { i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  // The request's language may not be the site's, and Hebrew is loaded on
  // demand (i18n.js): without this a Hebrew request showed English text.
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    axios.get(`${API}/marketplace/pay/${encodeURIComponent(token)}`)
      .then(({ data: d }) => setData(d)).catch(() => setData(false));
  }, [token]);

  const lang = data?.lang || (String(i18n.language || '').startsWith('he') ? 'he' : 'en');
  useEffect(() => {
    if (!data) return;
    setLangReady(false);
    i18n.loadLanguages(lang).then(() => setLangReady(true), () => setLangReady(true));
  }, [data && data.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = i18n.getFixedT(lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const shell = (children) => (
    <main dir={dir} lang={lang} className="min-h-screen px-4 pt-32 pb-10" style={{ background: '#F9FAFB' }}>
      <div className="w-full max-w-md mx-auto rounded-2xl border bg-white p-6" style={{ borderColor: 'var(--brand-border)' }} data-testid="pay-page">{children}</div>
    </main>
  );
  if (data === null || (data && !langReady)) return shell(<div className="py-10 text-center"><Loader2 className="animate-spin inline" size={20} /></div>);
  if (data === false) return shell(<p className="text-center text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.invalid', 'This payment link is not valid. Ask the business to send it again.')}</p>);

  const biz = data.business;
  const name = (lang === 'he' && biz.name_he) || biz.name;
  const iPaid = async () => {
    setBusy(true);
    try {
      const { data: d } = await axios.post(`${API}/marketplace/pay/${encodeURIComponent(token)}/paid`);
      setData({ ...data, status: d.status });
    } catch { toast.error(t('payReq.failed', 'Something went wrong. Try again.')); } finally { setBusy(false); }
  };
  const copyAmount = async () => {
    try { await navigator.clipboard.writeText(String(data.amount)); toast.success(t('payReq.amountCopied', 'Amount copied')); } catch { /* the amount is on screen */ }
  };

  const head = (
    <div className="flex items-center gap-3 mb-5">
      {biz.logo_url && <img src={biz.logo_url} alt="" width="48" height="48" className="rounded-xl object-cover w-12 h-12" />}
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('payReq.from', 'Payment request from')}</p>
        <a href={`/business/${biz.slug}`} className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{name}</a>
      </div>
    </div>
  );
  const summary = (
    <div className="rounded-xl p-4 mb-5" style={{ background: '#F9FAFB' }}>
      {data.customer_first_name && <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>{t('payReq.hello', 'Hello {{name}},', { name: data.customer_first_name })}</p>}
      <p className="text-3xl font-bold" style={{ color: 'var(--ink)' }} data-testid="pay-amount"><bdi>{fmt(data.amount)}</bdi></p>
      <p className="text-sm mt-1" style={{ color: 'var(--ink)' }} dir="auto">{t('payReq.for', 'For:')} {data.description}</p>
    </div>
  );

  if (data.status === 'cancelled') {
    return shell(<>{head}<p className="text-sm" style={{ color: 'var(--ink)' }}>{t('payReq.cancelled', 'The business has withdrawn this request. There is nothing to pay.')}</p></>);
  }
  if (data.status === 'paid' || data.status === 'customer_paid') {
    return shell(
      <>
        {head}{summary}
        <p className="flex items-start gap-2 text-sm" style={{ color: '#2E7D4F' }} data-testid="pay-done">
          <Check size={18} className="shrink-0" />
          {data.status === 'paid'
            ? t('payReq.paid', 'Paid. Thank you.')
            : t('payReq.told', 'Thank you. We told {{name}} you paid; they will confirm once it comes in.', { name })}
        </p>
      </>,
    );
  }

  const links = biz.payment_links || [];
  return shell(
    <>
      {head}{summary}
      {links.length > 0 && (
        <>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('payReq.payWith', 'Pay with')}</p>
          <div className="grid gap-2 mb-2">
            {links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
                 className="inline-flex items-center justify-between gap-2 px-4 min-h-[48px] rounded-xl border text-sm font-semibold"
                 style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
                {l.label} <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
          <button type="button" onClick={copyAmount} className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
            <Copy size={13} /> {t('payReq.copyAmount', 'Copy the amount ({{amount}}) to paste in the payment app', { amount: fmt(data.amount) })}
          </button>
        </>
      )}
      {biz.payment_note && <p className="text-sm my-3" style={{ color: 'var(--ink)' }} dir="auto">{biz.payment_note}</p>}
      <div className="border-t pt-4 mt-3" style={{ borderColor: 'var(--brand-border)' }}>
        <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>{t('payReq.afterHint', 'Paid? Tell {{name}} so they can check it came in.', { name })}</p>
        <button type="button" onClick={iPaid} disabled={busy} data-testid="pay-i-paid"
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' }}>
          {busy && <Loader2 size={15} className="animate-spin" />} {t('payReq.iPaid', 'I have paid')}
        </button>
      </div>
      <p className="text-[12px] mt-4" style={{ color: 'var(--brand-muted)' }}>
        {t('payReq.safety', 'You pay {{name}} directly through the payment service. MyIsraelRental does not take or hold the money.', { name })}
      </p>
    </>,
  );
}
