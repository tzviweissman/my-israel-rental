import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, Users, Home as HomeIcon, ArrowRight, AlertTriangle,
  CheckCircle2, Loader2, Wand2,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin → Import tab.
 *
 * Two-step workflow:
 *   1. Paste CSV or upload .csv file → click Preview. Backend AI-maps the
 *      columns to our canonical schema and returns a preview without
 *      writing anything.
 *   2. Admin tweaks the column mapping if necessary, then clicks Commit.
 *      Backend creates owners/users/properties, mirrors images to
 *      Cloudinary, dedupes, and emails "set your password" links.
 */
export const ImportTab = ({ token }) => {
  const [mode, setMode] = useState('properties'); // properties | users
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    setPreview(null);
    setResult(null);
  };

  const runPreview = async () => {
    if (!csvText.trim()) return toast.error('Paste a CSV first');
    setLoading(true); setResult(null);
    try {
      const res = await axios.post(
        `${API}/admin/import/preview`,
        { csv_text: csvText, schema_kind: mode === 'users' ? 'user' : 'property' },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPreview(res.data);
      if (res.data.warnings?.length) {
        toast.warning(res.data.warnings.join(' '), { duration: 6000 });
      } else {
        toast.success(`${res.data.total_rows} rows ready to import`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed');
    } finally { setLoading(false); }
  };

  const updateMapping = (sourceCol, target) => {
    setPreview((p) => p && { ...p, column_map: { ...p.column_map, [sourceCol]: target || null } });
  };

  const commit = async () => {
    if (!preview) return;
    setCommitting(true); setResult(null);
    try {
      const url = mode === 'users'
        ? `${API}/admin/import/users/commit`
        : `${API}/admin/import/properties/commit`;
      const res = await axios.post(
        url,
        { csv_text: csvText, column_map: preview.column_map, mirror_images: true },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 600000 },  // 10 min for Cloudinary mirroring
      );
      setResult(res.data);
      const { created, skipped } = res.data.summary;
      if (created > 0 && skipped === 0) toast.success(`Imported ${created} ${mode}`);
      else if (created > 0) toast.success(`Imported ${created}, skipped ${skipped} — see report below`);
      else toast.error(`No rows imported — ${skipped} skipped, see report`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Commit failed');
    } finally { setCommitting(false); }
  };

  const reset = () => {
    setCsvText(''); setPreview(null); setResult(null);
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
  const targets = mode === 'users' ? userTargets : propertyTargets;

  return (
    <div data-testid="admin-import-section">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Import data</h2>
      </div>

      {/* Mode picker */}
      <div className="flex gap-2 mb-5">
        {[
          { v: 'properties', label: 'Properties', Icon: HomeIcon },
          { v: 'users', label: 'Users', Icon: Users },
        ].map(({ v, label, Icon }) => (
          <button
            key={v}
            onClick={() => { setMode(v); setPreview(null); setResult(null); }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              mode === v
                ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            data-testid={`import-mode-${v}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-900 leading-relaxed">
        <div className="flex items-start gap-2">
          <Wand2 size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">How this works</p>
            <p>Paste a CSV (or upload a .csv file). AI auto-maps source columns to our schema. You review the mapping, then click Commit.
              {mode === 'properties' && ' Owners are auto-created and emailed a "set password" link. Images are mirrored to Cloudinary.'}
              {mode === 'users' && ' New users get an autogenerated password and a "set password" email.'}
              {' '}Duplicates (same owner+address+rental_type) are skipped automatically.
            </p>
          </div>
        </div>
      </div>

      {/* CSV input */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <label className="block text-sm font-medium mb-2">Paste CSV</label>
        <textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null); setResult(null); }}
          placeholder={mode === 'users'
            ? 'email,name,phone,role\njane@example.com,Jane Doe,054-1234567,renter'
            : 'Property Name,Neighborhood,Beds,Rent/month,Owner Email\n"3BR in Sanhedria","Sanhedria",3,8500,owner@example.com'}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 font-mono text-xs h-40 focus:border-[#1E6A6A] focus:outline-none focus:ring-1 focus:ring-[#1E6A6A]/40"
          data-testid="import-csv-textarea"
        />
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium cursor-pointer hover:bg-gray-50">
            <Upload size={14} /> Upload .csv
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPickFile} data-testid="import-file-input" />
          </label>
          <button
            onClick={runPreview}
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
      {preview && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4" data-testid="import-preview">
          <h3 className="font-bold mb-3">Column mapping ({preview.total_rows} rows)</h3>
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
          {mode === 'properties' && (
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
            {mode === 'properties' && (
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
                    {o.email} — sent "set password" email
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
