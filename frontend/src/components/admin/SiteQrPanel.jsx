/**
 * Super Admin → a QR code for the site itself, for advertising it.
 *
 * Different from the owner/property codes in one way that matters: it is
 * per CAMPAIGN. A flyer in a makolet and a Facebook ad both point at the
 * front page, but they are different questions — "did the flyer work?" is
 * unanswerable if both share a counter. So each campaign label mints its
 * own code with its own scan count, while every code lands on the same
 * home page.
 *
 * Admin-only, enforced server-side: minting a `site` link checks the
 * caller's role, not just whether this panel rendered.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { QrCode, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import QrShareCard from '../common/QrShareCard';
import ScanChart from '../common/ScanChart';
import ShareLinkButtons from '../common/ShareLinkButtons';

// Lower-case, spaces to dashes. The label is a key, not prose: two
// campaigns called "Flyer" and "flyer" should be the same counter.
const slugifyCampaign = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export default function SiteQrPanel({ API, token }) {
  const { t } = useTranslation();
  const [links, setLinks] = useState([]);
  const [campaign, setCampaign] = useState('');
  const [busy, setBusy] = useState(false);

  const mint = useCallback(async (label) => {
    const id = slugifyCampaign(label) || 'home';
    setBusy(true);
    try {
      const { data } = await axios.post(
        `${API}/short-links`,
        { target_type: 'site', target_id: id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setLinks((prev) => (prev.some((l) => l.slug === data.slug)
        ? prev.map((l) => (l.slug === data.slug ? data : l))
        : [...prev, data]));
      return data;
    } catch {
      toast.error(t('siteQr.failed', 'Could not create that code'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [API, token, t]);

  // The default code exists from the first visit — nobody should have to
  // invent a campaign name just to get a QR for the front page.
  useEffect(() => { mint('home'); }, [mint]);

  const addCampaign = async (e) => {
    e.preventDefault();
    const id = slugifyCampaign(campaign);
    if (!id) return;
    const made = await mint(id);
    if (made) setCampaign('');
  };

  return (
    <div className="mb-10" data-testid="admin-site-qr">
      <div className="flex items-center gap-2 mb-1">
        <QrCode size={18} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
          {t('siteQr.title', 'QR codes for advertising the site')}
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('siteQr.body', 'Every code opens the home page. Give each advert its own code and you can see which one people actually scanned.')}
      </p>

      <form onSubmit={addCampaign} className="flex flex-wrap gap-2 mb-5">
        <input
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder={t('siteQr.placeholder', 'e.g. makolet flyer, bus stop, Facebook ad')}
          className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid="admin-site-qr-campaign"
        />
        <button
          type="submit"
          disabled={busy || !slugifyCampaign(campaign)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--brand-primary)' }}
          data-testid="admin-site-qr-add"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t('siteQr.add', 'Add a code')}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((l) => (
          <div
            key={l.slug}
            className="rounded-2xl border bg-white p-4"
            style={{ borderColor: 'var(--brand-border)' }}
            data-testid={`admin-site-qr-card-${l.target_id}`}
          >
            <p className="text-sm font-bold mb-3 text-center" style={{ color: 'var(--ink)' }}>
              {l.target_id === 'home'
                ? t('siteQr.defaultLabel', 'Main code')
                : l.target_id.replace(/-/g, ' ')}
            </p>
            <QrShareCard
              url={`${window.location.origin}${l.path}`}
              filename={`myisraelrental-${l.target_id}-qr`}
              testidPrefix={`site-qr-${l.target_id}`}
            />
            <p
              className="mt-2 text-center text-xs font-semibold"
              style={{ color: 'var(--brand-primary)' }}
              data-testid={`admin-site-qr-count-${l.target_id}`}
            >
              {l.scan_count === 0
                ? t('qr.scanned0', 'Not scanned yet')
                : l.scan_count === 1
                  ? t('qr.scanned1', 'Scanned once')
                  : t('qr.scannedN', 'Scanned {{n}} times', { n: l.scan_count })}
            </p>
            <div className="mt-3">
              <ScanChart daily={l.daily} testidPrefix={`site-qr-${l.target_id}`} />
            </div>
            <div className="mt-3">
              <ShareLinkButtons
                url={`${window.location.origin}${l.path}`}
                testidPrefix={`site-qr-${l.target_id}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
