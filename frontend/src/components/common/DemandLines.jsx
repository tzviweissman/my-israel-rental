/**
 * Who is looking right now: real counts from /api/site/demand (backend
 * routes/site_visits.py), shown to people deciding whether to list.
 * A number under the server's minimum never arrives, so its line is left
 * out; with no numbers at all this renders nothing (never invent numbers).
 *
 * `stays`: property lines only (Why host). `compact`: the first line only,
 * for the join page, which has to fit one screen.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, MessageSquare, Search } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { areaLabel } from '../../utils/areaNames';

export default function DemandLines({ stays = false, compact = false, className = '' }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  useEffect(() => {
    fetch(`${API}/site/demand`).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, []);
  if (!d) return null;

  const lines = [];
  if (d.stays_people_7d) lines.push([Search, t('demand.stays', '{{n}} people looked for a place to stay this week', { n: d.stays_people_7d })]);
  if (d.top_area) lines.push([MapPin, t('demand.topArea', 'Most searched area: {{area}} ({{n}} people)', { area: areaLabel(d.top_area.area, t), n: d.top_area.people })]);
  if (!stays && d.services_people_7d) lines.push([Search, t('demand.services', '{{n}} people looked for a local business or pro this week', { n: d.services_people_7d })]);
  if (d.requests_30d) lines.push([MessageSquare, t('demand.requests', '{{n}} requests posted in the last 30 days by people looking for something', { n: d.requests_30d })]);
  if (!lines.length) return null;
  const shown = compact ? lines.slice(0, 1) : lines;

  return (
    <div className={className} data-testid="demand-lines">
      {!compact && (
        <p className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'var(--brand-muted)' }}>
          {t('demand.heading', 'Who is looking right now')}
        </p>
      )}
      <ul className="space-y-1.5">
        {shown.map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink)' }}>
            <Icon size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
