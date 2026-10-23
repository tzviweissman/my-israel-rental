/**
 * "Tell me when it's back" under a sold-out product on the order form
 * (backend restock.py). One tap opens an email box (pre-filled with the
 * email already typed on the form); one email is sent when it returns.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Bell, Check, Loader2 } from 'lucide-react';
import { API } from '../../lib/apiBase';

export default function RestockNotify({ gigId, productId, initialEmail = '' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState('');   // '', 'busy', 'done'
  const [error, setError] = useState('');
  const send = async () => {
    setError('');
    setState('busy');
    try {
      await axios.post(`${API}/marketplace/order-form/${gigId}/notify-when-back`, {
        product_id: productId, email: email.trim(), lang: i18n.language?.startsWith('he') ? 'he' : 'en',
      });
      setState('done');
    } catch (err) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : t('restock.badEmail', 'Please check the email address'));
      setState('');
    }
  };
  if (state === 'done') {
    return <p className="text-xs inline-flex items-center gap-1 mt-1" style={{ color: '#1F5F3A' }} role="status" data-testid={`restock-done-${productId}`}><Check size={13} /> {t('restock.done', 'We will email you once when it is back.')}</p>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold underline min-h-[44px]" style={{ color: 'var(--ink)' }} data-testid={`restock-open-${productId}`}>
        <Bell size={13} aria-hidden="true" /> {t('restock.ask', "Tell me when it's back")}
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus
             className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
             aria-label={t('restock.emailLabel', 'Your email')} data-testid={`restock-email-${productId}`} />
      <button type="button" disabled={state === 'busy' || !email.includes('@')} onClick={send}
              className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold border disabled:opacity-50"
              style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid={`restock-send-${productId}`}>
        {state === 'busy' && <Loader2 size={13} className="animate-spin" />} {t('restock.send', 'Email me')}
      </button>
      {error && <p className="w-full text-xs" role="alert" style={{ color: '#B42318' }}>{error}</p>}
    </div>
  );
}
