/**
 * Super Admin → Restaurants: the kosher directory's back office.
 *
 * Four jobs, top to bottom: how many per city and how many still
 * unverified; owners' "Get listed" requests to approve or reject; the
 * places themselves, by status (listed, held back, removed), each editable
 * in place with a "Certificate checked" switch; and adding one by hand.
 *
 * Held back = the website check found no named hechsher. They are the
 * review queue: a person who knows the place lists it with one click.
 * "Remove" is a status, never a delete, so it can be undone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BadgeCheck, Check, ExternalLink, Loader2, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import { API } from '../../App';

const BORDER = 'var(--brand-border)';
const input = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm';
const STATUSES = [['listed', 'Listed'], ['hidden', 'Held back'], ['removed', 'Removed']];
const EDITABLE = ['name_en', 'name_he', 'certification', 'kashrut', 'phone', 'whatsapp', 'website', 'address'];

function Editor({ row, onSave, onCancel }) {
  const [f, setF] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, row[k] || ''])));
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {EDITABLE.map((k) => (
        <label key={k} className="text-xs text-gray-500">
          {k.replace('_', ' ')}
          {k === 'kashrut' ? (
            <select className={input} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
              <option value="">not set</option><option value="meat">meat</option>
              <option value="dairy">dairy</option><option value="pareve">pareve</option>
            </select>
          ) : (
            <input className={input} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} dir="auto" />
          )}
        </label>
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={() => onSave(f)} className="rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white">Save</button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600">Cancel</button>
      </div>
    </div>
  );
}

export default function RestaurantsTab({ token }) {
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [stats, setStats] = useState(null);
  const [subs, setSubs] = useState([]);
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('listed');
  const [city, setCity] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({ city: 'Jerusalem', name_en: '', name_he: '', certification: '', kashrut: '', phone: '', website: '' });

  const [reports, setReports] = useState([]);
  const [claims, setClaims] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadStats = useCallback(() => {
    axios.get(`${API}/admin/restaurants/stats`, auth).then((r) => setStats(r.data)).catch(() => {});
    axios.get(`${API}/admin/restaurants/submissions`, auth).then((r) => setSubs(r.data)).catch(() => {});
    axios.get(`${API}/admin/restaurants/reports`, auth).then((r) => setReports(r.data)).catch(() => {});
    axios.get(`${API}/admin/restaurants/claims`, auth).then((r) => setClaims(r.data)).catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // The places found on a developer's machine (scripts/export_restaurants.py)
  // arrive here as one file; the server keeps anything already edited.
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = JSON.parse(await file.text());
      const { data } = await axios.post(`${API}/admin/restaurants/import`, body, auth);
      toast.success(`Loaded: ${data.new} new, ${data.updated} updated, ${data.kept_edits} kept as edited`);
      load(); loadStats();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'That file could not be loaded');
    } finally {
      setUploading(false);
    }
  };

  const resolveReport = async (id) => {
    await axios.post(`${API}/admin/restaurants/reports/${id}/resolve`, {}, auth).catch(() => {});
    loadStats();
  };
  const decideClaim = async (id, d) => {
    try {
      await axios.post(`${API}/admin/restaurants/claims/${id}/${d}`, {}, auth);
      toast.success(d === 'approve' ? 'Approved, the owner has been emailed' : 'Rejected');
      loadStats();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not do that');
    }
  };

  const load = useCallback(() => {
    setRows(null);
    axios.get(`${API}/admin/restaurants`, {
      ...auth, params: { status, city: city || undefined, verified: unverified ? false : undefined, q: q || undefined, limit: 200 },
    }).then((r) => { setRows(r.data.items); setTotal(r.data.total); }).catch(() => setRows([]));
  }, [status, city, unverified, q, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { load(); }, [load]);

  const patch = async (id, body, msg) => {
    setBusy(id);
    try {
      await axios.patch(`${API}/admin/restaurants/${encodeURIComponent(id)}`, body, auth);
      toast.success(msg || 'Saved');
      setEditing(null);
      load(); loadStats();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  const decide = async (id, d) => {
    try {
      await axios.post(`${API}/admin/restaurants/submissions/${id}/${d}`, {}, auth);
      toast.success(d === 'approve' ? 'Listed' : 'Rejected');
      loadStats(); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not do that');
    }
  };

  const addOne = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/restaurants`, add, auth);
      toast.success('Added');
      setAdding(false);
      load(); loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not add');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-restaurants">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[['Listed', stats.listed], ['Not yet checked by a person', stats.unverified], ['Held back for review', stats.hidden], ['Owner requests', stats.pending_submissions + (stats.pending_claims || 0)], ['Reported changes', stats.open_reports || 0]].map(([k, v]) => (
            <div key={k} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
              <div className="text-xs text-gray-500">{k}</div>
              <div className="text-2xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <details className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <summary className="cursor-pointer text-sm font-semibold">Per city</summary>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-start text-xs text-gray-500"><th className="text-start">City</th><th>Region</th><th>Listed</th><th>Unchecked</th><th>Held back</th></tr></thead>
            <tbody>
              {stats.cities.filter((c) => c.listed || c.hidden).map((c) => (
                <tr key={c.city} className="border-t" style={{ borderColor: BORDER }}>
                  <td><button type="button" className="font-semibold text-[var(--brand-primary)]" onClick={() => setCity(c.city)}>{c.city}</button></td>
                  <td className="text-center">{c.region}</td><td className="text-center">{c.listed}</td>
                  <td className="text-center">{c.unverified}</td><td className="text-center">{c.hidden}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {reports.length > 0 && (
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }} data-testid="admin-restaurant-reports">
          <h3 className="text-sm font-semibold">Reported changes</h3>
          {reports.map((r) => (
            <div key={r.id} className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t pt-3 text-sm" style={{ borderColor: BORDER }}>
              <div>
                <div className="font-semibold" dir="auto">{r.restaurant?.name || r.place_id} <span className="font-normal text-gray-500">· {r.restaurant?.city}</span></div>
                <div>{r.kind.replace('_', ' ')}{r.note ? `: ${r.note}` : ''}</div>
                {r.email && <div className="text-gray-500">{r.email}</div>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setQ(r.restaurant?.name || ''); setStatus('listed'); }} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: BORDER }}>Find it</button>
                <button type="button" onClick={() => resolveReport(r.id)} className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Done</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {claims.length > 0 && (
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }} data-testid="admin-restaurant-claims">
          <h3 className="text-sm font-semibold">Owners claiming a listing</h3>
          {claims.map((c) => (
            <div key={c.id} className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t pt-3 text-sm" style={{ borderColor: BORDER }}>
              <div>
                <div className="font-semibold" dir="auto">{c.restaurant?.name || c.place_id} <span className="font-normal text-gray-500">· {c.restaurant?.city}</span></div>
                <div dir="auto">{c.name}{c.role ? ` (${c.role})` : ''} · {c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => decideClaim(c.id, 'approve')} className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Approve and email</button>
                <button type="button" onClick={() => decideClaim(c.id, 'reject')} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: BORDER }}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {subs.length > 0 && (
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <h3 className="text-sm font-semibold">Owner requests</h3>
          {subs.map((s) => (
            <div key={s.id} className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t pt-3 text-sm" style={{ borderColor: BORDER }}>
              <div>
                <div className="font-semibold" dir="auto">{s.name} <span className="font-normal text-gray-500">· {s.city}</span></div>
                <div>{s.certification}{s.kashrut ? ` · ${s.kashrut}` : ''}</div>
                <div className="text-gray-500">{[s.phone, s.whatsapp && `WA ${s.whatsapp}`, s.website, s.contact_email].filter(Boolean).join(' · ')}</div>
                {s.note && <div className="text-gray-500" dir="auto">{s.note}</div>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => decide(s.id, 'approve')} className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Approve</button>
                <button type="button" onClick={() => decide(s.id, 'reject')} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: BORDER }}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setStatus(k)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${status === k ? 'bg-black text-white' : 'bg-white'}`} style={{ borderColor: BORDER }}>{l}</button>
        ))}
        <label className="ms-2 inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} /> Not yet checked
        </label>
        {city && (
          <button type="button" onClick={() => setCity('')} className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-sm" style={{ borderColor: BORDER }}>
            {city} <X size={13} />
          </button>
        )}
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative ms-auto">
          <Search size={15} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or website" className="rounded-full border py-1.5 pe-3 ps-8 text-sm" style={{ borderColor: BORDER }} />
        </form>
        <button type="button" onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold" style={{ borderColor: BORDER }}>
          <Plus size={14} /> Add a restaurant
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold" style={{ borderColor: BORDER }} data-testid="admin-restaurants-upload">
          <Upload size={14} /> {uploading ? 'Loading…' : 'Load restaurants file'}
          <input type="file" accept="application/json,.json" className="hidden" disabled={uploading}
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>

      {adding && (
        <form onSubmit={addOne} className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-3" style={{ borderColor: BORDER }}>
          <select className={input} value={add.city} onChange={(e) => setAdd({ ...add, city: e.target.value })}>
            {(stats?.cities || []).map((c) => <option key={c.city}>{c.city}</option>)}
          </select>
          {['name_en', 'name_he', 'certification', 'phone', 'website'].map((k) => (
            <input key={k} className={input} placeholder={k.replace('_', ' ')} value={add[k]} dir="auto"
              onChange={(e) => setAdd({ ...add, [k]: e.target.value })} />
          ))}
          <select className={input} value={add.kashrut} onChange={(e) => setAdd({ ...add, kashrut: e.target.value })}>
            <option value="">meat / dairy / pareve</option><option value="meat">meat</option><option value="dairy">dairy</option><option value="pareve">pareve</option>
          </select>
          <button type="submit" className="rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white">Add</button>
        </form>
      )}

      <div className="text-sm text-gray-500">{rows ? `${total} places` : ''}</div>
      {!rows ? <Loader2 className="animate-spin text-gray-400" /> : rows.map((r) => (
        <div key={r.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold" dir="auto">
                {r.name_en || r.name_he || <span className="text-amber-700">No name yet</span>}
                {r.name_en && r.name_he && <span className="ms-2 font-normal text-gray-500">{r.name_he}</span>}
              </div>
              <div className="text-sm text-gray-600">
                {[r.neighborhood, r.city].filter(Boolean).join(', ')} · {r.categories.join(', ') || 'no category'}
                {r.kashrut ? ` · ${r.kashrut}` : ''}
              </div>
              <div className="text-sm">
                {r.certification || <span className="text-gray-500">No hechsher named</span>}
                {r.verified && <span className="ms-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1F8A50]"><BadgeCheck size={13} /> checked</span>}
              </div>
              {r.check?.snippet && <div className="mt-1 max-w-2xl text-xs text-gray-500" dir="auto">“{r.check.snippet}”</div>}
              {r.needs_review?.length > 0 && <div className="mt-1 text-xs text-amber-700">{r.needs_review.join('; ')}</div>}
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                {r.website && <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-primary)]"><ExternalLink size={12} /> site</a>}
                {r.google_place && <a href={`https://www.google.com/maps/place/?q=place_id:${r.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-primary)]"><ExternalLink size={12} /> Google Maps</a>}
                {r.phone && <span>{r.phone}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy === r.id}
                onClick={() => patch(r.id, { verified: !r.verified }, r.verified ? 'Unchecked' : 'Marked as checked')}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: BORDER }}>
                <Check size={13} /> {r.verified ? 'Uncheck' : 'Certificate checked'}
              </button>
              <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: BORDER }}>
                <Pencil size={13} /> Edit
              </button>
              {status !== 'listed' && (
                <button type="button" onClick={() => patch(r.id, { status: 'listed' }, 'Listed')}
                  className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">List it</button>
              )}
              {status !== 'removed' && (
                <button type="button" onClick={() => patch(r.id, { status: 'removed' }, 'Removed')}
                  className="rounded-full border px-3 py-1 text-xs font-semibold text-gray-600" style={{ borderColor: BORDER }}>Remove</button>
              )}
            </div>
          </div>
          {editing === r.id && <Editor row={r} onCancel={() => setEditing(null)} onSave={(f) => patch(r.id, f)} />}
        </div>
      ))}
    </div>
  );
}
