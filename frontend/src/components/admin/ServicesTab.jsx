/**
 * Super Admin → Services (spec A1).
 *
 * The console covered rentals only. Services became the lead offering and
 * had no admin surface at all — you could not see what was listed, let
 * alone act on a report about one.
 *
 * Deliberately thin. ListingsTab is 62 KB of list, filters, bulk actions,
 * duplicate detection, quick-add and mark-as-booked; copying that shape
 * for services would reproduce its maintenance problem before this tab
 * has earned it. A list, a search, and the two actions an admin actually
 * needs.
 *
 * Unpublish is a STATUS FLIP, never a delete, and it carries an undo. An
 * admin acting on a report needs to stop something showing immediately and
 * to put it back when the report turns out to be wrong; deleting would
 * take the reviews and the owner's work with it.
 *
 * `initialFilter` ('no-photo' | 'unverified') arrives from the attention
 * queue (spec A3 follow-up, dead-ends audit 2026-09-08): a count like
 * "N published services with no photo" is trivia unless the destination
 * can actually show which N. Both filters are just client-side predicates
 * over the same list this tab already loads — no new endpoint needed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Search, ExternalLink, EyeOff, Eye, Loader2, Undo2, ImageOff, BadgeCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '../../App';
import formatDate from '../../utils/formatDate';

const BORDER = 'var(--brand-border)';

export default function ServicesTab({ token, initialFilter = null }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [busyBizId, setBusyBizId] = useState(null);
  // Seeded from the attention queue's row, cleared once the admin acts on
  // it deliberately (a manual search, or the chip's own close button) —
  // it should not silently keep filtering a tab the admin navigated to
  // directly on a later click.
  const [filter, setFilter] = useState(initialFilter);
  // The last flip, so it can be undone. One deep: an admin who wants to
  // reverse five actions is better served by the list itself, and a stack
  // would let a stale entry restore something to a status it has since
  // moved on from.
  const [lastAction, setLastAction] = useState(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async (search = '') => {
    try {
      const { data } = await axios.get(`${API}/admin/gigs`, {
        ...auth,
        params: search ? { q: search } : undefined,
      });
      setRows(data);
    } catch {
      setRows([]);
      toast.error('Could not load services');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (gig, status, isUndo = false) => {
    setBusyId(gig.id);
    try {
      const { data } = await axios.patch(`${API}/admin/gigs/${gig.id}/status`, { status }, auth);
      setRows((prev) => prev.map((r) => (r.id === gig.id ? { ...r, status } : r)));
      if (!isUndo) {
        setLastAction({ gig, previous: data.previous_status, next: status });
      } else {
        setLastAction(null);
      }
    } catch {
      toast.error('That did not work');
    } finally {
      setBusyId(null);
    }
  };

  // Verification lives on the BUSINESS, not the gig (spec M5) — a business
  // can have several rows here, and all of them flip together.
  const toggleVerified = async (row) => {
    if (!row.business_id) return;
    const next = !row.business_verified;
    setBusyBizId(row.business_id);
    try {
      await axios.patch(`${API}/businesses/${row.business_id}/verified`, { verified: next }, auth);
      setRows((prev) => prev.map((r) => (
        r.business_id === row.business_id ? { ...r, business_verified: next } : r
      )));
    } catch {
      toast.error('That did not work');
    } finally {
      setBusyBizId(null);
    }
  };

  if (rows === null) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--brand-muted)' }}>
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );
  }

  const visibleRows = rows.filter((r) => {
    if (filter === 'no-photo') return r.status === 'published' && !r.has_photo;
    if (filter === 'unverified') return !r.business_verified;
    return true;
  });

  return (
    <div data-testid="admin-services-tab">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          Services ({visibleRows.length}{visibleRows.length !== rows.length ? ` of ${rows.length}` : ''})
        </h2>
        <form
          onSubmit={(e) => { e.preventDefault(); load(q); }}
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white"
            style={{ borderColor: BORDER }}>
            <Search size={14} style={{ color: 'var(--brand-muted)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title"
              className="text-sm outline-none w-48"
              data-testid="admin-services-search"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--brand-primary)' }}>
            Search
          </button>
        </form>
      </div>

      {/* The attention queue's promise made visible: whichever row an admin
          clicked to get here stays applied until they clear it. */}
      {filter && (
        <div
          className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.1)', color: 'var(--brand-primary)' }}
          data-testid="admin-services-filter-chip"
        >
          {filter === 'no-photo' ? 'Filtered: published, no photo' : 'Filtered: business not verified'}
          <button type="button" onClick={() => setFilter(null)} aria-label="Clear filter" data-testid="admin-services-filter-clear">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Undo sits above the table so it is visible without scrolling back
          to the row that was just changed. */}
      {lastAction && (
        <div
          className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg text-sm"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.08)', color: 'var(--ink)' }}
          data-testid="admin-services-undo"
        >
          <span>
            &ldquo;{lastAction.gig.title}&rdquo; is now {lastAction.next}.
          </span>
          <button
            type="button"
            onClick={() => setStatus(lastAction.gig, lastAction.previous, true)}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: 'var(--brand-primary)' }}
            data-testid="admin-services-undo-btn"
          >
            <Undo2 size={13} /> Undo
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="admin-services-empty">
          No services yet.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="admin-services-empty">
          Nothing matches this filter.
        </p>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: BORDER }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--brand-muted)' }}>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Business</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Area</th>
                <th className="px-3 py-2 font-semibold">From</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Photo</th>
                <th className="px-3 py-2 font-semibold">Verified</th>
                <th className="px-3 py-2 font-semibold">Created</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50" style={{ borderColor: BORDER }}
                  data-testid={`admin-service-${r.id}`}>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--ink)' }}>{r.title}</td>
                  <td className="px-3 py-2">
                    {/* A missing business is shown as missing, not papered
                        over with a placeholder name — it is a real state
                        worth noticing in the console. */}
                    {r.business_name || <span style={{ color: 'var(--brand-muted)' }}>— none —</span>}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--brand-muted)' }}>{r.category}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--brand-muted)' }}>{r.area}</td>
                  <td className="px-3 py-2">
                    {r.price_from != null ? `₪${r.price_from.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={r.status === 'published'
                        ? { background: '#E6F4EA', color: '#2E7D4F' }
                        : { background: '#F3F0E9', color: 'var(--brand-muted)' }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.has_photo ? (
                      <span style={{ color: 'var(--brand-muted)' }}>—</span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: '#FBECEC', color: '#B23B3B' }}
                        data-testid={`admin-service-no-photo-${r.id}`}
                      >
                        <ImageOff size={11} /> No photo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={!r.business_id || busyBizId === r.business_id}
                      onClick={() => toggleVerified(r)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold disabled:opacity-50"
                      style={r.business_verified
                        ? { background: '#E3F3EA', color: '#1F8A50' }
                        : { background: '#F3F0E9', color: 'var(--brand-muted)' }}
                      title={r.business_id ? 'Click to toggle' : 'No business to verify'}
                      data-testid={`admin-service-verified-${r.id}`}
                    >
                      <BadgeCheck size={11} /> {r.business_verified ? 'Verified' : 'Unverified'}
                    </button>
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--brand-muted)' }}>
                    {formatDate(String(r.created_at || '').slice(0, 10))}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a href={`/businesses/${r.id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold me-3"
                      style={{ color: 'var(--brand-primary)' }}
                      data-testid={`admin-service-open-${r.id}`}>
                      <ExternalLink size={12} /> Open
                    </a>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r, r.status === 'published' ? 'unpublished' : 'published')}
                      className="inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                      style={{ color: r.status === 'published' ? 'var(--brand-muted)' : 'var(--brand-primary)' }}
                      data-testid={`admin-service-toggle-${r.id}`}
                    >
                      {r.status === 'published' ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
