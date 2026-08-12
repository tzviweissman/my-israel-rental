/**
 * RequestsBoard — the demand board at /requests.
 *
 * The inverse of /stays and /services: seekers post what they are looking
 * for, and owners/providers browse it. Structure cloned from JobsBoard —
 * URL-driven filters via useSearchParams so a filtered board is a
 * shareable link and the back button behaves.
 *
 * Public: anyone can read the board. Posting and contacting require an
 * account, which is what stops it being scraped for leads.
 *
 * Cards carry a poster block — shortened name, verified badge,
 * member-since — because identity drives response rate: an owner is far
 * likelier to answer a named, verified human than an anonymous card.
 *
 * That is IDENTITY, not contact. No phone, no email, no full surname, no
 * avatar, and no route to the person outside the existing chat flow. The
 * mockup's avatar is deliberately not rendered: the only photo on a user
 * is their Google `picture`, which today appears solely in the
 * self-facing "Continue as" banner and is therefore not an already-public
 * avatar. See `_poster_identity` in routes/marketplace/requests.py.
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Home, Wrench, LayoutGrid, MapPin, Coins, BedDouble, CalendarDays, ShieldCheck,
  Clock, MessageCircle, Loader2, Search, Plus,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import HeroBand from '../components/common/HeroBand';
import ListingsUnavailable from '../components/common/ListingsUnavailable';
import SITE_ASSETS from '../lib/siteAssets';

const BAND_IMAGE = SITE_ASSETS['scene8-requests-man'];

const TYPES = [
  { key: '', labelKey: 'requests.typeAll', fallback: 'All', Icon: LayoutGrid },
  { key: 'rental', labelKey: 'requests.typeRental', fallback: 'Rentals', Icon: Home },
  { key: 'service', labelKey: 'requests.typeService', fallback: 'Services', Icon: Wrench },
];

/** Days until an ISO timestamp, floored at 0. Null when unparseable. */
const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso) - new Date();
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86400000));
};

const money = (amount, currency) => {
  if (!amount) return null;
  const sym = currency === 'USD' ? '$' : '₪';
  return `${sym}${Number(amount).toLocaleString()}`;
};

export const RequestCard = ({ request: r, onOpen, t }) => {
  const isRental = r.request_type === 'rental';
  const expiresIn = daysUntil(r.expires_at);
  const budget = money(r.budget_amount, r.budget_currency);

  return (
    <article
      className="rcard"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}
      data-testid={`request-card-${r.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rc-badge ${isRental ? 'rc-badge-rental' : 'rc-badge-service'}`}>
          {isRental ? <Home size={11} aria-hidden="true" /> : <Wrench size={11} aria-hidden="true" />}
          {isRental ? t('requests.rental', 'Rental') : t('requests.service', 'Service')}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {isRental ? (r.rental_kind || '') : (r.category || '').replace(/-/g, ' ')}
        </span>
      </div>

      <h3 className="truncate">{r.title}</h3>

      <div className="rc-chips">
        {r.area && (
          <span className="rc-chip rc-chip-key">
            <MapPin size={12} aria-hidden="true" />{r.area}
          </span>
        )}
        {isRental && r.bedrooms_min > 0 && (
          <span className="rc-chip">
            <BedDouble size={12} aria-hidden="true" />
            {t('requests.bedroomsMin', '{{n}}+ bd', { n: r.bedrooms_min })}
          </span>
        )}
        {budget && (
          <span className="rc-chip rc-chip-key">
            <Coins size={12} aria-hidden="true" />
            {t('requests.upTo', 'up to {{amount}}', { amount: budget })}
          </span>
        )}
        {(r.move_in_date || r.preferred_date) && (
          <span className="rc-chip">
            <CalendarDays size={12} aria-hidden="true" />
            {r.move_in_date || r.preferred_date}
          </span>
        )}
      </div>

      {r.description && <p className="rc-note">{r.description}</p>}

      {/* Who is asking. Identity, not contact — a shortened name, a
          verified badge and a joined year, all derived server-side. It is
          load-bearing for response rate: an owner is far likelier to
          answer a named, verified human than an anonymous card. There is
          no avatar and no way to reach them from here; chat is the only
          channel. */}
      {r.poster_display_name && (
        <div className="rc-poster" data-testid={`request-poster-${r.id}`}>
          <span className="rc-poster-name">{r.poster_display_name}</span>
          {r.poster_verified && (
            <span className="rc-verified" title={t('requests.verifiedHint', 'Email verified')}>
              <ShieldCheck size={11} aria-hidden="true" />
              {t('requests.verified', 'Verified')}
            </span>
          )}
          {r.poster_member_since && (
            <span className="rc-poster-since">
              {t('requests.memberSince', 'Member since {{year}}', { year: r.poster_member_since })}
            </span>
          )}
        </div>
      )}

      <div className="rc-foot">
        <span className="rc-status">
          <span className="dot" aria-hidden="true" />
          {t('requests.open', 'Open')}
          {expiresIn != null && (
            <>
              <span aria-hidden="true">·</span>
              <Clock size={12} aria-hidden="true" />
              {t('requests.expiresIn', 'expires in {{n}} days', { n: expiresIn })}
            </>
          )}
        </span>
        <span className="btn-blue-solid inline-flex items-center gap-1.5 !py-2 !px-4 !text-[13px]">
          <MessageCircle size={13} aria-hidden="true" />
          {t('requests.messageSeeker', 'Message seeker')}
        </span>
      </div>
    </article>
  );
};

