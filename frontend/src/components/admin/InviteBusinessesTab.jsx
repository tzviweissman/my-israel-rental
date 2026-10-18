/**
 * Super Admin → Invite businesses (Tzvi, 14 Oct 2026: "give me a copy on my
 * super admin dashboard where i can easily send it to businesses that want to
 * join").
 *
 * A ready message in English or Hebrew, whatever language the dashboard is
 * in, with the business's name if you have it, sent by WhatsApp, email or
 * copy. Under it the two links the message carries: the joining rules
 * (/join-rules) and where a business starts (/why-list).
 *
 * The message says only what the site already promises (whyList.*): free to
 * list, a page of their own made from what they fill in, customers reach them
 * on WhatsApp or through the site, the jobs board. You can edit it before
 * sending; changing the name or language writes it afresh.
 *
 * Under it, the other half of the same job: HANDING OVER a page that was
 * built for a business that has not joined (18 Oct 2026). Most of the
 * businesses worth approaching will never fill in a form, so the page is
 * built here first and changes hands with a one-time link.
 *
 * The picker lists the ADMIN'S OWN businesses on purpose, because that is
 * exactly what a page built for a prospect is: created under this account,
 * waiting for its owner. The backend refuses to mint a link for anything
 * that has started trading, so a real business of your own cannot be given
 * away by a mis-click.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import axios from 'axios';
import { Send, Copy, Mail, ExternalLink, FileText, Store, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '../../App';
import ShareLinkButtons from '../common/ShareLinkButtons';

const WA_GREEN = '#25D366';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/** The invite in one language, from that language's strings whatever the dashboard shows. */
export function inviteMessage(lang, name, origin) {
  const t = i18n.getFixedT(lang);
  const greeting = name.trim()
    ? t('invite.greetingNamed', { name: name.trim() })
    : t('invite.greeting');
  return t('invite.message', {
    greeting,
    rulesLink: `${origin}/join-rules`,
    joinLink: `${origin}/why-list`,
    interpolation: { escapeValue: false },
  });
}

