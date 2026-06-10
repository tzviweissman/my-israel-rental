import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, ArrowRight, AlertTriangle,
  CheckCircle2, Loader2, Wand2, Users, Home as HomeIcon,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin → Import tab.
 *
 * Single unified workflow — paste any CSV (properties OR users) and the
 * backend auto-detects which canonical schema it should be mapped against.
 * No more separate "Import Properties" vs "Import Users" buttons.
 *
 * Two-step workflow:
 *   1. Paste CSV or upload .csv file → click Preview. Backend AI-maps the
 *      columns to our canonical schema (auto-classifying property vs user
 *      from the headers), and returns the detected kind alongside the
 *      column map.
 *   2. Admin reviews the mapping (the detected kind is shown as a small
 *      badge — clickable to override if the heuristic guessed wrong), then
 *      clicks Commit. Backend creates owners/users/properties, mirrors
 *      images to Cloudinary, dedupes, and emails "set your password" links.
 */
export const ImportTab = ({ token }) => {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  // The schema kind currently in effect for this preview. Starts as
  // whatever the backend detected; the admin can flip it without
  // re-uploading the CSV (we just re-run preview with the override).
  const [schemaKind, setSchemaKind] = useState(null); // "property" | "user" | null
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

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
      toast.error(e.response?.data?.detail || 'Preview failed');
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
        { csv_text: csvText, column_map: preview.column_map, mirror_images: true },
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
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <details className="text-xs mb-4">
            <summary className="cursor-pointer text-gray-600 font-medium">Show first 5 rows (remapped)</summary>
            <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-[10px]">
              {JSON.stringify(preview.sample_rows, null, 2)}
            </pre>
          </details>

          <button
            onClick={commit}
            disabled={committing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
            data-testid="import-commit-btn"
          >
            {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {committing ? 'Importing…' : `Commit import (${preview.total_rows} rows)`}
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
                {result.skipped.map((s, i) => (
                  <li key={i} className="border border-red-100 bg-red-50 rounded px-2 py-1.5">
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
                {result.owners_created.map((o, i) => (
                  <li key={i} className="border border-green-100 bg-green-50 rounded px-2 py-1.5">
                    {o.email} — sent &quot;set password&quot; email
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.created?.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-gray-700">{result.created.length} created</summary>
              <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {result.created.map((c, i) => (
                  <li key={i} className="text-gray-600">
                    {c.title || c.email} <span className="font-mono text-[10px] text-gray-400">{c.id?.slice(0, 8)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
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
