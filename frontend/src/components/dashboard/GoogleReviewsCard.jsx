/**
 * "Connect Google reviews" (backend routes/reviews.py, utils/google_reviews.py).
 *
 * Renders nothing unless REVIEWS_GOOGLE_IMPORT_ENABLED is on. Once
 * connected, each Google location is matched to one of your listings or
 * businesses, and ALL of its reviews come in: there is no choosing which.
 * Disconnecting takes every imported review off your pages together.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Star } from 'lucide-react';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';

export default function GoogleReviewsCard({ API, token }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [places, setPlaces] = useState(null);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(false);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/reviews/google/status`, auth);
      setStatus(data);
      if (data.enabled && data.connected) {
        const { data: loc } = await axios.get(`${API}/reviews/google/locations`, auth);
        setPlaces(loc);
        setChoice(Object.fromEntries((loc.mappings || []).map((m) => [m.location,
          m.listing_kind ? `${m.listing_kind}:${m.listing_id}` : `business:${m.business_id}`])));
      }
    } catch {
      setStatus((s) => s || { enabled: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Coming back from Google's consent screen.
  useEffect(() => {
    const r = params.get('google_reviews');
    if (!r) return;
    if (r === 'connected') toast.success(t('googleReviews.connected', 'Google is connected. Now match each place to your listing.'));
    else if (r === 'failed') toast.error(t('googleReviews.failed', 'Google did not connect. Try again.'));
    params.delete('google_reviews');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status?.enabled) return null;

  const connect = async () => {
    setBusy(true);
    try {
      const { data } = await axios.get(`${API}/reviews/google/connect`, auth);
      window.location.assign(data.url);
    } catch {
      toast.error(t('googleReviews.notReady', 'Connecting Google is not available yet.'));
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const mappings = Object.entries(choice).filter(([, v]) => v).map(([location, v]) => {
        const loc = places.locations.find((l) => l.name === location) || {};
        const [target_kind, ...rest] = v.split(':');
        return { location, title: loc.title, maps_uri: loc.maps_uri, target_kind, target_id: rest.join(':') };
      });
      await axios.put(`${API}/reviews/google/mappings`, { mappings }, auth);
      toast.success(t('googleReviews.saved', 'Saved. Your Google reviews will appear within a few minutes.'));
    } catch {
      toast.error(t('googleReviews.saveFailed', 'That did not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(t('googleReviews.confirmDisconnect', 'Disconnect Google? Every imported Google review comes off your pages.'))) return;
    setBusy(true);
    try {
      await axios.delete(`${API}/reviews/google/connection`, auth);
      setPlaces(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: BORDER }} data-testid="google-reviews-card">
      <h2 className="inline-flex items-center gap-2 text-lg font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
        <Star size={18} className="fill-[var(--gold)] text-[var(--gold)]" aria-hidden="true" />
        {t('googleReviews.title', 'Your Google reviews')}
      </h2>
      {!status.connected ? (
        <>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            {t('googleReviews.pitch', 'Show the reviews from your Google Business Profile on your pages here. All of them come in, good and bad, marked "From Google".')}
          </p>
          <button type="button" onClick={connect} disabled={busy} className="mt-3 min-h-[44px] px-5 rounded-full text-sm font-bold inline-flex items-center gap-2"
            style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="google-reviews-connect">
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {t('googleReviews.connect', 'Connect Google reviews')}
          </button>
        </>
      ) : !places ? (
        <p className="mt-2 text-sm" style={{ color: MUTED }}><Loader2 size={14} className="animate-spin inline" /> {t('googleReviews.loading', 'Looking up your Google places...')}</p>
      ) : (
        <>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>{t('googleReviews.match', 'Match each Google place to the page its reviews belong on.')}</p>
          {places.locations.length === 0 && <p className="mt-2 text-sm" style={{ color: 'var(--ink)' }}>{t('googleReviews.none', 'This Google account manages no business places.')}</p>}
          <ul className="mt-3 space-y-3">
            {places.locations.map((l) => (
              <li key={l.name} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="sm:w-1/2 text-sm" style={{ color: 'var(--ink)' }} dir="auto">
                  <strong>{l.title}</strong>{l.address ? <span style={{ color: MUTED }}> · {l.address}</span> : null}
                </span>
                <select value={choice[l.name] || ''} onChange={(e) => setChoice((c) => ({ ...c, [l.name]: e.target.value }))}
                  aria-label={t('googleReviews.showOn', { place: l.title, defaultValue: 'Show reviews of {{place}} on' })}
                  className="sm:w-1/2 min-h-[44px] px-2 rounded-lg border bg-white text-sm" style={{ borderColor: BORDER }}>
                  <option value="">{t('googleReviews.dontShow', "Don't show")}</option>
                  {places.targets.map((x) => (
                    <option key={`${x.kind}:${x.id}`} value={`${x.kind}:${x.id}`}>
                      {x.kind === 'business' ? t('googleReviews.kindBusiness', 'Business page') : x.kind === 'property' ? t('googleReviews.kindProperty', 'Rental') : t('googleReviews.kindService', 'Service')}: {x.title}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={save} disabled={busy} className="min-h-[44px] px-5 rounded-full text-sm font-bold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="google-reviews-save">{t('googleReviews.save', 'Save')}</button>
            <button type="button" onClick={disconnect} disabled={busy} className="min-h-[44px] px-2 text-sm font-semibold underline" style={{ color: MUTED }}
              data-testid="google-reviews-disconnect">{t('googleReviews.disconnect', 'Disconnect Google')}</button>
          </div>
          {status.last_error && <p className="mt-2 text-xs" style={{ color: 'var(--ink)' }}>{t('googleReviews.syncError', 'The last update from Google did not work. We will try again tomorrow.')}</p>}
        </>
      )}
    </section>
  );
}
