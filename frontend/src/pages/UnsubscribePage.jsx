/**
 * /unsubscribe/:businessId/:e/:sig: stop a business's emails
 * (backend routes/marketplace/customer_messages.py). A button, not
 * automatic on opening: mail scanners open links, and an unsubscribe
 * nobody chose is a customer the business lost for nothing.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2, MailX, Check } from 'lucide-react';
import { API } from '../lib/apiBase';

export default function UnsubscribePage() {
  const { businessId, e, sig } = useParams();
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const url = `${API}/marketplace/messages/unsubscribe/${encodeURIComponent(businessId)}/${encodeURIComponent(e)}/${encodeURIComponent(sig)}`;

  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);
  useEffect(() => { axios.get(url).then(({ data }) => setD(data)).catch(() => setD(false)); }, [url]);

  const act = async (resubscribe) => {
    setBusy(true);
    try {
      const { data } = await axios.post(url, null, { params: resubscribe ? { resubscribe: true } : {} });
      setD((x) => ({ ...x, unsubscribed: data.unsubscribed }));
    } finally { setBusy(false); }
  };

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (d === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('messages.badLink', 'This link does not work')}</h1>
      </div>
    );
  }
  const name = (i18n.language?.startsWith('he') && d.business.name_he) || d.business.name;
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="unsubscribe-page">
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        {d.unsubscribed ? <Check size={30} className="inline mb-3" style={{ color: '#2E7D4F' }} /> : <MailX size={30} className="inline mb-3" style={{ color: 'var(--ink)' }} />}
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
          {d.unsubscribed ? t('messages.unsubDone', 'You will not get emails from {{name}} again', { name }) : t('messages.unsubAsk', 'Stop emails from {{name}}?', { name })}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>
          {d.unsubscribed ? t('messages.unsubDoneBody', 'Order confirmations and anything you ask for still reach you.') : t('messages.unsubAskBody', 'You will stop getting their news and offers by email.')}
        </p>
        {d.unsubscribed ? (
          <button type="button" disabled={busy} onClick={() => act(true)} className="text-sm underline" style={{ color: 'var(--ink)' }} data-testid="resubscribe">
            {t('messages.resubscribe', 'I changed my mind, keep me on the list')}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => act(false)} className="inline-flex items-center gap-2 px-6 min-h-[52px] rounded-full text-base font-semibold"
                  style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="unsubscribe-confirm">
            {busy && <Loader2 size={16} className="animate-spin" />} {t('messages.unsubButton', 'Unsubscribe')}
          </button>
        )}
      </main>
    </div>
  );
}
