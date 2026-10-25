/**
 * Customers → Leads: the automatic "we got your message" reply (backend
 * routes/marketplace/away_reply.py). Off until the owner switches it on;
 * their own words, or ours in the customer's language.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageSquareReply } from 'lucide-react';

export default function AwayReplyCard({ API, auth, businessId }) {
  const { t } = useTranslation();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setS(null);
    axios.get(`${API}/marketplace/businesses/${businessId}/away-reply`, auth)
      .then(({ data }) => setS(data)).catch(() => setS(false));
  }, [API, auth, businessId]);
  if (!s) return null;

  const save = async (next) => {
    setBusy(true);
    try {
      const { data } = await axios.put(`${API}/marketplace/businesses/${businessId}/away-reply`, { on: next.on, text: next.text }, auth);
      setS({ ...next, ...data });
      toast.success(data.on ? t('awayReply.savedOn', 'Automatic reply is on') : t('awayReply.savedOff', 'Automatic reply is off'));
    } catch {
      toast.error(t('awayReply.failed', 'That did not save. Try again.'));
    }
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border p-4 mb-4" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #F9FAFB)' }}
             data-testid="away-reply-card" data-tour="away-reply">
      <div className="flex gap-3 items-start">
        <MessageSquareReply size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('awayReply.title', 'Automatic reply when you are busy')}</span>
            <input type="checkbox" role="switch" checked={!!s.on} disabled={busy} onChange={(e) => save({ ...s, on: e.target.checked })}
                   className="w-5 h-5 shrink-0" style={{ accentColor: 'var(--gold)' }} data-testid="away-reply-on" />
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>
            {t('awayReply.body', 'When a customer messages you here and you have not answered within {{count}} minutes, they get one friendly reply in your name, so they wait for you instead of asking someone else. Once a day per customer. Messages on WhatsApp are not included.', { count: s.minutes || 10 })}
          </p>
          {s.on && (
            <>
              <textarea value={s.text} onChange={(e) => setS({ ...s, text: e.target.value })} maxLength={500} rows={2} dir="auto"
                        aria-label={t('awayReply.ownLabel', 'Your own words (optional)')}
                        placeholder={t('awayReply.placeholder', "Thanks for your message. We've got it and will get back to you as soon as we can.")}
                        className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: 'var(--brand-border)' }} data-testid="away-reply-text" />
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button type="button" onClick={() => save(s)} disabled={busy}
                        className="min-h-[44px] px-4 rounded-full text-sm font-bold disabled:opacity-50"
                        style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="away-reply-save">
                  {t('awayReply.save', 'Save')}
                </button>
                <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {s.text.trim() ? t('awayReply.ownNote', 'Sent as you wrote it.') : t('awayReply.defaultNote', 'Left empty, customers get the words above in their own language.')}
                  {s.sent ? ` ${t('awayReply.sent', { count: s.sent, defaultValue: 'Sent {{count}} times so far.' })}` : ''}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
