/**
 * /orders/staff/:token — the counter's screen (spec O3, "shared staff view").
 *
 * No login. The token in the URL is the whole credential: one per
 * business, made and rotated by the owner from the Orders tab. Whoever
 * has it sees today's board and can move orders along; they cannot
 * create, edit or export. This is the job the Google Sheet was really
 * doing — the screen the staff have open — and without it the sheet
 * stays open "just in case".
 *
 * Refreshes itself every 30 seconds, because two phones at one counter
 * both need to see an order go "ready" without anyone pulling to reload.
 * No site chrome: the nav's links go to pages this person has no
 * account for. Designed at 375px first — it is read on a phone propped
 * by the till.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ClipboardList, RefreshCw } from 'lucide-react';
import { API } from '../lib/apiBase';
import OrderCard, { STATUS_ORDER, OPEN, pillStyle } from '../components/dashboard/OrderCard';

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const REFRESH_MS = 30_000;

export default function StaffOrdersPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState('today');
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState(null);      // null = loading, false = bad link
  const [busyId, setBusyId] = useState(null);
  const [lastLoaded, setLastLoaded] = useState(null);

  // Bare page: hide the site nav and the floating WhatsApp button for
  // as long as this route is mounted (rule in App.css).
  useEffect(() => {
    document.body.classList.add('orders-bare');
    return () => document.body.classList.remove('orders-bare');
  }, []);

  const load = useCallback(async () => {
    const today = localDate(new Date());
    const params = {};
    if (range === 'today') { params.from = today; params.to = today; }
    else if (range === 'tomorrow') {
      const d = new Date(); d.setDate(d.getDate() + 1);
      params.from = localDate(d); params.to = localDate(d);
    } else if (range === 'week') {
      const end = new Date(); end.setDate(end.getDate() + 6);
      params.from = today; params.to = localDate(end);
    } else if (range === 'open') { params.status = 'open'; }
    try {
      const { data: d } = await axios.get(`${API}/marketplace/orders/staff/${encodeURIComponent(token)}`, { params });
      setData(d);
      setLastLoaded(new Date());
    } catch (err) {
      if (err?.response?.status === 404) setData(false);
      else toast.error(t('orders.loadFailed', 'Could not load orders'));
    }
  }, [token, range, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const setStatus = async (order, status) => {
    setBusyId(order.id);
    try {
      const { data: fresh } = await axios.patch(
        `${API}/marketplace/orders/staff/${encodeURIComponent(token)}/${order.id}/status`, { status },
      );
      setData((prev) => prev && ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === fresh.id ? fresh : o)),
        status_counts: {
          ...prev.status_counts,
          [order.status]: Math.max(0, (prev.status_counts[order.status] || 0) - 1),
          [status]: (prev.status_counts[status] || 0) + 1,
        },
      }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('orders.saveFailed', 'Could not save'));
      if (err?.response?.status === 409) load();
    } finally {
      setBusyId(null);
    }
  };

  const lang = String(i18n.language || 'en').split('-')[0];
  const dayLabel = (day) => {
    const today = localDate(new Date());
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    if (day === today) return t('orders.today', 'Today');
    if (day === localDate(tmr)) return t('orders.tomorrow', 'Tomorrow');
    if (!day) return t('orders.noDate', 'No date');
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${day}T00:00`));
  };

  const groups = useMemo(() => {
    if (!data) return [];
    const list = statusFilter ? data.orders.filter((o) => o.status === statusFilter) : data.orders;
    const map = new Map();
    for (const o of list) {
      const day = (o.needed_by || '').slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(o);
    }
    return [...map.entries()];
  }, [data, statusFilter]);

  if (data === null) {
    return <div className="py-24 text-center" style={{ color: 'var(--brand-muted)' }}><Loader2 className="animate-spin inline" size={20} /></div>;
  }
  if (data === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="staff-bad-link">
        <ClipboardList size={26} className="inline mb-3" style={{ color: 'var(--brand-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('orders.staff.badLinkTitle', 'This link no longer works')}</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>{t('orders.staff.badLinkBody', 'Ask the owner for a new one — links are replaced when they are reset.')}</p>
      </div>
    );
  }

  const bizName = (lang === 'he' && data.business?.name_he) || data.business?.name || '';
  const counts = data.status_counts || {};

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="staff-board">
      <header className="sticky top-0 z-10 px-4 py-3 border-b bg-white" style={{ borderColor: 'var(--brand-border)' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {data.business?.logo_url && <img src={data.business.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{bizName}</h1>
            <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              {t('orders.staff.subtitle', 'Orders board')}
              {lastLoaded && ` · ${t('orders.staff.updated', 'updated {{time}}', { time: lastLoaded.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) })}`}
            </p>
          </div>
          <button type="button" onClick={load} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full" style={{ color: 'var(--brand-muted)' }} aria-label={t('orders.staff.refresh', 'Refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-3 overflow-x-auto" role="tablist">
          {[
            ['today', t('orders.rangeToday', 'Today')],
            ['tomorrow', t('orders.tomorrow', 'Tomorrow')],
            ['week', t('orders.rangeWeek', 'This week')],
            ['open', t('orders.rangeOpen', 'All open')],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={range === key}
              onClick={() => { setRange(key); setStatusFilter(''); }}
              className="px-3 min-h-[40px] rounded-lg text-sm font-semibold whitespace-nowrap"
              style={range === key ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {STATUS_ORDER.filter((s) => range === 'open' ? OPEN.has(s) : true).map((s) => {
            const n = counts[s] || 0;
            if (!n && !OPEN.has(s)) return null;
            const on = statusFilter === s;
            return (
              <button key={s} type="button" onClick={() => setStatusFilter(on ? '' : s)} aria-pressed={on}
                className="inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-full text-xs font-semibold border" style={pillStyle(s, on)}>
                {t(`orders.status.${s}`, s)} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
            <ClipboardList size={22} className="inline mb-2" />
            <p className="text-sm">{range === 'today' ? t('orders.emptyToday', 'Nothing due today.') : t('orders.empty', 'No orders here yet.')}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([day, list]) => (
              <section key={day || 'none'}>
                <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-muted)' }}>
                  {dayLabel(day)} <span className="font-normal">· {list.length}</span>
                </h2>
                <div className="space-y-2">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} busy={busyId === o.id} onStatus={(s) => setStatus(o, s)} t={t} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="text-[11px] text-center mt-8" style={{ color: 'var(--brand-muted)' }}>
          {t('orders.staff.footer', 'This board is for staff. Orders are entered from the owner\'s dashboard.')}
        </p>
      </main>
    </div>
  );
}
