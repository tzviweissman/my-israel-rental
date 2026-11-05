/**
 * The Advertising section (Tzvi, 5 Nov 2026): one place with the ads, the
 * personal link and its QR code. The same page for a business, a rental and
 * Super Admin, who advertises the site itself: `targets` is all that differs.
 * A target is { type, id, name, ...the record itself }.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import AdMaker from './AdMaker';
import QrShareCard from '../common/QrShareCard';
import ShareLinkButtons from '../common/ShareLinkButtons';

// A person's own businesses and rentals, as targets.
export function AdvertisingSection({ API, token, properties }) {
  const [businesses, setBusinesses] = useState(null);
  useEffect(() => {
    axios.get(`${API}/marketplace/businesses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setBusinesses(data)).catch(() => setBusinesses([]));
  }, [API, token]);
  if (!businesses) return null;
  const targets = [
    ...businesses.map((b) => ({ ...b, type: 'business', id: b.id, name: b.name })),
    ...(properties || []).map((p) => ({ ...p, type: 'property', name: p.title })),
  ];
  return <AdvertisingTab API={API} token={token} targets={targets} />;
}

export default function AdvertisingTab({ API, token, targets }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [link, setLink] = useState(null);
  const target = targets[Math.min(idx, targets.length - 1)];
  const type = target?.type;
  const id = target?.id;

  const load = useCallback(async () => {
    if (!id) return;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    setLink(await axios.post(`${API}/short-links`, { target_type: type, target_id: id }, auth).then((r) => r.data).catch(() => null));
  }, [API, token, type, id]);
  useEffect(() => { setLink(null); load(); }, [load]);

  if (!target) return null;
  const url = link ? `${window.location.origin}${link.path}` : '';
  const card = 'rounded-xl border bg-white p-4 sm:p-5';
  const border = { borderColor: 'var(--brand-border)' };
  const heading = { fontFamily: 'var(--font-head)', color: 'var(--ink)' };

  return (
    <div className="space-y-4" data-testid="advertising-tab">
      {targets.length > 1 && (
        <label className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('advertising.which', 'What are you advertising?')}
          <select className="mt-1 block w-full sm:w-80 rounded-lg border px-3 py-2 text-sm font-normal" value={idx}
            onChange={(e) => setIdx(Number(e.target.value))} data-testid="advertising-target">
            {targets.map((x, i) => <option key={`${x.type}-${x.id}`} value={i}>{x.name}</option>)}
          </select>
        </label>
      )}

      <section className={card} style={border} data-testid="advertising-ads">
        <h2 className="text-lg font-semibold mb-3" style={heading}>{t('advertising.adsTitle', 'Your ads')}</h2>
        <AdMaker key={`${type}-${id}`} inline API={API} token={token} targetType={type} target={target} />
      </section>

      <section className={card} style={border} data-testid="advertising-link">
        <h2 className="text-lg font-semibold mb-1" style={heading}>{t('advertising.linkTitle', 'Your link and QR code')}</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>
          {t('advertising.linkBody', 'Both go to the same place and stay the same forever, so they are safe to print.')}
        </p>
        {link ? (
          <div className="grid sm:grid-cols-2 gap-5 items-start">
            <div className="min-w-0 space-y-3">
              <p className="text-sm font-semibold break-all" dir="ltr" style={{ color: 'var(--ink)' }} data-testid="advertising-url">{url}</p>
              <ShareLinkButtons url={url} testidPrefix="advertising-share" />
              <p className="text-sm" style={{ color: 'var(--ink)' }} data-testid="advertising-visits">
                {t('advertising.visits', 'Visits so far: {{count}}', { count: link.scan_count || 0 })}
              </p>
            </div>
            <QrShareCard url={url} filename={`myisraelrental-${link.slug}-qr`} testidPrefix="advertising-qr" />
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('common.loading', 'Loading...')}</p>
        )}
      </section>

    </div>
  );
}
