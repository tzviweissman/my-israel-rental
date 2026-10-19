/**
 * The kitchen's prep list and the day's delivery route (backend
 * prep_route.py), opened from the Orders page's More menu.
 *
 * Both pick a day the same way: Today, Tomorrow, Friday, or any date.
 * The prep list prints on its own (a clean page for the kitchen wall).
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, MapPin, Navigation, Printer, X } from 'lucide-react';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';

const isoIL = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);

function useDayChoices() {
  const { t } = useTranslation();
  return useMemo(() => {
    const now = new Date();
    const today = isoIL(now);
    const tomorrow = isoIL(new Date(now.getTime() + 864e5));
    const fri = new Date(now);
    while (new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(fri) !== 'Fri') fri.setTime(fri.getTime() + 864e5);
    const out = [[today, t('orders.rangeToday', 'Today')], [tomorrow, t('prep.tomorrow', 'Tomorrow')]];
    if (isoIL(fri) !== today && isoIL(fri) !== tomorrow) out.push([isoIL(fri), t('orders.rangeFriday', 'Friday')]);
    return out;
  }, [t]);
}

function DayPicker({ day, setDay }) {
  const choices = useDayChoices();
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {choices.map(([d, label]) => (
        <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={day === d}
          className="min-h-[36px] px-3 rounded-full border text-[13px] font-semibold"
          style={day === d ? { background: 'var(--ink)', color: '#FFFFFF', borderColor: 'var(--ink)' } : { borderColor: BORDER, color: 'var(--ink)' }}>
          {label}
        </button>
      ))}
      <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={t('prep.pickDate', 'Another day')}
        className="min-h-[36px] rounded-lg border px-2 text-[13px]" style={{ borderColor: BORDER, color: 'var(--ink)' }} />
    </div>
  );
}

function Panel({ title, onClose, children, testid }) {
  const { t } = useTranslation();
  return (
    <section className="mb-4 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: BORDER }} data-testid={testid}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{title}</h3>
        <button type="button" onClick={onClose} className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full" aria-label={t('orders.close', 'Close')} style={{ color: MUTED }}>
          <X size={18} />
        </button>
      </div>
      {children}
    </section>
  );
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function PrepList({ API, auth, businessId, businessName, onClose }) {
  const { t, i18n } = useTranslation();
  const [day, setDay] = useState(() => isoIL(new Date()));
  const [byTime, setByTime] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    axios.get(`${API}/marketplace/businesses/${businessId}/prep`, { ...auth, params: { date: day } })
      .then(({ data: d }) => setData(d)).catch(() => setData({ totals: [], by_time: [], typed: [], orders: 0 }));
  }, [API, auth, businessId, day]);

  const dayLabel = new Intl.DateTimeFormat((i18n.language || '').startsWith('he') ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${day}T12:00`));

  const groups = byTime ? (data?.by_time || []) : [{ time: '', totals: data?.totals || [] }];

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const dir = document.documentElement.dir || 'ltr';
    const body = groups.map((g) => `${g.time ? `<h2>${esc(g.time)}</h2>` : ''}<table>${g.totals.map((r) => `<tr><td class="q">${esc(r.qty)}</td><td>${esc(r.name)}</td></tr>`).join('')}</table>`).join('')
      + (data?.typed?.length ? `<h2>${esc(t('prep.typed', 'Typed orders'))}</h2><ul>${data.typed.map((o) => `<li>${esc(o.time)} ${esc(o.customer_name)}: ${esc(o.items)}</li>`).join('')}</ul>` : '');
    w.document.write(`<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(t('prep.title', 'Prep list'))}</title><style>body{font:16px system-ui,sans-serif;margin:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:18px 0 6px}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:8px 6px;font-size:17px}td.q{width:4em;font-weight:700;font-variant-numeric:tabular-nums}</style></head><body><h1>${esc(businessName)}: ${esc(t('prep.title', 'Prep list'))}</h1><p>${esc(dayLabel)}</p>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Panel title={t('prep.title', 'Prep list')} onClose={onClose} testid="prep-list">
      <p className="mt-1 text-[13px]" style={{ color: MUTED }}>{t('prep.body', 'Everything to make for the day, added up across that day’s orders.')}</p>
      <DayPicker day={day} setDay={setDay} />
      {data === null ? (
        <div className="py-6 text-center" style={{ color: MUTED }}><Loader2 className="animate-spin inline" size={18} /></div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {dayLabel} · {t('prep.orders', '{{count}} orders', { count: data.orders })}
            </p>
            <span className="flex items-center gap-3">
              {data.by_time.length > 1 && (
                <label className="inline-flex items-center gap-2 text-[13px] min-h-[36px]" style={{ color: 'var(--ink)' }}>
                  <input type="checkbox" checked={byTime} onChange={(e) => setByTime(e.target.checked)} />
                  {t('prep.byTime', 'By pickup time')}
                </label>
              )}
              {(data.totals.length > 0 || data.typed.length > 0) && (
                <button type="button" onClick={print} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border text-[13px] font-semibold" style={{ borderColor: BORDER, color: 'var(--ink)' }}>
                  <Printer size={14} aria-hidden="true" /> {t('orders.print.button', 'Print')}
                </button>
              )}
            </span>
          </div>
          {data.totals.length === 0 && data.typed.length === 0 && (
            <p className="mt-4 text-sm" style={{ color: MUTED }}>{t('prep.empty', 'No orders for this day yet.')}</p>
          )}
          {groups.map((g) => (
            <div key={g.time || 'all'} className="mt-3">
              {g.time && <p className="text-[13px] font-semibold tabular-nums" style={{ color: MUTED }}>{g.time}</p>}
              <ul className="divide-y rounded-xl border" style={{ borderColor: BORDER }}>
                {g.totals.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-10 text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{r.qty}</span>
                    <span dir="auto" className="text-sm" style={{ color: 'var(--ink)' }}>{r.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data.typed.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold" style={{ color: MUTED }}>{t('prep.typed', 'Typed orders')}</p>
              <ul className="mt-1 space-y-1">
                {data.typed.map((o, i) => (
                  <li key={i} dir="auto" className="text-sm" style={{ color: 'var(--ink)' }}>
                    {o.time ? `${o.time} ` : ''}<strong>{o.customer_name}</strong>: {o.items}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export function DeliveryRoute({ API, auth, businessId, onClose }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(() => isoIL(new Date()));
  const [from, setFrom] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    axios.get(`${API}/marketplace/businesses/${businessId}/route`, {
      ...auth, params: { date: day, ...(from ? { from_lat: from[0], from_lng: from[1] } : {}) }, timeout: 120000,
    }).then(({ data: d }) => setData(d)).catch(() => setData({ stops: [], google: [], not_found: 0 }));
  }, [API, auth, businessId, day, from]);

  const fromHere = () => {
    navigator.geolocation?.getCurrentPosition((p) => setFrom([p.coords.latitude, p.coords.longitude]), () => {});
  };

  return (
    <Panel title={t('route.title', 'Delivery route')} onClose={onClose} testid="delivery-route">
      <p className="mt-1 text-[13px]" style={{ color: MUTED }}>{t('route.body', 'The day’s open deliveries in driving order: earlier times first, then the nearest next stop.')}</p>
      <DayPicker day={day} setDay={setDay} />
      {data === null ? (
        <div className="py-6 text-center text-[13px]" style={{ color: MUTED }}>
          <Loader2 className="animate-spin inline" size={18} /> <span className="block mt-1">{t('route.finding', 'Finding the addresses…')}</span>
        </div>
      ) : data.stops.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: MUTED }}>{t('route.empty', 'No open deliveries for this day.')}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {data.google.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
                <ExternalLink size={13} aria-hidden="true" />
                {data.google.length > 1 ? t('route.googlePart', 'Route in Google Maps, part {{n}}', { n: i + 1 }) : t('route.google', 'Whole route in Google Maps')}
              </a>
            ))}
            <button type="button" onClick={fromHere} className="inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
              <Navigation size={13} aria-hidden="true" /> {t('route.fromHere', 'Start from where I am')}
            </button>
          </div>
          <ol className="mt-3 space-y-2" data-testid="route-stops">
            {data.stops.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3 rounded-xl border px-3 py-2" style={{ borderColor: BORDER }}>
                <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-bold" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>
                    {s.time && <span className="tabular-nums">{s.window ? `${s.window.start}–${s.window.end}` : s.time} · </span>}{s.customer_name}
                  </span>
                  <span className="block text-[13px]" dir="auto" style={{ color: MUTED }}>
                    <MapPin size={12} className="inline -mt-0.5" aria-hidden="true" /> {s.address}
                    {!s.geo && ` · ${t('route.notFound', 'not found on the map, Waze will search it')}`}
                  </span>
                </span>
                <a href={s.waze} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full border text-[13px] font-semibold" style={{ borderColor: BORDER, color: 'var(--ink)' }}>
                  <Navigation size={13} aria-hidden="true" /> Waze
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
