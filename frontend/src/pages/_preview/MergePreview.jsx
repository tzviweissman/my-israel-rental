/**
 * Throwaway preview page for the "merge Bookings + Availability" decision.
 * Three layout options rendered with realistic mock data so the user can
 * compare visuals before we commit. Delete this file after the decision
 * is made and the real implementation lands.
 *
 *   /preview/merge/toggle    -> Option A: view-mode toggle
 *   /preview/merge/stacked   -> Option B: properties at top, expandable bookings
 *   /preview/merge/calendar  -> Option C: timeline / calendar
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Home, MapPin, Clock, CheckCircle2,
  FileSignature, FileText, FileCheck, Download, XCircle, ChevronRight,
  Bed, MessageCircle,
} from 'lucide-react';

const COLORS = {
  teal: '#1E6A6A', gold: '#D4AF37', red: '#DC2626',
  green: '#16A34A', blue: '#0EA5E9', amber: '#D97706',
};

// ─── Mock data ────────────────────────────────────────────────────────────
const PROPERTIES = [
  { id: 'p1', title: 'Sunny 2BR · Rechavia', area: 'Jerusalem - Rechavia', bedrooms: 2, rental_type: 'vacation',
    status: 'booked', current_until: '2026-05-24', next_available: '2026-05-24', occupancy: 67,
    booked_days: 60, vacant_days: 30,
    bookings: [
      { id: 'b1', renter: 'Sarah Cohen', start: '2026-05-17', end: '2026-05-24', status: 'confirmed', contract_signed: true, cancellation_requested: false, is_current: true },
      { id: 'b2', renter: 'David Levi', start: '2026-06-10', end: '2026-06-25', status: 'pending', contract_signed: false, cancellation_requested: false, is_current: false },
    ] },
  { id: 'p2', title: '3BR Family · Sanhedria', area: 'Jerusalem - Sanhedria Murchevet', bedrooms: 3, rental_type: 'long-term',
    status: 'upcoming', current_until: null, next_available: '2026-06-01', occupancy: 33,
    booked_days: 30, vacant_days: 60,
    bookings: [
      { id: 'b3', renter: 'Rachel Adler', start: '2026-06-01', end: '2026-07-01', status: 'confirmed', contract_signed: true, cancellation_requested: false, is_current: false },
      { id: 'b4', renter: 'Avi Stern', start: '2026-07-05', end: '2026-08-05', status: 'pending', contract_signed: false, cancellation_requested: true, is_current: false },
    ] },
  { id: 'p3', title: 'Cozy Studio · Bayit Vegan', area: 'Jerusalem - Bayit Vegan', bedrooms: 1, rental_type: 'short-term',
    status: 'available', current_until: null, next_available: 'today', occupancy: 0,
    booked_days: 0, vacant_days: 90, bookings: [] },
  { id: 'p4', title: '1.5BR Ground Floor · Maalot Dafna', area: 'Jerusalem - Maalot Dafna', bedrooms: 1, rental_type: 'long-term',
    status: 'booked', current_until: '2026-08-15', next_available: '2026-08-15', occupancy: 100,
    booked_days: 90, vacant_days: 0,
    bookings: [
      { id: 'b5', renter: 'Yosef Klein', start: '2026-01-01', end: '2026-08-15', status: 'confirmed', contract_signed: true, cancellation_requested: false, is_current: true },
    ] },
];

// ─── Shared atoms ────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    available: { c: COLORS.green, label: 'Available now', I: CheckCircle2 },
    upcoming: { c: COLORS.blue, label: 'Booked upcoming', I: Clock },
    booked: { c: COLORS.gold, label: 'Currently booked', I: CalendarIcon },
  };
  const m = map[status];
  const I = m.I;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${m.c}1A`, color: m.c }}>
      <I size={11} />{m.label}
    </span>
  );
};

const OccupancyBar = ({ pct }) => (
  <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
    <div className="h-full rounded-full"
      style={{ width: `${pct}%`, background: pct >= 80 ? COLORS.green : pct >= 40 ? COLORS.gold : '#9CA3AF' }} />
  </div>
);

const BookingChip = ({ b }) => (
  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-medium text-gray-800 text-sm">{b.renter}</span>
          {b.is_current && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: '#FEF3C7', color: '#A16207' }}>IN PROGRESS</span>}
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
            style={{
              backgroundColor: b.status === 'confirmed' ? '#DCFCE7' : '#E0F2FE',
              color: b.status === 'confirmed' ? COLORS.green : COLORS.blue,
            }}>{b.status}</span>
        </div>
        <div className="text-xs text-gray-600">{b.start} → {b.end}</div>
        {b.cancellation_requested && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#FEE2E2', color: COLORS.red }}>
            <XCircle size={10} />Renter requested cancellation
          </div>
        )}
      </div>
    </div>

    {/* Contextual action buttons — exactly mirror the existing BookingRow logic */}
    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
      <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-[#1E6A6A] border border-[#1E6A6A] hover:bg-[#1E6A6A]/5 inline-flex items-center gap-1">
        <MessageCircle size={12} />Message
      </button>

      {!b.contract_signed && (
        <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white inline-flex items-center gap-1" style={{ backgroundColor: COLORS.gold }}>
          <FileText size={12} />Upload / sign contract
        </button>
      )}
      {b.contract_signed && (
        <>
          <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-green-500 inline-flex items-center gap-1">
            <FileCheck size={12} />View contract
          </button>
          <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-[#1E6A6A] inline-flex items-center gap-1">
            <Download size={12} />Download
          </button>
        </>
      )}

      {b.status === 'pending' && !b.cancellation_requested && (
        <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white inline-flex items-center gap-1" style={{ backgroundColor: COLORS.teal }}>
          <CheckCircle2 size={12} />Accept booking
        </button>
      )}

      {b.cancellation_requested ? (
        <>
          <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-green-500 inline-flex items-center gap-1">
            <CheckCircle2 size={12} />Approve cancel
          </button>
          <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-red-500 inline-flex items-center gap-1">
            <XCircle size={12} />Deny cancel
          </button>
        </>
      ) : (
        <button className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white bg-red-500 inline-flex items-center gap-1 ml-auto">
          <XCircle size={12} />Cancel booking
        </button>
      )}
    </div>
  </div>
);

// ─── Option A: Toggle ────────────────────────────────────────────────────
const OptionToggle = () => {
  const [view, setView] = useState('booking');
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">My Bookings</h1>
      <p className="text-sm text-gray-500 mb-5">All your reservations, contracts and unit availability — in one place.</p>

      <div className="inline-flex bg-gray-100 rounded-xl p-1 mb-6">
        <button onClick={() => setView('booking')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'booking' ? 'bg-white shadow-sm text-[#1E6A6A]' : 'text-gray-500'}`}>
          By booking
        </button>
        <button onClick={() => setView('property')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'property' ? 'bg-white shadow-sm text-[#1E6A6A]' : 'text-gray-500'}`}>
          By property (availability)
        </button>
      </div>

      {view === 'booking' ? (
        <div className="space-y-2">
          {PROPERTIES.flatMap(p => p.bookings.map(b => ({ ...b, prop: p }))).map(b => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center">
                  <Home size={20} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{b.prop.title}</h3>
                    {b.is_current && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: '#FEF3C7', color: '#A16207' }}>IN PROGRESS</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-2"><MapPin size={11} className="inline" /> {b.prop.area}</p>
                  <p className="text-sm text-gray-700"><strong>{b.renter}</strong> · {b.start} → {b.end}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {b.contract_signed
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#DCFCE7', color: COLORS.green }}><FileSignature size={10} />Contract signed</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#FEF3C7', color: COLORS.amber }}><FileSignature size={10} />Awaiting contract</span>}
                    {b.cancellation_requested && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#FEE2E2', color: COLORS.red }}><XCircle size={10} />Cancellation requested</span>}
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-lg border border-[#1E6A6A] text-[#1E6A6A] text-xs font-semibold shrink-0">
                  <MessageCircle size={12} className="inline mr-1" />Message
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {PROPERTIES.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center">
                  <Home size={22} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 mb-0.5">{p.title}</h3>
                  <p className="text-xs text-gray-500 mb-2"><MapPin size={11} className="inline" /> {p.area} · <Bed size={11} className="inline" /> {p.bedrooms}bd</p>
                  <OccupancyBar pct={p.occupancy} />
                  <p className="text-[11px] text-gray-500 mt-1">{p.booked_days} of 90 days booked · {p.vacant_days} vacant</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={p.status} />
                  <p className="text-xs font-medium text-gray-700 mt-1">
                    {p.status === 'available' ? 'Free to list' : `Free ${p.next_available}`}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Tiny calendar visualization — renders a single month grid with booked
// days highlighted. Used inside the expanded property card so the lister
// sees the booked-date pattern at a glance.
const MiniCalendar = ({ year, month, bookings }) => {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstOfMonth.getDay(); // 0 = Sun
  const monthLabel = firstOfMonth.toLocaleString('en-US', { month: 'short', year: 'numeric' });

  const isBookedOn = (day) => {
    const d = new Date(year, month, day);
    for (const b of bookings) {
      const bs = new Date(b.start);
      const be = new Date(b.end);
      if (d >= bs && d <= be) return b.status;
    }
    return null;
  };

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const colorFor = (s) => s === 'confirmed' ? COLORS.green : s === 'pending' ? COLORS.blue : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2">
      <div className="text-[11px] font-semibold text-gray-700 mb-1 text-center">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-0.5 text-[9px] text-gray-400 text-center mb-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} />;
          const status = isBookedOn(day);
          const bg = colorFor(status);
          return (
            <div
              key={i}
              className="aspect-square flex items-center justify-center text-[9px] rounded transition-colors"
              style={{
                backgroundColor: bg ? `${bg}` : 'transparent',
                color: bg ? '#fff' : '#6B7280',
                fontWeight: bg ? 600 : 400,
              }}
              title={status ? `${status} booking` : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Option B: Stacked / Expandable ─────────────────────────────────────
const OptionStacked = () => {
  const [open, setOpen] = useState(new Set(['p1']));
  // Pin the visual to May-Jul 2026 so the mock bookings actually line up.
  const VISIBLE_MONTHS = [
    { year: 2026, month: 4 },   // May
    { year: 2026, month: 5 },   // June
    { year: 2026, month: 6 },   // July
  ];
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">My Bookings</h1>
      <p className="text-sm text-gray-500 mb-5">Each property shows its availability and all reservations.</p>
      <div className="space-y-3">
        {PROPERTIES.map(p => {
          const isOpen = open.has(p.id);
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(prev => {
                const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n;
              })} className="w-full flex items-start gap-4 p-4 text-left">
                <div className="w-16 h-16 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center">
                  <Home size={22} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 mb-0.5">{p.title}</h3>
                  <p className="text-xs text-gray-500"><MapPin size={11} className="inline" /> {p.area} · <Bed size={11} className="inline" /> {p.bedrooms}bd · {p.bookings.length} booking{p.bookings.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={p.status} />
                  <p className="text-xs font-medium text-gray-700 mt-1">
                    {p.status === 'available' ? 'Free to list' : `Free ${p.next_available}`}
                  </p>
                </div>
                <ChevronRight size={18} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 space-y-3">
                  {p.bookings.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">No bookings yet — open to take new reservations.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {p.bookings.map(b => <BookingChip key={b.id} b={b} />)}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Booked dates</p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: COLORS.green }} />Confirmed</span>
                            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: COLORS.blue }} />Pending</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {VISIBLE_MONTHS.map(m => (
                            <MiniCalendar
                              key={`${m.year}-${m.month}`}
                              year={m.year}
                              month={m.month}
                              bookings={p.bookings}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Option C: Calendar / Timeline ──────────────────────────────────────
const OptionCalendar = () => {
  const months = ['May 2026', 'Jun 2026', 'Jul 2026'];
  // Mock visual position for each booking
  const bars = [
    { propId: 'p1', renter: 'Sarah Cohen', startCol: 1, span: 1, color: COLORS.gold, status: 'In progress', contract: 'Signed' },
    { propId: 'p1', renter: 'David Levi', startCol: 2, span: 1, color: COLORS.blue, status: 'Pending', contract: 'Awaiting' },
    { propId: 'p2', renter: 'Rachel Adler', startCol: 2, span: 1, color: COLORS.green, status: 'Confirmed', contract: 'Signed' },
    { propId: 'p2', renter: 'Avi Stern', startCol: 3, span: 1, color: COLORS.red, status: 'Cancel requested', contract: 'Awaiting' },
    { propId: 'p4', renter: 'Yosef Klein', startCol: 1, span: 3, color: COLORS.gold, status: 'In progress', contract: 'Signed' },
  ];
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">My Bookings</h1>
      <p className="text-sm text-gray-500 mb-5">Timeline view across all properties. Click a block for details.</p>

      <div className="flex items-center gap-3 mb-4 text-xs">
        <span className="font-semibold text-gray-700">Legend:</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: COLORS.gold }} />Booked</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: COLORS.blue }} />Pending</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: COLORS.green }} />Confirmed</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: COLORS.red }} />Cancel request</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200" />Available</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[200px_repeat(3,1fr)] border-b border-gray-200 bg-gray-50">
          <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</div>
          {months.map(m => <div key={m} className="p-3 text-xs font-semibold text-gray-700 border-l border-gray-200">{m}</div>)}
        </div>
        {PROPERTIES.map(p => (
          <div key={p.id} className="grid grid-cols-[200px_repeat(3,1fr)] border-b border-gray-100 last:border-b-0 min-h-[60px]">
            <div className="p-3 border-r border-gray-100">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
              <p className="text-[10px] text-gray-500">{p.bedrooms}bd · {p.rental_type}</p>
            </div>
            {months.map((m, mi) => (
              <div key={m} className="relative border-l border-gray-100 p-1">
                {bars.filter(b => b.propId === p.id && b.startCol === mi + 1).map((b, bi) => (
                  <div key={bi}
                    className="absolute inset-y-1 left-1 right-1 rounded px-2 py-1 text-[10px] text-white shadow-sm truncate"
                    style={{ backgroundColor: b.color, width: `calc(${b.span * 100}% - 8px)` }}>
                    <div className="font-bold truncate">{b.renter}</div>
                    <div className="opacity-90 truncate">{b.contract === 'Signed' ? '✓ Signed' : '⏳ Contract'}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-gradient-to-br from-[#1E6A6A]/5 to-[#D4AF37]/10 rounded-xl border border-[#1E6A6A]/20">
        <p className="text-xs text-gray-600">
          <strong className="text-[#1E6A6A]">Side panel preview:</strong> Clicking any colored block in the timeline opens a side panel with the renter contact, contract status, dates, and one-click actions for accept/cancel/message.
        </p>
      </div>
    </div>
  );
};

const MergePreview = () => {
  const { layout } = useParams();
  const Body = layout === 'stacked' ? OptionStacked : layout === 'calendar' ? OptionCalendar : OptionToggle;
  return (
    <div className="min-h-screen pt-[140px] sm:pt-[160px] md:pt-[220px] bg-gray-50">
      <Body />
    </div>
  );
};

export default MergePreview;
