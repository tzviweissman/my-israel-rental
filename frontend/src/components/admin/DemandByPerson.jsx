/**
 * DemandByPerson — WhatsApp taps, visitors and QR scans per person.
 *
 * The overview's cards say whether demand is growing; this says whose it
 * is (Tzvi, 18 Sep 2026). It follows the same range control as the cards
 * above it, so a row and a card can never be describing different periods.
 *
 * Each person's numbers are summed across everything they own - flats,
 * services, business pages and Requests posts - and "Visitors" is the
 * deduplicated stream each owner sees on their own dashboard, so an admin
 * and an owner looking at the same listing read the same number.
 *
 * Real numbers only: a failed fetch renders a sentence saying so, never an
 * empty table that reads as "nobody has any demand".
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { API } from '../../lib/apiBase';

export default function DemandByPerson({ token, range }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setData(null);
    (async () => {
      try {
        const { data: d } = await axios.get(`${API}/admin/metrics/by-user`, {
          params: { range },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token, range]);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) =>
      `${r.name || ''} ${r.email || ''}`.toLowerCase().includes(needle));
  }, [data, q]);

  // Tighter on a phone: four columns have to fit in 343px without the
  // numbers - the whole point of the table - scrolling out of sight.
  const th = 'px-2 sm:px-4 py-3 text-start text-xs font-semibold uppercase';
  const num = 'px-2 sm:px-4 py-3 text-sm text-end tabular-nums';

  return (
    <section className="mb-10" data-testid="admin-demand-by-person">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('admin.byPersonTitle', 'Demand by person')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('admin.byPersonHint', 'Everything each person owns, added up: listings, services, business pages and requests.')}
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">{t('admin.byPersonSearch', 'Search by name or email')}</span>
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.byPersonSearch', 'Search by name or email')}
            className="w-64 max-w-full rounded-lg border ps-8 pe-3 py-2 text-sm"
            style={{ borderColor: 'var(--brand-border)' }}
            data-testid="admin-demand-search"
          />
        </label>
      </div>

      {failed && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="admin-demand-failed">
          {t('admin.byPersonFailed', 'These numbers could not be loaded.')}
        </p>
      )}

      {!failed && data && data.rows.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="admin-demand-empty">
          {t('admin.byPersonEmpty', 'No taps, visitors or scans in this period.')}
        </p>
      )}

      {!failed && data && data.rows.length > 0 && (
        <div className="bg-white rounded-xl border overflow-x-auto max-h-[480px] overflow-y-auto" style={{ borderColor: 'var(--brand-border)' }}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className={th} style={{ color: 'var(--brand-muted)' }}>{t('admin.byPersonColPerson', 'Person')}</th>
                <th className={`${th} text-end`} style={{ color: 'var(--brand-muted)' }}>{t('admin.kpiWhatsappClicks', 'WhatsApp taps')}</th>
                <th className={`${th} text-end`} style={{ color: 'var(--brand-muted)' }}>{t('admin.byPersonColVisitors', 'Visitors')}</th>
                <th className={`${th} text-end`} style={{ color: 'var(--brand-muted)' }}>{t('admin.kpiQrScans', 'QR scans')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="admin-demand-row">
                  <td className="px-2 sm:px-4 py-3 text-sm max-w-[9rem] sm:max-w-none">
                    {r.name || r.email ? (
                      <>
                        <div className="font-semibold break-words" dir="auto" style={{ color: 'var(--ink)' }}>{r.name || r.email}</div>
                        {r.name && r.email && (
                          <div className="text-xs break-all" dir="ltr" style={{ color: 'var(--brand-muted)' }}>{r.email}</div>
                        )}
                      </>
                    ) : (
                      <span className="italic" style={{ color: 'var(--brand-muted)' }}>
                        {t('admin.byPersonDeleted', 'Account no longer exists')}
                      </span>
                    )}
                  </td>
                  <td className={`${num} font-semibold`} style={{ color: 'var(--ink)' }}>{r.whatsapp_clicks}</td>
                  <td className={num} style={{ color: 'var(--ink)' }}>{r.visitors}</td>
                  <td className={num} style={{ color: 'var(--ink)' }}>{r.qr_scans}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-center" style={{ color: 'var(--brand-muted)' }}>
                    {t('admin.byPersonNoMatch', 'Nobody matches that search.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
