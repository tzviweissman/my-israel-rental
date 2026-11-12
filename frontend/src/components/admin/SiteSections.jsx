/**
 * Which parts of the site people use, busiest first (Tzvi, 12 Nov 2026: "everything we can should be tracked").
 * Counted by section name only (backend routes/site_visits.py, SECTIONS), never by path. Hand-built business sites
 * are counted per business in the visits breakdown, not here.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API } from '../../App';
import { formatDate } from '../../utils/formatDate';

const NAMES = {
  home: 'Home page', stays: 'Stays', listing: 'A stay or rental', businesses: 'Businesses list',
  business_service: 'A business service', business_page: 'A business page', add_business: 'Adding a business',
  jobs: 'Jobs board', restaurants: 'Restaurants', requests: 'Requests board', post_request: 'Posting a request',
  order: 'Order forms', signup: 'Sign up and sign in', dashboard: 'Dashboards', chat: 'Chats', info: 'Info pages',
};

export default function SiteSections({ token }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    setFailed(false);
    axios.get(`${API}/admin/site/sections`, { params: { days }, headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!off) setData(r.data); })
      .catch(() => { if (!off) { setData(null); setFailed(true); } });
    return () => { off = true; };
  }, [token, days]);

  return (
    <section className="bg-white rounded-xl border border-[var(--brand-border)] p-4 sm:p-5 mb-8" data-testid="admin-site-sections">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-head)' }}>
          {t('admin.sectionsTitle', 'Which parts of the site people use')}
        </h2>
        <div className="flex gap-1">
          {[1, 7, 30].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className="text-xs rounded-full border px-3 py-1"
              style={days === d ? { background: '#000', color: '#fff', borderColor: '#000' } : { borderColor: 'var(--brand-border)' }}>
              {d === 1 ? t('admin.sectionsToday', 'Today') : t('admin.sectionsDays', '{{n}} days', { n: d })}
            </button>
          ))}
        </div>
      </div>
      {failed && <p className="text-sm text-gray-500">{t('admin.kpiUnavailable', 'These numbers could not be loaded.')}</p>}
      {data && !data.sections.length && (
        <p className="text-sm text-gray-500">{t('admin.sectionsNone', 'No visits counted yet for this time.')}</p>
      )}
      {data && data.sections.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-start font-semibold py-1">{t('admin.sectionsPart', 'Part of the site')}</th>
              <th className="text-end font-semibold py-1">{t('admin.sectionsPeople', 'People')}</th>
              <th className="text-end font-semibold py-1">{t('admin.kpiSitePageviews', 'Pages opened')}</th>
            </tr>
          </thead>
          <tbody>
            {data.sections.map((s) => (
              <tr key={s.section} className="border-t border-[var(--brand-border)]" data-testid={`section-${s.section}`}>
                <td className="py-1.5">{t(`admin.sectionName.${s.section}`, NAMES[s.section] || s.section)}</td>
                <td className="py-1.5 text-end font-semibold">{s.visitors.toLocaleString()}</td>
                <td className="py-1.5 text-end">{s.pageviews.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.since && (
        <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>
          {t('admin.sectionsSince', 'Counted since {{date}}', { date: formatDate(data.since) })}
        </p>
      )}
    </section>
  );
}
