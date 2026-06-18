import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, ArrowRight, AlertTriangle,
  CheckCircle2, Loader2, Wand2, Users, Home as HomeIcon, Plus,
} from 'lucide-react';
import QuickAddPropertyForm from './QuickAddPropertyForm';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin → Import tab.
 *
 * Two flows live here:
 *
 *  • Quick Add (default) — a friendly form for adding ONE listing at a
 *    time. Admin fills in email, location, bedrooms, price, etc. and
 *    drops in photos / a short video; the backend creates the owner
 *    account (if new) and attaches the listing under it. Re-submissions
 *    with the same email accumulate under the same owner, so adding
 *    five listings for one landlord takes ~5 form fills.
 *
 *  • Bulk CSV — unified property/user CSV importer. Paste a CSV, the
 *    backend auto-detects whether it's a list of properties or users
 *    from the headers, AI-maps the columns to our canonical schema,
 *    and the admin reviews + commits.
 */
export const ImportTab = ({ token, onJumpToOwner }) => {
  const [flow, setFlow] = useState('quick'); // 'quick' | 'bulk'
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  // The schema kind currently in effect for this preview. Starts as
  // whatever the backend detected; the admin can flip it without
  // re-uploading the CSV (we just re-run preview with the override).
  const [schemaKind, setSchemaKind] = useState(null); // "property" | "user" | null
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  // "create" (default): skip existing rows. "sync_photos": when a row
  // matches an existing listing, refresh its photos instead of skipping —
  // recovery path after a half-finished import left some listings
  // photo-less.
  const [commitMode, setCommitMode] = useState('create');

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    setPreview(null);
    setSchemaKind(null);
    setResult(null);
  };

  const runPreview = async (overrideKind = null) => {
    if (!csvText.trim()) return toast.error('Paste a CSV first');
    setLoading(true); setResult(null);
    try {
      const res = await axios.post(
        `${API}/admin/import/preview`,
        { csv_text: csvText, schema_kind: overrideKind || 'auto' },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPreview(res.data);
      setSchemaKind(res.data.detected_schema_kind || 'property');
      if (res.data.warnings?.length) {
        toast.warning(res.data.warnings.join(' '), { duration: 6000 });
      } else {
        const kind = res.data.detected_schema_kind === 'user' ? 'users' : 'properties';
        toast.success(`Detected ${kind} — ${res.data.total_rows} rows ready to import`);
      }
    } catch (e) {
      // Build a maximally informative error message so we don't leave the
      // admin staring at a generic "Preview failed". We surface the HTTP
      // status, the server's `detail` if present, or a short snippet of
      // the response body — covers backend 4xx/5xx, ingress 502/504,
      // and total network failures with separate copy.
      const resp = e.response;
      let msg;
      if (!resp) {
        msg = `Couldn't reach the server (${e.message || 'network error'}). Check your connection and try again.`;
      } else {
        const detail = typeof resp.data?.detail === 'string' ? resp.data.detail : null;
        const bodySnippet = !detail && typeof resp.data === 'string'
          ? resp.data.slice(0, 160)
          : null;
        msg = `Preview failed (HTTP ${resp.status})${detail ? `: ${detail}` : bodySnippet ? `: ${bodySnippet}` : ''}`;
        if (resp.status === 401) msg = 'Preview failed (HTTP 401) — your session expired. Please log out and back in.';
        if (resp.status === 413) msg = 'Preview failed (HTTP 413) — your CSV is too large for the server. Try splitting it into smaller batches.';
        if (resp.status === 502 || resp.status === 504) msg = `Preview failed (HTTP ${resp.status}) — the server took too long. Try a smaller CSV or retry in a moment.`;
      }
      toast.error(msg, { duration: 10000 });
      // Also log so the admin can paste from devtools if asked.
      // eslint-disable-next-line no-console
      console.error('[admin import] preview failed:', { status: resp?.status, data: resp?.data, error: e.message });
    } finally { setLoading(false); }
  };

  const updateMapping = (sourceCol, target) => {
    setPreview((p) => p && { ...p, column_map: { ...p.column_map, [sourceCol]: target || null } });
  };

  const commit = async () => {
    if (!preview || !schemaKind) return;
    setCommitting(true); setResult(null);
    try {
      const url = schemaKind === 'user'
        ? `${API}/admin/import/users/commit`
        : `${API}/admin/import/properties/commit`;
      const res = await axios.post(
        url,
        { csv_text: csvText, column_map: preview.column_map, mirror_images: true, mode: commitMode },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 600000 },  // 10 min for Cloudinary mirroring
      );
      setResult(res.data);
      const kindLabel = schemaKind === 'user' ? 'users' : 'properties';
      const { created, skipped } = res.data.summary;
      if (created > 0 && skipped === 0) toast.success(`Imported ${created} ${kindLabel}`);
      else if (created > 0) toast.success(`Imported ${created}, skipped ${skipped} — see report below`);
      else toast.error(`No rows imported — ${skipped} skipped, see report`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Commit failed');
    } finally { setCommitting(false); }
  };

  const overrideKind = (newKind) => {
    if (newKind === schemaKind) return;
    // Re-run preview with the manual override so column mapping switches
    // to the right canonical schema.
    runPreview(newKind);
  };

  const reset = () => {
    setCsvText(''); setPreview(null); setSchemaKind(null); setResult(null);
  };

  const propertyTargets = [
    'title','description','area','address','rental_type','property_type',
    'bedrooms','bathrooms','floor','square_meters','monthly_price','nightly_price',
    'currency','available_from','starting_date','minimum_booking_days',
    'condition','furniture_option','porches','sukkah_compatible',
    'amenities','images','videos',
    'owner_email','owner_name','owner_phone',
  ];
  const userTargets = ['email','name','phone','role'];
  const targets = schemaKind === 'user' ? userTargets : propertyTargets;

  return (
    <div data-testid="admin-import-section">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Import data</h2>
      </div>

      {/* Flow toggle — Quick Add (one listing + photos) vs Bulk CSV */}
      <div className="flex gap-2 mb-5" data-testid="import-flow-toggle">
        <button
          type="button"
          onClick={() => setFlow('quick')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            flow === 'quick'
              ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          data-testid="import-flow-quick"
        >
          <Plus size={14} /> Quick Add (one listing + photos)
        </button>
        <button
          type="button"
          onClick={() => setFlow('bulk')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            flow === 'bulk'
              ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          data-testid="import-flow-bulk"
        >
          <FileSpreadsheet size={14} /> Bulk CSV
        </button>
      </div>

      {flow === 'quick' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-900 leading-relaxed">
          <div className="flex items-start gap-2">
            <Wand2 size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">How this works</p>
              <p>
                Fill in the listing details and drop in the photos. If the email
                doesn&apos;t already have an account, one is created automatically and
                the owner gets a &quot;set your password&quot; email. Re-submit with the
                same email to add another listing under the same owner — handy
                when a landlord has several units to add at once.
              </p>
            </div>
          </div>
        </div>
      )}

      {flow === 'quick' && <QuickAddPropertyForm token={token} onJumpToOwner={onJumpToOwner} />}

      {flow === 'bulk' && (
        <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-900 leading-relaxed">
        <div className="flex items-start gap-2">
          <Wand2 size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">How this works</p>
            <p>
              Paste a CSV (or upload a .csv file). The system auto-detects whether
              the file is a list of <strong>properties</strong> or <strong>users</strong> from its
              column headers, AI-maps the source columns to our canonical schema,
              and shows you a preview. You review the detection and mapping, then
              click Commit. Property owners are auto-created and emailed a
              &quot;set password&quot; link; images are mirrored to Cloudinary. Duplicates
              (same owner+address+rental_type) are skipped automatically.
            </p>
          </div>
        </div>
      </div>

      {/* CSV input */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <label className="block text-sm font-medium mb-2">Paste CSV</label>
        <textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null); setSchemaKind(null); setResult(null); }}
          placeholder={'Properties: "3BR in Sanhedria","Sanhedria",3,8500,owner@example.com\nUsers:      jane@example.com,Jane Doe,054-1234567,renter'}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 font-mono text-xs h-40 focus:border-[#1E6A6A] focus:outline-none focus:ring-1 focus:ring-[#1E6A6A]/40"
          data-testid="import-csv-textarea"
        />
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium cursor-pointer hover:bg-gray-50">
            <Upload size={14} /> Upload .csv
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPickFile} data-testid="import-file-input" />
          </label>
          <button
            onClick={() => runPreview()}
            disabled={loading || !csvText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E6A6A] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#175555]"
            data-testid="import-preview-btn"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {loading ? 'Mapping columns…' : 'Preview'}
          </button>
          {csvText && (
            <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
          )}
        </div>
      </div>

      {/* Preview & mapping */}
      {preview && schemaKind && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4" data-testid="import-preview">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold">Column mapping ({preview.total_rows} rows)</h3>
            {/* Detected-kind badge with a click-to-flip override. Lets the
                admin correct the heuristic if it guessed wrong without
                re-uploading the CSV. */}
            <div className="flex items-center gap-1.5" data-testid="import-detected-kind">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 mr-1">Detected:</span>
              <button
                type="button"
                onClick={() => overrideKind('property')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  schemaKind === 'property'
                    ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                data-testid="import-kind-properties"
              >
                <HomeIcon size={12} /> Properties
              </button>
              <button
                type="button"
                onClick={() => overrideKind('user')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  schemaKind === 'user'
                    ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                data-testid="import-kind-users"
              >
                <Users size={12} /> Users
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-h-72 overflow-y-auto">
            {preview.headers.map((h) => (
              <label key={h} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate font-mono text-gray-700 bg-gray-50 px-2 py-1.5 rounded" title={h}>{h}</span>
                <ArrowRight size={12} className="text-gray-400 shrink-0" />
                <select
                  value={preview.column_map[h] || ''}
                  onChange={(e) => updateMapping(h, e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-xs"
                  data-testid={`import-map-${h}`}
                >
                  <option value="">— Ignore —</option>
                  {targets.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            ))}
          </div>

          {preview.warnings?.length > 0 && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <ul className="text-amber-800 list-disc pl-4 space-y-0.5">
                {preview.warnings.map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
              </ul>
            </div>
          )}

          <details className="text-xs mb-4">
            <summary className="cursor-pointer text-gray-600 font-medium">Show first 5 rows (remapped)</summary>
            <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-[10px]">
              {JSON.stringify(preview.sample_rows, null, 2)}
            </pre>
          </details>

          {schemaKind === 'property' && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="commit-mode-toggle">
              <p className="text-xs font-semibold text-amber-900 mb-2">On rows that already exist (same owner + address):</p>
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${
                  commitMode === 'create' ? 'bg-white border-amber-400 text-amber-900 font-semibold' : 'bg-transparent border-amber-200 text-amber-800'
                }`}>
                  <input type="radio" name="commit-mode" value="create" checked={commitMode === 'create'}
                    onChange={() => setCommitMode('create')} className="accent-amber-600" data-testid="commit-mode-create" />
                  Skip duplicates (default)
                </label>
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${
                  commitMode === 'sync_photos' ? 'bg-white border-amber-400 text-amber-900 font-semibold' : 'bg-transparent border-amber-200 text-amber-800'
                }`}>
                  <input type="radio" name="commit-mode" value="sync_photos" checked={commitMode === 'sync_photos'}
                    onChange={() => setCommitMode('sync_photos')} className="accent-amber-600" data-testid="commit-mode-sync" />
                  Sync photos onto existing listings
                </label>
              </div>
              {commitMode === 'sync_photos' && (
                <p className="text-[11px] text-amber-800 mt-2 leading-snug">
                  Recovery mode: use this when a previous import left listings without photos. Existing listings will get their <code className="bg-white px-1 rounded">images</code>/<code className="bg-white px-1 rounded">videos</code> replaced with the CSV&apos;s and re-mirrored to Cloudinary. Listings already fully on Cloudinary are skipped.
                </p>
              )}
            </div>
          )}

          <button
            onClick={commit}
            disabled={committing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
            data-testid="import-commit-btn"
          >
            {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {committing ? 'Importing…' : commitMode === 'sync_photos' ? `Sync photos (${preview.total_rows} rows)` : `Commit import (${preview.total_rows} rows)`}
          </button>
          {schemaKind === 'property' && (
            <p className="text-[11px] text-gray-500 mt-2">
              Image mirroring may take a minute or two on rows with many photos.
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-4" data-testid="import-result">
          <h3 className="font-bold mb-3">Import report</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="Total" value={result.summary.total} />
            <Stat label="Created" value={result.summary.created} positive />
            <Stat label="Skipped" value={result.summary.skipped} negative={result.summary.skipped > 0} />
            {schemaKind === 'property' && (
              <Stat label="New owners" value={result.summary.owners_created || 0} />
            )}
          </div>
          {result.skipped?.length > 0 && (
            <details open className="text-xs mb-3">
              <summary className="cursor-pointer font-semibold text-red-700">{result.skipped.length} rows skipped</summary>
              <ul className="mt-2 space-y-1">
                {result.skipped.map((s) => (
                  <li key={`skip-${s.index}-${s.title || ''}`} className="border border-red-100 bg-red-50 rounded px-2 py-1.5">
                    <span className="font-semibold">Row {s.index}{s.title ? ` (${s.title})` : ''}:</span> {s.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.owners_created?.length > 0 && (
            <details className="text-xs mb-3">
              <summary className="cursor-pointer font-semibold text-green-700">{result.owners_created.length} new owner accounts created</summary>
              <ul className="mt-2 space-y-1">
                {result.owners_created.map((o) => (
                  <li key={o.email} className="border border-green-100 bg-green-50 rounded px-2 py-1.5">
                    {o.email} — sent &quot;set password&quot; email
                  </li>
                ))}
              </ul>
            </details>
          )}
          {/* Photos issue report — only relevant for property imports.
              Surfaces partial-mirror failures so the admin can re-upload
              by hand or fix the source URLs. */}
          {result.media_issues?.length > 0 && (
            <details open className="text-xs mb-3">
              <summary className="cursor-pointer font-semibold text-amber-700">
                {result.media_issues.length} {result.media_issues.length === 1 ? 'listing' : 'listings'} created with missing photos
              </summary>
              <ul className="mt-2 space-y-1">
                {result.media_issues.map((m) => (
                  <li key={`media-${m.index}-${m.title || ''}`} className="border border-amber-100 bg-amber-50 rounded px-2 py-1.5">
                    <span className="font-semibold">Row {m.index}{m.title ? ` (${m.title})` : ''}:</span>
                    {' '}saved {m.saved_image_count} of {m.csv_image_count} photo URLs.
                    {m.failed_urls?.length > 0 && (
                      <ul className="mt-1 pl-4 list-disc text-[10px] font-mono text-amber-900">
                        {m.failed_urls.map((u, j) => (
                          <li key={`${m.index}-${j}-${u}`} className="truncate" title={u}>{u}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.summary?.mirror_pending_count > 0 && (
            <div className="text-[11px] bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-1.5 mb-3">
              Listings are live with their original photo URLs. We&apos;re mirroring
              {' '}<strong>{result.summary.mirror_pending_count}</strong>{' '}
              {result.summary.mirror_pending_count === 1 ? 'listing\'s photos' : 'listings\' photos'} to Cloudinary in the background — refresh in a minute to see the CDN-hosted versions.
            </div>
          )}
          {result.summary?.cloudinary_enabled === false && (
            <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1.5 mb-3">
              Cloudinary isn&apos;t configured on the server — photo URLs were saved as-is (no mirroring).
              If a source host disappears, the photos will too. Ask an admin to set
              <code className="bg-white px-1 mx-1 rounded font-mono">CLOUDINARY_*</code>
              env vars.
            </div>
          )}
          {result.created?.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-gray-700">{result.created.length} created</summary>
              <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {result.created.map((c, i) => (
                  <li key={c.id || c.email || `created-${i}`} className="text-gray-600 flex items-center gap-2">
                    <span className="flex-1 truncate">{c.title || c.email}</span>
                    {typeof c.images_count === 'number' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          c.images_count === 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                        title={c.images_count === 0 ? 'No photos saved — see above' : `${c.images_count} photos saved`}
                      >
                        {c.images_count} 📷
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-gray-400">{c.id?.slice(0, 8)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value, positive, negative }) => (
  <div className={`rounded-lg border p-2 text-center ${
    positive ? 'bg-green-50 border-green-200 text-green-800' :
    negative ? 'bg-red-50 border-red-200 text-red-800' :
    'bg-gray-50 border-gray-200 text-gray-800'
  }`}>
    <p className="text-[10px] uppercase tracking-wide font-semibold">{label}</p>
    <p className="text-xl font-bold">{value}</p>
  </div>
);

export default ImportTab;
