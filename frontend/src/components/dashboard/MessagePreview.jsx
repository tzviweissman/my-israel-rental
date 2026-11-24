/**
 * What the messages look like on a phone (Tzvi, 19 Nov 2026: "show businesses a preview ... so they see what it
 * looks like for them and their customers and how it will look if they add their own line"). Who (the business or
 * its customer) and how (text, WhatsApp, email), drawn with the business's own name, logo, words, own line and one
 * of its real product photos. Wording follows the server: order_texts.owner_text / compose, order_emails subjects.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const WA_GREEN = '#075E54';
// Off until Meta verifies the business and approves our display name: until then Meta refuses every WhatsApp we
// send, and texts and emails carry the alerts (Tzvi, 19 Nov 2026: "remove whatsapp from business dashboards").
const WHATSAPP_LIVE = false;

// Which customer messages also go by email, which carry no link, and which carry the business's own line
// (order_emails.py, order_texts.py: NO_LINK, _note). The preview shows the message being edited (Tzvi, 23 Nov 2026).
const EMAIL_TOO = new Set(['order_received', 'order_confirmed', 'order_declined', 'booking_confirmed', 'booking_declined']);
const NO_LINK = new Set(['order_declined', 'auto_reply']);
const WITH_LINE = new Set(['order_confirmed', 'booking_confirmed', 'reminder']);

// White words on the colour, or ink when white would not read (4.5:1): the same choice as order_emails.email_brand.
export function inkOn(hex) {
  const lin = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return 1.05 / (lum + 0.05) >= 4.5 ? '#FFFFFF' : '#111827';
}

export default function MessagePreview({ loaded, templates, note, msgKey = 'order_confirmed', lang: langIn, fixedWho, look, initialHow = 'text' }) {
  const { t, i18n } = useTranslation();
  const he = langIn ? langIn === 'he' : i18n.language?.startsWith('he');
  const [whoPicked, setWho] = useState('customer');
  const who = fixedWho || whoPicked;
  const [howPicked, setHow] = useState(initialHow);
  const emailToo = who === 'owner' || EMAIL_TOO.has(msgKey);
  const how = howPicked === 'email' && !emailToo ? 'text' : howPicked;
  const biz = (he && loaded.business_name_he) || loaded.business_name || t('orderTexts.pv.yourBusiness', 'Your business');
  const product = loaded.sample_product;
  const item = product?.name || t('orderTexts.pv.item', 'Family box');
  const lang = he ? 'he' : 'en';
  const sample = { order: '#1042', business: biz, customer: he ? 'דנה' : 'Dana', service: he ? 'תספורת' : 'Haircut', when: he ? 'מחר' : 'tomorrow', time: '14:00' };
  let words = (templates[msgKey] || {})[lang] ?? loaded.text_defaults?.[msgKey]?.[lang] ?? '';
  Object.entries(sample).forEach(([p, v]) => { words = words.split(`{${p}}`).join(v); });
  words = words.replace(/[ \t]{2,}/g, ' ').trim();
  const line = WITH_LINE.has(msgKey) ? (note || '').trim() : '';
  const customerText = NO_LINK.has(msgKey) ? words : `${words} myisraelrental.com/orders/track/a1B2c3`;
  const ownerText = he
    ? `הזמנה חדשה #1042 מדנה, 050-123-4567\n1x ${item}\nמשלוח לרחוב הרצל 5 · מחר 12:00\nאישור או דחייה: myisraelrental.com/orders/owner/…`
    : `New order #1042 from Dana, 050-123-4567\n1x ${item}\nDelivery to 5 Herzl St, tomorrow 12:00\nConfirm or decline: myisraelrental.com/orders/owner/…`;

  const Tab = ({ value, current, set, children, id }) => (
    <button type="button" onClick={() => set(value)} aria-pressed={current === value} data-testid={id}
            className="px-3 min-h-[44px] rounded-full text-[13px] font-semibold"
            style={current === value ? { background: 'var(--ink)', color: '#fff' } : { color: 'var(--ink)' }}>{children}</button>
  );
  const Photo = () => (product?.image || loaded.logo_url) ? (
    <img src={product?.image || loaded.logo_url} alt="" className="w-full aspect-[4/3] object-cover rounded-md mb-1.5" />
  ) : null;

  let body;
  if (how === 'text') {
    body = (
      <div className="p-3 min-h-[220px]" style={{ background: '#fff' }}>
        <p className="text-center text-[11px] font-semibold mb-2" style={{ color: 'var(--brand-muted)' }}>myisraelrental</p>
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-[13px] whitespace-pre-line break-words" style={{ background: '#E9E9EB', color: '#111' }} dir="auto">
          {who === 'customer' ? <>{customerText}{line && <><br /><b>{line}</b></>}</> : ownerText}
        </div>
      </div>
    );
  } else if (how === 'whatsapp') {
    body = (
      <div className="min-h-[220px]" style={{ background: '#ECE5DD' }}>
        <div className="px-3 py-2 text-[13px] font-semibold text-white" style={{ background: WA_GREEN }}>myisraelrental</div>
        <div className="p-2.5">
          <div className="max-w-[88%] rounded-lg p-1.5 text-[13px] whitespace-pre-line break-words shadow-sm" style={{ background: '#fff', color: '#111' }} dir="auto">
            {who === 'owner' && <Photo />}
            <div className="px-1">{who === 'customer' ? customerText : ownerText.split('\n').slice(0, 3).join('\n')}</div>
          </div>
          {who === 'owner' && (
            <div className="max-w-[88%] grid grid-cols-2 gap-1 mt-1">
              {[t('orderTexts.pv.confirm', 'Confirm'), t('orderTexts.pv.decline', 'Decline')].map((b) => (
                <span key={b} className="rounded-lg py-1.5 text-center text-[13px] font-semibold shadow-sm" style={{ background: '#fff', color: '#027EB5' }}>{b}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  } else {
    const subject = who === 'customer'
      ? ({
        order_confirmed: he ? `ההזמנה שלך #1042 מ${biz} אושרה` : `Your order #1042 from ${biz} is confirmed`,
        booking_confirmed: he ? `התור שלך אצל ${biz} אושר` : `Your booking with ${biz} is confirmed`,
        booking_declined: he ? `התור שלך אצל ${biz}` : `Your booking with ${biz}`,
      }[msgKey] || (he ? `ההזמנה שלך #1042 מ${biz}` : `Your order #1042 from ${biz}`))
      : (he ? 'הזמנה חדשה #1042 מדנה' : 'New order #1042 from Dana');
    // The email's real head (utils/email.py _wrap): ours, or on a customer's email the business's own look when
    // turned on (order_emails.email_brand). Sizes are the email's, at the preview's scale (about half).
    const own = who === 'customer' && look?.on ? look : null;
    const ink = own ? inkOn(own.accent) : '#fff';
    body = (
      <div className="min-h-[220px] text-[13px]" style={{ background: '#fff', color: '#111' }} dir={he ? 'rtl' : 'ltr'}>
        <div className="px-3 pt-2 pb-1">
          <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>{who === 'customer' ? `${biz} · myisraelrental` : 'myisraelrental'}</p>
          <p className="font-bold">{subject}</p>
        </div>
        <div className="mx-2 mb-2 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--brand-border)' }} data-testid="pv-email">
          <div className="px-3 py-2.5" style={{ background: own ? own.accent : '#1E6A6A' }} data-testid="pv-email-head">
            {own ? (
              <>
                {loaded.logo_url && own.logo !== 'none' && (
                  <img src={loaded.logo_url} alt="" className="rounded mb-1 w-auto" style={{ height: { small: 20, medium: 32, large: 48 }[own.logo] || 32 }} />
                )}
                <p className="font-bold text-[13px]" style={{ color: ink }}>{biz}</p>
                <p className="text-[9px]" style={{ color: ink, opacity: 0.75 }}>{he ? 'דרך myisraelrental' : 'via myisraelrental'}</p>
              </>
            ) : (
              <>
                <p className="font-bold text-[13px] text-white">My Israel Rental</p>
                <p className="text-[8px] uppercase tracking-widest" style={{ color: '#D4AF37' }}>{he ? 'הבית שלכם בישראל' : 'Your home in Israel'}</p>
              </>
            )}
          </div>
          <div className="p-3">
            <p className="whitespace-pre-line">{who === 'customer' ? words : ownerText.split('\n').slice(0, 3).join('\n')}</p>
            {who === 'customer' && line && <p className="mt-2 font-semibold">{line}</p>}
            {!(who === 'customer' && NO_LINK.has(msgKey)) && (
              <span className="inline-block mt-3 rounded-lg px-4 py-2 text-[12px] font-semibold" style={{ background: own ? own.accent : '#1E6A6A', color: ink }}>
                {who === 'customer' ? t('orderTexts.pv.track', 'Track your order') : t('orderTexts.pv.decide', 'Confirm or decline')}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="message-preview">
      <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.pv.title', 'See what gets sent')}</h4>
      <p className="text-[12px] mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>{t('orderTexts.pv.hint', 'A sample order, with your words and your own line. It changes as you type.')}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {!fixedWho && (
          <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orderTexts.pv.who', 'Who gets it')}>
            <Tab value="customer" current={who} set={setWho} id="pv-who-customer">{t('orderTexts.pv.customer', 'Your customer')}</Tab>
            <Tab value="owner" current={who} set={setWho} id="pv-who-owner">{t('orderTexts.pv.you', 'You')}</Tab>
          </div>
        )}
        <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orderTexts.pv.how', 'How it arrives')}>
          <Tab value="text" current={how} set={setHow} id="pv-how-text">{t('orderTexts.pv.text', 'Text')}</Tab>
          {WHATSAPP_LIVE && <Tab value="whatsapp" current={how} set={setHow} id="pv-how-whatsapp">WhatsApp</Tab>}
          {emailToo && <Tab value="email" current={how} set={setHow} id="pv-how-email">{t('orderTexts.pv.email', 'Email')}</Tab>}
        </div>
      </div>
      {who === 'customer' && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--ink)' }} data-testid="pv-which">{t(`orderTexts.tpl.${msgKey}`, msgKey)}</p>}
      <div className="mx-auto w-full max-w-[300px] max-h-[32vh] lg:max-h-none overflow-y-auto rounded-[28px] border-[6px] shadow-md" style={{ borderColor: '#111' }} data-testid="pv-phone">
        {body}
      </div>
    </div>
  );
}
