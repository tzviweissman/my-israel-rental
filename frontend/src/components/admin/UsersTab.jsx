/**
 * Super Admin → People & businesses.
 *
 * Laid out the way Shopify, Stripe and Midday lay out their customer
 * admin (Tzvi, 12 Nov 2026: "see how real companies do it"): one clean
 * list, one row per person, with counts instead of long nested lists; a
 * click opens that person's account panel, which holds everything about
 * them (contact, numbers, businesses, listings, services) and every action
 * (log in as them, show/hide an item, upgrade, block, delete).
 *
 * One search finds a person by their name, email, phone, or the name of
 * any business, listing or service they own.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Ban, CheckCircle, Trash2, LogIn, Mail, RotateCcw, Sparkles, Store, Home,
  Briefcase, EyeOff, Eye, X, ExternalLink, ChevronRight, Phone, MessageCircle, Users,
} from 'lucide-react';
import { API, AuthContext } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

const isOn = (kind, item) => (kind === 'listing' ? item.status === 'active' : item.status === 'published');
const EMPTY = { businesses: [], listings: [], services: [] };
const FILTERS = ['all', 'business', 'listings', 'services', 'blocked'];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '-');

// Small count chip on a row: an icon and a number, faded at zero.
const Count = ({ Icon, n, label }) => (
  <span
    className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums"
    style={{ color: n ? 'var(--ink)' : 'var(--brand-border)' }}
    title={label}
  >
    <Icon size={13} aria-hidden="true" style={{ color: n ? 'var(--brand-primary)' : 'var(--brand-border)' }} />
    {n}
    <span className="sr-only">{label}</span>
  </span>
);

const Stat = ({ label, value, sub }) => (
  <div className="p-3 rounded-lg" style={{ background: '#F9FAFB' }}>
    <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{label}</p>
    <p className="text-xl font-bold tabular-nums">{value}</p>
    {sub && <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{sub}</p>}
  </div>
);

// One list of things a person owns (listings or services), each with its
// own Live/Hidden switch. Gets its own search once it is long.
const ItemList = ({ kind, items, busyItem, onToggle, t }) => {
  const [q, setQ] = useState('');
  const Icon = kind === 'listing' ? Home : Briefcase;
  const shown = q ? items.filter((i) => (i.title || '').toLowerCase().includes(q.toLowerCase())) : items;
  const href = (i) => (kind === 'listing' ? `/property/${i.id}` : `/businesses/${i.id}`);
  return (
    <div>
      {items.length > 8 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin.filterItems', 'Find one...')}
          className="w-full mb-2 px-3 py-1.5 rounded-lg border border-[var(--brand-border)] text-sm"
        />
      )}
      <ul className="divide-y divide-[var(--brand-border)] border border-[var(--brand-border)] rounded-lg max-h-80 overflow-y-auto">
        {shown.map((i) => {
          const on = isOn(kind, i);
          return (
            <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Icon size={14} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} className="shrink-0" />
              <a href={href(i)} target="_blank" rel="noopener noreferrer" dir="auto" className="flex-1 min-w-0 truncate hover:underline" style={{ color: on ? 'var(--ink)' : 'var(--brand-muted)' }}>
                {i.title || t('admin.untitled', 'Untitled')}
              </a>
              <button
                type="button"
                onClick={() => onToggle(kind, i)}
                disabled={busyItem === i.id}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold disabled:opacity-50"
                style={on
                  ? { background: 'var(--success-bg, #E6F4EA)', color: 'var(--success, #2E7D4F)' }
                  : { background: '#F3F4F6', color: 'var(--brand-muted)' }}
                title={on ? t('admin.hideItem', 'Hide from the site') : t('admin.showItem', 'Show on the site')}
                data-testid={`toggle-${kind}-${i.id}`}
              >
                {on ? <Eye size={12} /> : <EyeOff size={12} />}
                {on ? t('admin.live', 'Live') : t('admin.hidden', 'Hidden')}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const Section = ({ title, count, children }) => (
  <section className="mt-6">
    <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>
      {title} <span className="font-semibold" style={{ color: 'var(--brand-muted)' }}>{count}</span>
    </h4>
    {children}
  </section>
);

// The account panel: everything about one person, and every action on them.
const AccountPanel = ({ u, h, stats, onClose, actions, busyItem, resendingId, t }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const active = (u.status || 'active') === 'active';
  const liveListings = h.listings.filter((l) => isOn('listing', l)).length;
  const liveServices = h.services.filter((g) => isOn('service', g)).length;
  const isAdmin = u.role === 'admin';
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={u.name} data-testid="account-panel">
      <button type="button" className="absolute inset-0 bg-black/30 w-full cursor-default" onClick={onClose} aria-label={t('admin.closePanel', 'Close')} />
      <aside className="absolute top-0 bottom-0 end-0 w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[var(--brand-border)] px-5 py-4 flex items-start gap-3 z-10">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold truncate" dir="auto" style={{ fontFamily: 'var(--font-head)' }}>{u.name || u.email}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">{u.role}</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {active ? t('admin.statusActive', 'Active') : t('admin.statusBlocked', 'Blocked')}
              </span>
              <span style={{ color: 'var(--brand-muted)' }}>{t('admin.joinedOn', 'Joined {{date}}', { date: fmtDate(u.created_at) })}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label={t('admin.closePanel', 'Close')} data-testid="account-panel-close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-8">
          {!isAdmin && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                onClick={() => actions.impersonate(u)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800"
                data-testid={`impersonate-user-${u.id}`}
              >
                <LogIn size={15} /> {t('admin.impersonate', 'Log in as this user')}
              </button>
              <button
                type="button"
                onClick={() => actions.upgrade(u)}
                aria-pressed={!!u.page_upgrade}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--brand-border)]"
                style={u.page_upgrade ? { background: 'rgb(var(--brand-primary-rgb) / 0.12)', color: 'var(--brand-primary-deep)' } : {}}
                title={t('admin.pageUpgradeHint', "Paid page upgrade for all of this person's pages")}
                data-testid={`page-upgrade-${u.id}`}
              >
                <Sparkles size={14} /> {u.page_upgrade ? t('admin.pageUpgradeOnShort', 'Upgrade on') : t('admin.pageUpgradeOffShort', 'Upgrade')}
              </button>
              {u.admin_imported && !u.password_set_at && (
                <button
                  type="button"
                  onClick={() => actions.resend(u)}
                  disabled={resendingId === u.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--brand-border)] disabled:opacity-50"
                  data-testid={`resend-setpwd-${u.id}`}
                >
                  <Mail size={14} /> {t('admin.resendSetPassword', 'Re-send set-password email')}
                </button>
              )}
            </div>
          )}

          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Mail size={14} className="shrink-0" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
              <a href={`mailto:${u.email}`} className="truncate hover:underline">{u.email}</a>
            </div>
            {u.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
                <a href={`tel:${u.phone}`} className="hover:underline" dir="ltr">{u.phone}</a>
              </div>
            )}
          </dl>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label={t('admin.statListings', 'Listings')} value={h.listings.length} sub={t('admin.nLive', '{{n}} live', { n: liveListings })} />
            <Stat label={t('admin.statServices', 'Services')} value={h.services.length} sub={t('admin.nLive', '{{n}} live', { n: liveServices })} />
            <Stat label={t('admin.statTaps', 'WhatsApp taps')} value={(stats?.whatsapp_clicks || 0) + (stats?.other_taps || 0)} />
            <Stat label={t('admin.byPersonColVisitors', 'Visitors')} value={stats?.visitors || 0} />
          </div>

          {h.businesses.length > 0 && (
            <Section title={t('admin.statBusinesses', 'Businesses')} count={h.businesses.length}>
              <ul className="divide-y divide-[var(--brand-border)] border border-[var(--brand-border)] rounded-lg">
                {h.businesses.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Store size={14} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
                    <span className="flex-1 min-w-0 truncate font-medium" dir="auto">{b.name || t('admin.untitled', 'Untitled')}</span>
                    <a href={`/business/${b.slug || b.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: 'var(--brand-primary)' }}>
                      {t('admin.openPage', 'Open page')} <ExternalLink size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {h.listings.length > 0 && (
            <Section title={t('admin.statListings', 'Listings')} count={h.listings.length}>
              <ItemList kind="listing" items={h.listings} busyItem={busyItem} onToggle={actions.toggleItem} t={t} />
            </Section>
          )}
          {h.services.length > 0 && (
            <Section title={t('admin.statServices', 'Services')} count={h.services.length}>
              <ItemList kind="service" items={h.services} busyItem={busyItem} onToggle={actions.toggleItem} t={t} />
            </Section>
          )}
          {!h.businesses.length && !h.listings.length && !h.services.length && (
            <p className="mt-6 text-sm" style={{ color: 'var(--brand-muted)' }}>{t('admin.ownsNothing', 'Nothing listed yet.')}</p>
          )}

          {!isAdmin && (
            <section className="mt-8 pt-4 border-t border-[var(--brand-border)] flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => actions.block(u)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--brand-border)] hover:bg-gray-50"
                data-testid={`toggle-user-${u.id}`}
              >
                {active ? <Ban size={14} className="text-orange-500" /> : <CheckCircle size={14} className="text-green-600" />}
                {active ? t('admin.block') : t('admin.unblock')}
              </button>
              <button
                type="button"
                onClick={() => actions.remove(u)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50"
                data-testid={`delete-user-${u.id}`}
              >
                <Trash2 size={14} /> {t('admin.deleteTooltip')}
              </button>
            </section>
          )}
          {isAdmin && <p className="mt-6 text-xs text-gray-400">{t('admin.protected')}</p>}
        </div>
      </aside>
    </div>
  );
};

export const UsersTab = ({ token, onStatsChange, prefilter }) => {
  const { t } = useTranslation();
  const { impersonate } = React.useContext(AuthContext);
  const headers = { Authorization: `Bearer ${token}` };

  const { data: users, refresh: fetchUsers } = useApiSWR(`${API}/admin/users`, token, { initial: [] });
  const [searchTerm, setSearchTerm] = useState(prefilter || '');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState('');
  // 50 rows at a time, like real admin lists: thousands of rows at once froze the page.
  const [limit, setLimit] = useState(50);
  // Deleted accounts can come back (routes/admin/core.py keeps a snapshot).
  const { data: deletedData, refresh: fetchDeleted } = useApiSWR(`${API}/admin/users/deleted`, token, { initial: { deleted: [] } });
  const deleted = deletedData?.deleted || [];
  // Each person's businesses, listings and services.
  const { data: holdings, refresh: fetchHoldings } = useApiSWR(`${API}/admin/users/holdings`, token, { initial: {} });
  // All-time taps and visitors per person, the same numbers as Demand by person.
  const { data: demand } = useApiSWR(`${API}/admin/metrics/by-user?range=all&limit=5000`, token, { initial: { rows: [] } });
  const statsBy = useMemo(() => Object.fromEntries((demand?.rows || []).map((r) => [r.user_id, r])), [demand]);
  const [busyItem, setBusyItem] = useState('');
  const [restoringId, setRestoringId] = useState('');
  const [resendingId, setResendingId] = useState('');

  const notifyStatsChange = () => { if (onStatsChange) onStatsChange(); };
  const hOf = (id) => holdings?.[id] || EMPTY;

  const toggleItem = async (kind, item) => {
    setBusyItem(item.id);
    try {
      if (kind === 'listing') {
        await axios.put(`${API}/admin/properties/${item.id}/status`, {}, { headers });
      } else {
        const next = item.status === 'published' ? 'unpublished' : 'published';
        await axios.patch(`${API}/admin/gigs/${item.id}/status`, { status: next }, { headers });
      }
      fetchHoldings();
      notifyStatsChange();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('admin.toggleFailed', 'That did not work'));
    } finally {
      setBusyItem('');
    }
  };

  const restoreUser = async (snapshotId) => {
    setRestoringId(snapshotId);
    try {
      const res = await axios.post(`${API}/admin/users/deleted/${snapshotId}/restore`, {}, { headers });
      const n = Object.values(res.data?.restored || {}).reduce((a, b) => a + b, 0);
      toast.success(t('admin.userRestored', 'The account is back, with {{count}} of their records. They sign in with Google or use Forgot password.', { count: n }), { duration: 10000 });
      fetchUsers();
      fetchDeleted();
      notifyStatsChange();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('admin.restoreFailed', 'Could not restore this account'));
    } finally {
      setRestoringId('');
    }
  };

  const block = async (u) => {
    try {
      const res = await axios.put(`${API}/admin/users/${u.id}/status`, {}, { headers });
      toast.success(res.data.message);
      fetchUsers();
      notifyStatsChange();
    } catch (e) { toast.error('Failed to update user'); }
  };

  // The paid page upgrade (backend utils/page_upgrade), switched by hand until payment exists.
  const upgrade = async (u) => {
    const next = !u.page_upgrade;
    try {
      await axios.put(`${API}/admin/users/${u.id}/page-upgrade`, { on: next }, { headers });
      fetchUsers();
      toast.success(next ? t('admin.pageUpgradeOn', 'Page upgrade on') : t('admin.pageUpgradeOff', 'Page upgrade off'));
    } catch (e) { toast.error(t('admin.pageUpgradeFailed', 'Could not change the page upgrade')); }
  };

  const remove = (u) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">{t('admin.deleteUserTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">{t('admin.deleteUserDesc')}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            {t('admin.cancel')}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                const res = await axios.delete(`${API}/admin/users/${u.id}`, { headers });
                const snap = res.data?.snapshot_id;
                toast.success(t('admin.userDeletedKept', 'Account deleted. Bookings, contracts, orders, reviews and chats with other people were kept.'), {
                  duration: 15000,
                  action: snap ? { label: t('admin.undo', 'Undo'), onClick: () => restoreUser(snap) } : undefined,
                });
                setOpenId('');
                fetchUsers();
                fetchDeleted();
                notifyStatsChange();
              } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete user'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-user-${u.id}`}
          >
            {t('admin.deleteAction')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const impersonateUser = async (u) => {
    try {
      const res = await axios.post(`${API}/admin/users/${u.id}/impersonate`, {}, { headers });
      // impersonate() stashes the admin token so the banner can offer
      // "Return to admin". A full page load, not navigate(): the /admin
      // route redirects a non-admin home, and that redirect won over
      // /dashboard in the same render.
      impersonate(res.data.token, res.data.user);
      window.location.assign('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Impersonation failed');
    }
  };

  // Re-send "Set your password" to an imported owner who hasn't finished onboarding.
  const resend = async (u) => {
    setResendingId(u.id);
    try {
      const res = await axios.post(`${API}/admin/users/${u.id}/resend-set-password`, {}, { headers });
      toast.success(res.data.message || 'Email re-sent');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to re-send email');
    } finally {
      setResendingId('');
    }
  };

  const term = searchTerm.trim().toLowerCase();
  const has = (v) => (v || '').toString().toLowerCase().includes(term);
  // What the search matched besides the person themself, shown on the row
  // so it is clear why they came up.
  const matchOf = (u) => {
    if (!term || has(u.name) || has(u.email) || has(u.phone)) return '';
    const h = hOf(u.id);
    const b = h.businesses.find((x) => has(x.name) || has(x.slug));
    if (b) return b.name;
    const l = h.listings.find((x) => has(x.title));
    if (l) return l.title;
    const g = h.services.find((x) => has(x.title));
    return g ? g.title : null;
  };
  const passes = (u, f) => {
    const h = hOf(u.id);
    if (f === 'business') return h.businesses.length > 0;
    if (f === 'listings') return h.listings.length > 0;
    if (f === 'services') return h.services.length > 0;
    if (f === 'blocked') return (u.status || 'active') !== 'active';
    return true;
  };
  const searched = users.filter((u) => matchOf(u) !== null);
  const filteredUsers = searched.filter((u) => passes(u, filter));
  const filterLabel = {
    all: t('admin.filterEveryone', 'Everyone'),
    business: t('admin.filterBusiness', 'Has a business'),
    listings: t('admin.filterListings', 'Has listings'),
    services: t('admin.filterServices', 'Has services'),
    blocked: t('admin.filterBlocked', 'Blocked'),
  };
  const openUser = users.find((u) => u.id === openId);

  return (
    <div data-testid="admin-users-section">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xl">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setLimit(50); }}
            placeholder={t('admin.searchUsers')}
            className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-[var(--brand-border)] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
            data-testid="users-search-input"
          />
        </div>
        <span className="text-sm text-gray-500">{t('admin.usersCount', { count: filteredUsers.length })}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => { setFilter(f); setLimit(50); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f ? 'bg-black text-white border-black' : 'bg-white border-[var(--brand-border)] hover:bg-gray-50'}`}
            data-testid={`users-filter-${f}`}
          >
            {filterLabel[f]} <span className="opacity-60 tabular-nums">{searched.filter((u) => passes(u, f)).length}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[var(--brand-border)] overflow-x-auto">
        <table className="w-full sm:min-w-[720px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase">{t('admin.colPerson', 'Person')}</th>
              <th className="hidden sm:table-cell px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase">{t('admin.colOwns', 'Owns')}</th>
              <th className="hidden sm:table-cell px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase">{t('admin.colDemand', 'Demand')}</th>
              <th className="hidden sm:table-cell px-4 py-3 text-start text-xs font-semibold text-gray-600 uppercase">{t('admin.colJoined')}</th>
              <th className="px-4 py-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {filteredUsers.slice(0, limit).map((u) => {
              const h = hOf(u.id);
              const s = statsBy[u.id];
              const hit = matchOf(u);
              const active = (u.status || 'active') === 'active';
              return (
                <tr
                  key={u.id}
                  onClick={() => setOpenId(u.id)}
                  className="border-t border-[var(--brand-border)] hover:bg-gray-50 cursor-pointer"
                  data-testid={`user-row-${u.id}`}
                >
                  <td className="px-4 py-3 text-sm align-top">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" dir="auto">{u.name || u.email}</span>
                      {u.role === 'admin' && <span className="px-1.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800">admin</span>}
                      {!active && <span className="px-1.5 rounded text-[10px] font-bold bg-red-100 text-red-700">{t('admin.statusBlocked', 'Blocked')}</span>}
                      {u.page_upgrade && <Sparkles size={12} style={{ color: 'var(--brand-primary)' }} aria-label={t('admin.pageUpgradeOnShort', 'Upgrade on')} />}
                    </div>
                    {h.businesses.length > 0 && (
                      <div className="text-xs mt-0.5 truncate max-w-[220px] sm:max-w-[320px]" dir="auto" style={{ color: 'var(--brand-primary)' }}>
                        {h.businesses.map((b) => b.name).join(' · ')}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 truncate max-w-[220px] sm:max-w-[320px]">{u.email}</div>
                    {hit && (
                      <div className="text-xs mt-0.5" dir="auto" style={{ color: 'var(--brand-muted)' }}>
                        {t('admin.matched', 'Matched:')} <b style={{ color: 'var(--ink)' }}>{hit}</b>
                      </div>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 align-top">
                    <div className="flex items-center gap-3">
                      <Count Icon={Store} n={h.businesses.length} label={t('admin.statBusinesses', 'Businesses')} />
                      <Count Icon={Home} n={h.listings.length} label={t('admin.statListings', 'Listings')} />
                      <Count Icon={Briefcase} n={h.services.length} label={t('admin.statServices', 'Services')} />
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 align-top">
                    <div className="flex items-center gap-3">
                      <Count Icon={MessageCircle} n={(s?.whatsapp_clicks || 0) + (s?.other_taps || 0)} label={t('admin.statTaps', 'WhatsApp taps')} />
                      <Count Icon={Users} n={s?.visitors || 0} label={t('admin.byPersonColVisitors', 'Visitors')} />
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-500 align-top">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-1">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); impersonateUser(u); }}
                          className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--brand-border)] bg-white hover:bg-gray-100"
                          title={t('admin.impersonate', 'Log in as this user')}
                          data-testid={`row-impersonate-${u.id}`}
                        >
                          <LogIn size={13} /> {t('admin.logInShort', 'Log in')}
                        </button>
                      )}
                      <ChevronRight size={16} className="hidden sm:block text-gray-400 rtl:rotate-180" aria-hidden="true" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredUsers.length > limit && (
          <div className="border-t border-[var(--brand-border)] p-3 text-center">
            <button type="button" onClick={() => setLimit(limit + 100)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--brand-border)] hover:bg-gray-50" data-testid="users-show-more">
              {t('admin.showMorePeople', 'Show more ({{n}} left)', { n: filteredUsers.length - limit })}
            </button>
          </div>
        )}
        {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">{t('admin.noUsers')}</p>}
      </div>

      {openUser && (
        <AccountPanel
          u={openUser}
          h={hOf(openUser.id)}
          stats={statsBy[openUser.id]}
          onClose={() => setOpenId('')}
          actions={{ impersonate: impersonateUser, upgrade, resend, block, remove, toggleItem }}
          busyItem={busyItem}
          resendingId={resendingId}
          t={t}
        />
      )}

      {deleted.length > 0 && (
        <section className="mt-8" data-testid="deleted-users">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">{t('admin.recentlyDeleted', 'Recently deleted')}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('admin.recentlyDeletedDesc', 'Restoring brings back the account and everything that was only theirs. They sign in with Google or use Forgot password; uploaded contract files do not come back.')}
          </p>
          <div className="bg-white rounded-xl border border-[var(--brand-border)] divide-y divide-[var(--brand-border)]">
            {deleted.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 flex-wrap" data-testid={`deleted-user-${d.id}`}>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-medium" dir="auto">{d.name || d.email}</div>
                  <div className="text-xs text-gray-500">
                    {d.email} · {t('admin.deletedOn', 'deleted {{date}}', { date: d.deleted_at ? new Date(d.deleted_at).toLocaleString() : '' })} · {t('admin.recordsCount', '{{count}} records', { count: d.records })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restoreUser(d.id)}
                  disabled={restoringId === d.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--brand-border)] hover:bg-gray-50 disabled:opacity-50"
                  data-testid={`restore-user-${d.id}`}
                >
                  <RotateCcw size={13} /> {t('admin.restore', 'Restore')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default UsersTab;
