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

export default function MessagePreview({ loaded, templates, note }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language?.startsWith('he');
  const [who, setWho] = useState('customer');
  const [how, setHow] = useState('text');
  const biz = (he && loaded.business_name_he) || loaded.business_name || t('orderTexts.pv.yourBusiness', 'Your business');
  const product = loaded.sample_product;
  const item = product?.name || t('orderTexts.pv.item', 'Family box');
  const lang = he ? 'he' : 'en';
  const words = ((templates.order_confirmed || {})[lang] ?? loaded.text_defaults?.order_confirmed?.[lang] ?? '')
    .split('{order}').join('#1042').split('{business}').join(biz).split('{customer}').join(he ? 'דנה' : 'Dana').trim();
  const line = (note || '').trim();
  const customerText = `${words} myisraelrental.com/orders/track/a1B2c3`;
  const ownerText = he
    ? `הזמנה חדשה #1042 מדנה, 050-123-4567\n1x ${item}\nמשלוח לרחוב הרצל 5 · מחר 12:00\nאישור או דחייה: myisraelrental.com/orders/owner/…`
    : `New order #1042 from Dana, 050-123-4567\n1x ${item}\nDelivery to 5 Herzl St, tomorrow 12:00\nConfirm or decline: myisraelrental.com/orders/owner/…`;

  const Tab = ({ value, current, set, children, id }) => (
    <button type="button" onClick={() => set(value)} aria-pressed={current === value} data-testid={id}
            className="px-3 min-h-[36px] rounded-full text-[13px] font-semibold"
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
      ? (he ? `ההזמנה שלך #1042 מ${biz} אושרה` : `Your order #1042 from ${biz} is confirmed`)
      : (he ? 'הזמנה חדשה #1042 מדנה' : 'New order #1042 from Dana');
    body = (
      <div className="p-3 min-h-[220px] text-[13px]" style={{ background: '#fff', color: '#111' }} dir={he ? 'rtl' : 'ltr'}>
        <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>{who === 'customer' ? `${biz} · myisraelrental` : 'myisraelrental'}</p>
        <p className="font-bold mb-2">{subject}</p>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--brand-border)' }}>
          {loaded.logo_url && <img src={loaded.logo_url} alt="" className="h-10 w-10 rounded-full object-cover mb-2" />}
          <p className="whitespace-pre-line">{who === 'customer' ? words : ownerText.split('\n').slice(0, 3).join('\n')}</p>
          {who === 'customer' && line && <p className="mt-2 font-semibold">{line}</p>}
          <span className="inline-block mt-3 rounded-full px-4 py-2 text-[12px] font-semibold text-white" style={{ background: '#000' }}>
            {who === 'customer' ? t('orderTexts.pv.track', 'Track your order') : t('orderTexts.pv.decide', 'Confirm or decline')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="message-preview">
      <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('orderTexts.pv.title', 'See what gets sent')}</h4>
      <p className="text-[12px] mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>{t('orderTexts.pv.hint', 'A sample order, with your words and your own line. It changes as you type.')}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orderTexts.pv.who', 'Who gets it')}>
          <Tab value="customer" current={who} set={setWho} id="pv-who-customer">{t('orderTexts.pv.customer', 'Your customer')}</Tab>
          <Tab value="owner" current={who} set={setWho} id="pv-who-owner">{t('orderTexts.pv.you', 'You')}</Tab>
        </div>
        <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--brand-border)' }} role="group" aria-label={t('orderTexts.pv.how', 'How it arrives')}>
          <Tab value="text" current={how} set={setHow} id="pv-how-text">{t('orderTexts.pv.text', 'Text')}</Tab>
          {WHATSAPP_LIVE && <Tab value="whatsapp" current={how} set={setHow} id="pv-how-whatsapp">WhatsApp</Tab>}
          <Tab value="email" current={how} set={setHow} id="pv-how-email">{t('orderTexts.pv.email', 'Email')}</Tab>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[300px] rounded-[28px] border-[6px] overflow-hidden shadow-md" style={{ borderColor: '#111' }} data-testid="pv-phone">
        {body}
      </div>
    </div>
  );
}