const RequestsBoard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Kept separate from "no results", the same lesson as /stays: a failed
  // fetch and an empty board need different advice.
  const [loadError, setLoadError] = useState(false);
  const [qDraft, setQDraft] = useState(searchParams.get('q') || '');

  const type = searchParams.get('type') || '';
  const area = searchParams.get('area') || '';
  const q = searchParams.get('q') || '';

  const patchUrl = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        if (v) next.set(k, v); else next.delete(k);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (type) params.request_type = type;
    if (area) params.area = area;
    if (q) params.q = q;
    axios.get(`${API}/marketplace/requests`, { params })
      .then((r) => { setRequests(r.data || []); setLoadError(false); })
      .catch(() => { setRequests([]); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [type, area, q]);

  const openRequest = (id) => navigate(`/requests/${id}`);

  const postHref = useMemo(
    // Signed-out visitors get sent to join, then back here. The board is
    // readable without an account; posting is not.
    () => (user ? '/requests/post' : `/join?redirect=${encodeURIComponent('/requests/post')}`),
    [user],
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="requests-board-page">
      <PageMeta
        title="Housing & services requests | MyIsraelRental"
        description="See what renters and homeowners across Israel are looking for right now — and answer the ones you can help with. Free to post, free to browse."
        path="/requests"
      />

      <HeroBand
        image={BAND_IMAGE}
        title={t('requests.heroTitle', "Tell owners what you're")}
        accent={t('requests.heroAccent', 'looking for.')}
        lede={t(
          'requests.heroLede',
          'Post one structured request and let owners, managers and pros come to you — instead of losing your search in a hundred WhatsApp groups.',
        )}
        headlineTestId="requests-hero-title"
        testId="requests-band"
      />

      <div className="hero-panel-float">
        <div className="hero-panel">
          {/* Segmented type filter — the board's primary cut. */}
          <div className="flex justify-center mb-3">
            <div className="wh-tabs" role="tablist" aria-label={t('requests.filterByType', 'Filter requests by type')}>
              {TYPES.map(({ key, labelKey, fallback, Icon }) => (
                <button
                  key={key || 'all'}
                  type="button"
                  role="tab"
                  className="wh-tab inline-flex items-center gap-1.5"
                  aria-selected={type === key}
                  onClick={() => patchUrl({ type: key })}
                  data-testid={`requests-type-${key || 'all'}`}
                >
                  <Icon size={13} aria-hidden="true" />
                  {t(labelKey, fallback)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white border rounded-full px-4 py-2.5"
                 style={{ borderColor: 'var(--brand-border)' }}>
              <Search size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') patchUrl({ q: qDraft.trim() }); }}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder={t('requests.searchPlaceholder', 'Search demand — e.g. "3BR Ramat Eshkol", "mover Jerusalem"')}
                aria-label={t('requests.searchLabel', 'Search requests')}
                data-testid="requests-search-input"
              />
            </div>
            <button
              type="button"
              onClick={() => patchUrl({ q: qDraft.trim() })}
              className="btn-blue-solid !py-2.5 !px-5 !text-sm"
              data-testid="requests-search-btn"
            >
              {t('requests.search', 'Search')}
            </button>
            <button
              type="button"
              onClick={() => navigate(postHref)}
              className="btn-gold-solid !py-2.5 !px-5 !text-sm inline-flex items-center gap-1.5"
              data-testid="requests-post-cta"
            >
              <Plus size={14} aria-hidden="true" />
              {t('requests.postCta', 'Post a request')}
            </button>
          </div>
        </div>
      </div>

      <section className="max-w-6xl mx-auto px-4 pt-11 pb-20">
        <div className="section-rhead flex items-baseline justify-between gap-4 mb-5">
          <h2 className="text-gray-900">
            {loading
              ? t('requests.loading', 'Loading requests…')
              : t('requests.count', '{{n}} open requests', { n: requests.length })}
          </h2>
          {(area || q || type) && (
            <button
              type="button"
              onClick={() => { setQDraft(''); setSearchParams(new URLSearchParams(), { replace: true }); }}
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
              data-testid="requests-clear"
            >
              {t('requests.clearAll', 'Clear filters')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin" size={28} style={{ color: 'var(--brand-primary)' }} />
          </div>
        ) : loadError ? (
          <ListingsUnavailable onRetry={() => window.location.reload()} />
        ) : requests.length === 0 ? (
          <div className="text-center py-16" data-testid="requests-empty">
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
              {t('requests.emptyTitle', 'No open requests here yet')}
            </p>
            <p className="text-sm mt-2 mb-6" style={{ color: 'var(--brand-muted)' }}>
              {t('requests.emptyBody', 'Be the first — post what you are looking for and let owners and pros come to you.')}
            </p>
            <button type="button" onClick={() => navigate(postHref)} className="btn-blue-solid" data-testid="requests-empty-cta">
              {t('requests.postCta', 'Post a request')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="requests-grid">
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} onOpen={openRequest} t={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default RequestsBoard;
