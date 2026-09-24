/**
 * NetworkTab — a business's connections with other businesses
 * (docs/business-network-spec.md, Phase 1).
 *
 * Views: Partners (accepted), Requests (waiting on me, and ones I sent),
 * Automations, Find partners. Find partners searches businesses right
 * here, by kind and name, with Connect on each (22 Sep 2026). It used to
 * send people to /businesses, whose cards open a service page, where there
 * is no Connect button at all.
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
import { groupCategories } from '../../lib/categoryGroups';
import { CATEGORY_LABELS } from '../../lib/categories';

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
        {(biz.categories || []).filter((c) => CATEGORY_LABELS[c]).slice(0, 2).map((c) => <span key={c}>{t(`categoryLabels.${c}`, CATEGORY_LABELS[c])}</span>)}
      </div>
    </div>
  );
}

export default function NetworkTab({ API, token, listings = [] }) {
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
      <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)' }} data-testid="network-no-business" data-tour="network-no-business">
        <p style={{ color: 'var(--ink)' }}>{t('network.needBusiness', 'Add your business, free, to connect with other businesses.')}</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/dashboard?tab=my-businesses')} data-tour="network-add-business">
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

  const btn = 'inline-flex items-center gap-1 min-h-[44px] rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50';

  return (
    <div data-testid="network-tab" data-tour="network">
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
              className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-md text-sm font-semibold ${view === v ? 'bg-white shadow-sm' : ''}`}
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
            listings={listings.map((p) => ({ id: p.id, title: p.title }))}
          />
        )}

        {view === 'find' && bizId && (
          <FindPartners API={API} auth={auth} bizId={bizId} t={t} lang={lang} btn={btn} onChanged={load} />
        )}
      </div>
    </div>
  );
}

/**
 * Find partners: pick a kind of business ("Transportation" when you need a
 * courier), narrow by name, connect from the row. The kinds offered are
 * only those that have a business, with how many.
 */
function FindPartners({ API, auth, bizId, t, lang, btn, onChanged }) {
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);      // {results, categories}
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);

  const search = useCallback(async () => {
    setFailed(false);
    try {
      const { data } = await axios.get(`${API}/marketplace/businesses/${bizId}/partner-search`, { ...auth, params: { q, category: kind } });
      setRes(data);
    } catch {
      setFailed(true);
    }
  }, [API, auth, bizId, q, kind]);

  // Typing waits a moment; picking a kind searches at once.
  useEffect(() => { const h = setTimeout(search, q ? 300 : 0); return () => clearTimeout(h); }, [search, q]);

  const groups = useMemo(() => groupCategories(
    (res?.categories || []).map((c) => ({ slug: c.slug, label: CATEGORY_LABELS[c.slug] || c.slug, count: c.count })), t,
  ), [res, t]);

  const act = async (row, call, okMsg) => {
    setBusy(row.id);
    try {
      await call();
      toast.success(okMsg);
      await search();
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('network.failed', 'That did not work. Please try again.'));
    } finally {
      setBusy(null);
    }
  };
  const connect = (row) => act(row, () => axios.post(`${API}/marketplace/businesses/${bizId}/connections`, { target_business_id: row.id }, auth), t('network.requestSent', 'Request sent'));
  const accept = (row) => act(row, () => axios.post(`${API}/marketplace/connections/${row.connection_id}/accept`, null, auth), t('network.acceptedToast', 'You are now connected'));

  const field = 'w-full rounded-lg border px-3 min-h-[44px] text-sm bg-white';
  const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };
  const outline = { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-deep)' };

  return (
    <div data-testid="network-find">
      <div className="grid gap-2 sm:grid-cols-2 mb-3">
        <label className="block">
          <span className="block text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }}>{t('network.findKind', 'What kind of business?')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field} style={fieldStyle} data-testid="network-find-kind">
            <option value="">{t('network.findAllKinds', 'All kinds')}</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map((c) => <option key={c.slug} value={c.slug}>{c.label} ({c.count})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }}>{t('network.findName', 'Name')}</span>
          <span className="relative block">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} dir="auto" className={`${field} ps-8`} style={fieldStyle}
              placeholder={t('network.findNamePh', 'Search by name')} data-testid="network-find-q" />
          </span>
        </label>
      </div>

      {failed && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
          {t('network.findFailed', 'Businesses could not be loaded.')}{' '}
          <button type="button" className="underline" onClick={search}>{t('network.retry', 'Try again')}</button>
        </p>
      )}
      {!failed && !res && <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('network.loading', 'Loading…')}</p>}
      {!failed && res && res.results.length === 0 && (
        <p className="text-sm py-4" style={{ color: 'var(--brand-muted)' }} data-testid="network-find-empty">
          {t('network.findNone', 'No businesses match. Try another kind or name.')}
        </p>
      )}
      {!failed && res && res.results.length > 0 && (
        <ul>
          {res.results.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--brand-border)' }} data-testid="network-find-row">
              <Avatar biz={row} />
              <div className="flex-1 min-w-0"><BizLine biz={row} t={t} lang={lang} /></div>
              <div className="shrink-0">
                {row.status === 'accepted' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--ink)' }}><Check size={13} aria-hidden="true" /> {t('network.connected', 'Connected')}</span>
                )}
                {row.status === 'pending' && row.direction === 'outgoing' && (
                  <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{t('network.requested', 'Requested')}</span>
                )}
                {row.status === 'pending' && row.direction === 'incoming' && (
                  <button type="button" disabled={busy === row.id} className={btn} style={outline} onClick={() => accept(row)}>
                    <Check size={13} aria-hidden="true" /> {t('network.accept', 'Accept')}
                  </button>
                )}
                {!['accepted', 'pending'].includes(row.status) && (
                  <button type="button" disabled={busy === row.id} className={btn} style={outline} onClick={() => connect(row)} data-testid="network-find-connect">
                    <Users size={13} aria-hidden="true" /> {t('network.connect', 'Connect')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
