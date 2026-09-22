/**
 * NetworkTab — a business's connections with other businesses
 * (docs/business-network-spec.md, Phase 1).
 *
 * Three views: Partners (accepted), Requests (waiting on me, and ones I
 * sent), Find partners. The last one does not rebuild a directory: the
 * site already has one (/businesses), and every business page there now
 * carries a Connect button. Phase 4 adds side-by-side comparison to it.
 *
 * Acts as ONE business at a time, chosen the way the Orders tab chooses
 * (and remembered separately, so switching one does not switch the other).
 * A person who runs a bakery and a moving company has two networks.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Inbox, Search, MessageCircle, Check, X, Star, BadgeCheck, Store, Zap } from 'lucide-react';
import AutomationsPanel from './AutomationsPanel';

const VIEWS = ['partners', 'requests', 'automations', 'find'];
const REMEMBER = 'network.business';

function Avatar({ biz }) {
  return biz.logo_url ? (
    <img src={biz.logo_url} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
  ) : (
    <span className="h-11 w-11 rounded-lg inline-flex items-center justify-center shrink-0"
      style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}>
      <Store size={18} aria-hidden="true" />
    </span>
  );
}

function BizLine({ biz, t, lang }) {
  const name = (lang === 'he' && biz.name_he) || biz.name;
  return (
    <div className="min-w-0">
      <Link to={`/business/${biz.slug || biz.id}`} className="font-semibold hover:underline inline-flex items-center gap-1" dir="auto" style={{ color: 'var(--ink)' }}>
        {name}
        {biz.verified && <BadgeCheck size={14} style={{ color: 'var(--success)' }} aria-label={t('network.verified', 'Verified')} />}
      </Link>
      <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--brand-muted)' }}>
        {biz.rating_count > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Star size={12} fill="currentColor" style={{ color: 'var(--gold)' }} aria-hidden="true" />
            {biz.rating_avg} ({biz.rating_count})
          </span>
        )}
        {(biz.categories || []).slice(0, 2).map((c) => <span key={c}>{t(`categories.${c}`, c)}</span>)}
      </div>
    </div>
  );
}

export default function NetworkTab({ API, token }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [businesses, setBusinesses] = useState(null);
  const [bizId, setBizId] = useState(() => { try { return localStorage.getItem(REMEMBER) || ''; } catch { return ''; } });
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'partners';

  const setView = (v) => { const p = new URLSearchParams(params); p.set('tab', 'network'); p.set('view', v); setParams(p, { replace: true }); };

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/marketplace/businesses`, auth)
      .then(({ data: d }) => {
        if (!alive) return;
        const active = (d || []).filter((b) => b.active);
        setBusinesses(active);
        if (!active.find((b) => b.id === bizId) && active[0]) setBizId(active[0].id);
      })
      .catch(() => alive && setBusinesses([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token]);

  useEffect(() => { try { if (bizId) localStorage.setItem(REMEMBER, bizId); } catch { /* private mode */ } }, [bizId]);

  const load = useCallback(async () => {
    if (!bizId) return;
    setFailed(false);
    try {
      const { data: d } = await axios.get(`${API}/marketplace/businesses/${bizId}/connections`, auth);
      setData(d);
    } catch {
      // Say so. An empty list and a failed load look identical, and one
      // of them tells an owner nobody wants to work with them.
      setFailed(true);
    }
  }, [API, auth, bizId]);

  useEffect(() => { setData(null); load(); }, [load]);

  const act = async (conn, action) => {
    setBusy(conn.id);
    try {
      await axios.post(`${API}/marketplace/connections/${conn.id}/${action}`, null, auth);
      toast.success({
        accept: t('network.acceptedToast', 'You are now connected'),
        decline: t('network.declinedToast', 'Request declined'),
        disconnect: conn.status === 'pending' ? t('network.withdrawnToast', 'Request withdrawn') : t('network.disconnectedToast', 'Disconnected'),
      }[action]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('network.failed', 'That did not work. Please try again.'));
    } finally {
      setBusy(null);
      load();
    }
  };

  const message = (other) => {
    if (!other.message_listing_id || !other.owner_user_id) return;
    navigate(`/chat/${other.message_listing_id}?with=${encodeURIComponent(other.owner_user_id)}`);
  };

  if (businesses && businesses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)' }} data-testid="network-no-business">
        <p style={{ color: 'var(--ink)' }}>{t('network.needBusiness', 'Add your business, free, to connect with other businesses.')}</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/dashboard?tab=my-businesses')}>
          {t('network.addBusiness', 'Add your business')}
        </button>
      </div>
    );
  }

  const rows = data?.connections || [];
  const partners = rows.filter((c) => c.status === 'accepted');
  const incoming = rows.filter((c) => c.direction === 'incoming');
  const outgoing = rows.filter((c) => c.direction === 'outgoing');
  const relLabel = (r) => r && t(`network.rel_${r}`, { supplier: 'Supplier', customer: 'Customer', courier: 'Courier', partner: 'Partner' }[r]);

  const card = (c, actions) => (
    <li key={c.id} className="flex items-center gap-3 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--brand-border)' }} data-testid={`network-row-${c.status}`}>
      <Avatar biz={c.other} />
      <div className="flex-1 min-w-0">
        <BizLine biz={c.other} t={t} lang={lang} />
        {c.relationship && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}>
            {relLabel(c.relationship)}
          </span>
        )}
        {c.note && c.status === 'pending' && (
          <p className="text-xs mt-1 italic" dir="auto" style={{ color: 'var(--brand-muted)' }}>“{c.note}”</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{actions}</div>
    </li>
  );

  const btn = 'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50';

  return (
    <div data-testid="network-tab">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('network.title', 'Your network')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('network.subtitle', 'Businesses you work with: suppliers, couriers and partners.')}
          </p>
        </div>
        {businesses && businesses.length > 1 && (
          <label className="text-sm flex items-center gap-2">
            <span style={{ color: 'var(--brand-muted)' }}>{t('network.actingAs', 'As')}</span>
            <select value={bizId} onChange={(e) => setBizId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--brand-border)' }} data-testid="network-business-select">
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 p-1 rounded-lg mb-4" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }}>
        {VIEWS.map((v) => {
          const Icon = { partners: Users, requests: Inbox, automations: Zap, find: Search }[v];
          const n = v === 'partners' ? partners.length : v === 'requests' ? incoming.length : null;
          return (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold ${view === v ? 'bg-white shadow-sm' : ''}`}
              style={{ color: view === v ? 'var(--brand-primary)' : 'var(--brand-muted)' }} data-testid={`network-view-${v}`}>
              <Icon size={15} aria-hidden="true" />
              {t(`network.view_${v}`, { partners: 'Partners', requests: 'Requests', automations: 'Automations', find: 'Find partners' }[v])}
              {n > 0 && <span className="ms-1 text-xs tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'var(--brand-border)' }}>
        {failed && (
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="network-failed">
            {t('network.loadFailed', 'Your network could not be loaded.')}{' '}
            <button type="button" className="underline" onClick={load}>{t('network.retry', 'Try again')}</button>
          </p>
        )}

        {!failed && !data && view !== 'find' && (
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('network.loading', 'Loading…')}</p>
        )}

        {!failed && data && view === 'partners' && (
          partners.length ? (
            <ul>{partners.map((c) => card(c, (
              <>
                {c.other.message_listing_id && (
                  <button type="button" className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} onClick={() => message(c.other)}>
                    <MessageCircle size={13} aria-hidden="true" /> {t('network.message', 'Message')}
                  </button>
                )}
                <button type="button" disabled={busy === c.id} className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} onClick={() => act(c, 'disconnect')}>
                  {t('network.disconnect', 'Disconnect')}
                </button>
              </>
            )))}</ul>
          ) : (
            <div className="text-center py-6" data-testid="network-empty-partners">
              <p style={{ color: 'var(--ink)' }}>{t('network.noPartners', 'No partners yet.')}</p>
              <button type="button" className="mt-3 underline text-sm font-semibold" style={{ color: 'var(--brand-primary)' }} onClick={() => setView('find')}>
                {t('network.findSome', 'Find businesses to work with')}
              </button>
            </div>
          )
        )}

        {!failed && data && view === 'requests' && (
          <>
            <h3 className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--brand-muted)' }}>{t('network.waitingOnYou', 'Waiting on you')}</h3>
            {incoming.length ? (
              <ul className="mb-5">{incoming.map((c) => card(c, (
                <>
                  <button type="button" disabled={busy === c.id} className={`${btn} btn-primary border-transparent`} onClick={() => act(c, 'accept')} data-testid="network-accept">
                    <Check size={13} aria-hidden="true" /> {t('network.accept', 'Accept')}
                  </button>
                  <button type="button" disabled={busy === c.id} className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} onClick={() => act(c, 'decline')}>
                    <X size={13} aria-hidden="true" /> {t('network.decline', 'Decline')}
                  </button>
                </>
              )))}</ul>
            ) : (
              <p className="text-sm mb-5" style={{ color: 'var(--brand-muted)' }}>{t('network.noneIncoming', 'Nothing waiting.')}</p>
            )}
            <h3 className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--brand-muted)' }}>{t('network.youAsked', 'You asked')}</h3>
            {outgoing.length ? (
              <ul>{outgoing.map((c) => card(c, (
                <button type="button" disabled={busy === c.id} className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }} onClick={() => act(c, 'disconnect')}>
                  {t('network.withdraw', 'Withdraw')}
                </button>
              )))}</ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('network.noneOutgoing', 'No requests sent.')}</p>
            )}
          </>
        )}

        {!failed && data && view === 'automations' && (
          <AutomationsPanel
            API={API}
            token={token}
            bizId={bizId}
            partners={partners.map((c) => ({ id: c.other.id, name: (lang === 'he' && c.other.name_he) || c.other.name }))}
          />
        )}

        {view === 'find' && (
          <div className="py-2" data-testid="network-find">
            <p className="text-sm" style={{ color: 'var(--ink)' }}>
              {t('network.findHow', 'Browse businesses on the site. Every business page has a Connect button.')}
            </p>
            <button type="button" className="btn-primary mt-4 inline-flex items-center gap-2" onClick={() => navigate('/businesses')}>
              <Search size={15} aria-hidden="true" /> {t('network.browse', 'Browse businesses')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