export default function InviteBusinessesTab({ token }) {
  const { t } = useTranslation();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://myisraelrental.com';
  const [name, setName] = useState('');
  const [lang, setLang] = useState(i18n.language && i18n.language.startsWith('he') ? 'he' : 'en');
  // Hebrew is fetched only when the site switches to it (i18n.js), so a message
  // in the other language waits for its strings rather than falling back to English.
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let live = true;
    i18n.loadLanguages(lang).then(() => { if (live) setLoaded(lang); });
    return () => { live = false; };
  }, [lang]);
  const fresh = useMemo(() => (loaded === lang ? inviteMessage(lang, name, origin) : ''), [loaded, lang, name, origin]);
  const [message, setMessage] = useState(fresh);
  useEffect(() => { setMessage(fresh); }, [fresh]);

  // --- handing a built page over -------------------------------------
  const [mine, setMine] = useState([]);
  const [pick, setPick] = useState('');
  const [minting, setMinting] = useState(false);
  // { url, name } once a link exists. One at a time: minting a second
  // link for the same business REPLACES the first, which is also how a
  // link sent to the wrong number is revoked.
  const [handover, setHandover] = useState(null);

  const loadMine = useCallback(() => {
    if (!token) return;
    axios.get(`${API}/marketplace/businesses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setMine(Array.isArray(data) ? data : (data?.businesses || [])))
      .catch(() => setMine([]));
  }, [token]);
  useEffect(() => { loadMine(); }, [loadMine]);

  const mint = async () => {
    setMinting(true);
    try {
      const biz = mine.find((b) => b.id === pick);
      const { data } = await axios.post(`${API}/marketplace/businesses/${pick}/claim-link`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      setHandover({ url: data.url, name: biz?.name || '', days: data.expires_in_days });
    } catch (err) {
      // The API names what it refused - "this business already has store
      // orders" - and that reason is the whole value of the message.
      toast.error(err?.response?.data?.detail || t('handover.failed', 'Could not make a link.'), { duration: 8000 });
    } finally { setMinting(false); }
  };

  const subject = i18n.getFixedT(lang)('invite.emailSubject');
  const copy = async () => {
    await copyText(message);
    toast.success(t('invite.copied', 'Message copied'));
  };

  const linkCard = (Icon, title, body, url, testid) => (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--brand-border)', background: '#fff' }} data-testid={testid}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</h4>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{body}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 mb-3 inline-flex items-center gap-1 text-xs font-medium break-all underline" style={{ color: 'var(--brand-primary)' }}>
        {url}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
      <ShareLinkButtons url={url} testidPrefix={testid} />
    </div>
  );

  return (
    <div className="max-w-3xl" data-testid="admin-invite">
      <div className="flex items-center gap-2 mb-1">
        <Send size={18} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('invite.title', 'Invite businesses')}</h3>
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--brand-muted)' }}>
        {t('invite.lede', 'A ready message for a business that wants to join, with the joining rules and where to start. Add their name, pick the language, and send.')}
      </p>

      <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: 'var(--brand-border)', background: '#fff' }}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px] text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {t('invite.nameLabel', 'Their name (optional)')}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('invite.namePh', 'e.g. Moshe')}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="invite-name"
            />
          </label>
          <div role="group" aria-label={t('invite.langLabel', 'Message language')} className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--brand-border)' }}>
            {[['he', 'עברית'], ['en', 'English']].map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className="px-4 py-2 text-sm font-semibold"
                style={lang === code ? { background: 'var(--brand-primary)', color: '#fff' } : { background: '#fff', color: 'var(--ink)' }}
                data-testid={`invite-lang-${code}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="block mt-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {t('invite.messageLabel', 'Message')}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            dir={lang === 'he' ? 'rtl' : 'ltr'}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm leading-relaxed"
            style={{ borderColor: 'var(--brand-border)' }}
            data-testid="invite-message"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: WA_GREEN }}
            data-testid="invite-whatsapp"
          >
            <Send size={14} aria-hidden="true" />
            {t('invite.sendWhatsApp', 'Send on WhatsApp')}
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: '#fff' }}
            data-testid="invite-email"
          >
            <Mail size={14} aria-hidden="true" />
            {t('invite.sendEmail', 'Email it')}
          </a>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: '#fff' }}
            data-testid="invite-copy"
          >
            <Copy size={14} aria-hidden="true" />
            {t('invite.copy', 'Copy message')}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {linkCard(FileText, t('invite.rulesTitle', 'Joining rules'), t('invite.rulesBody', 'What a business sends us and agrees to before it joins.'), `${origin}/join-rules`, 'invite-rules')}
        {linkCard(Store, t('invite.startTitle', 'Where they start'), t('invite.startBody', 'What they get, and the button to list their business.'), `${origin}/why-list`, 'invite-start')}
      </div>

      {/* The other half of the job: a page you already built, handed to
          the business it was built for. */}
      <div className="mt-8 rounded-xl border p-4 sm:p-5" style={{ borderColor: 'var(--brand-border)', background: '#fff' }} data-testid="admin-handover">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
          <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('handover.title', 'Hand a page over')}</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
          {t('handover.lede', 'For a business that will never fill in a form: build the page here, then send this link. They tap it, sign in once, and the page is theirs. The link works once and lasts 30 days.')}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px] text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {t('handover.pickLabel', 'Which page')}
            <select
              value={pick}
              onChange={(e) => { setPick(e.target.value); setHandover(null); }}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-white"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="handover-pick"
            >
              <option value="">{t('handover.pickNone', 'Choose a page you built…')}</option>
              {mine.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={mint}
            disabled={!pick || minting}
            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }}
            data-testid="handover-make"
          >
            {minting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {t('handover.make', 'Make the link')}
          </button>
        </div>

        {mine.length === 0 && (
          <p className="mt-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('handover.empty', 'No pages here yet. Build one the usual way first, then come back to hand it over.')}
          </p>
        )}

        {handover && (
          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--brand-border)', background: 'var(--bg)' }} data-testid="handover-link">
            <p className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('handover.ready', 'Send this to {{name}}. It works once.', { name: handover.name })}
            </p>
            <a href={handover.url} target="_blank" rel="noopener noreferrer"
               className="mt-1 mb-3 inline-flex items-center gap-1 text-xs font-medium break-all underline"
               style={{ color: 'var(--brand-primary)' }} dir="ltr">
              {handover.url}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
            <ShareLinkButtons url={handover.url} testidPrefix="handover" />
            <p className="mt-2 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {t('handover.replaceNote', 'Sent it to the wrong number? Make another link for the same page and the first one stops working.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
