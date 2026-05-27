import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Plus, Trash2, Image as ImageIcon, FileSpreadsheet, ArrowLeft,
  CheckCircle2, AlertCircle, Sparkles, Download, Loader2,
} from 'lucide-react';
import { LOCATION_OPTIONS } from '../../constants/locations';
import {
  RENTAL_TYPES, PROPERTY_TYPES, CONDITIONS, FURNITURE_OPTIONS,
  CANCELLATION_POLICIES, AMENITY_OPTIONS,
} from '../../constants/propertyEnums';
import { uploadFilesFast } from '../../utils/fastUpload';
import { sizedImage, videoPoster } from '../../utils/cdnImage';

/**
 * Bulk-upload modal — friendly UX edition.
 *
 * Two modes:
 *   1. Visual editor (default): a stack of property "cards", one per row.
 *      Add / remove / edit inline with proper inputs. The point is that a
 *      non-technical user never has to look at a CSV.
 *   2. Spreadsheet import (advanced): the original file/paste UI, hidden
 *      behind a small toggle for power users with existing data.
 *
 * Both modes funnel through the same backend (/parse + /commit), and both
 * end at the same image-attach step + success screen.
 */

// Default values for a brand-new property card.
const blankProperty = () => ({
  // Stable id for React keys — never sent to the server (filtered out in
  // both the TSV serialize path and the visual /commit payload).
  _id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `r-${Date.now()}-${Math.random()}`,
  // Required by the backend
  title: '',
  address: '',
  area: '',
  description: '',
  rental_type: 'long-term',
  property_type: 'apartment',
  bedrooms: 1,
  bathrooms: 1,
  floor: 1,
  square_meters: '',
  monthly_price: '',
  nightly_price: '',
  currency: 'ILS',
  // Optional — collapsed under "More fields"
  porch_square_meters: '',
  porches: 0,
  has_elevator: 'no',
  is_shabbat_elevator: 'no',
  is_tama: 'no',
  sukkah_compatible: 'no',
  has_agent_fee: 'no',
  agent_fee_price: '',
  agent_fee_currency: 'ILS',
  has_cleaning_fee: 'no',
  cleaning_fee_price: '',
  cleaning_fee_currency: 'ILS',
  furniture_option: 'no_furniture',
  condition: 'renovated',
  cancellation_policy: 'flexible',
  custom_cancellation_policy: '',
  amenities: [],
  minimum_booking_days: '',
  // Per-row pre-uploaded Cloudinary URLs. Local-only — stripped from
  // the TSV payload sent to /parse, but re-merged into rows POSTed
  // to /commit so each property keeps its own photos.
  _media_images: [],
  _media_videos: [],
  _media_uploading: false,
});

const BulkUploadModal = ({ isOpen, onClose, onDone, API, token }) => {
  // 'editor' = visual rows | 'import' = spreadsheet path | 'images' | 'done'
  const [stage, setStage] = useState('editor');
  const [rows, setRows] = useState([blankProperty()]);
  const [rowErrors, setRowErrors] = useState({}); // index -> server error string
  const [saving, setSaving] = useState(false);
  // Spreadsheet path
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  // Smart paste (LLM-extracted from free-form WhatsApp/email text)
  const [smartPaste, setSmartPaste] = useState('');
  const [smartPasting, setSmartPasting] = useState(false);
  // After commit
  const [commitResult, setCommitResult] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [attaching, setAttaching] = useState(false);

  // Quick client-side check before we hit the server. Must be declared before
  // any conditional return so React's rules-of-hooks stays happy.
  const visibleRowSummary = useMemo(() => {
    const issues = [];
    rows.forEach((r, i) => {
      if (!r.title.trim()) issues.push({ i, msg: 'Title is required' });
      else if (!r.area.trim()) issues.push({ i, msg: 'Area is required' });
      else if (r.rental_type !== 'vacation' && !r.monthly_price) issues.push({ i, msg: 'Monthly price is required' });
      else if (r.rental_type === 'vacation' && !r.nightly_price) issues.push({ i, msg: 'Nightly price is required' });
    });
    return issues;
  }, [rows]);

  if (!isOpen) return null;

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const reset = () => {
    setStage('editor');
    setRows([blankProperty()]);
    setRowErrors({});
    setShowImportPanel(false);
    setFile(null);
    setPasteText('');
    setCommitResult(null);
    setZipFile(null);
  };

  const close = () => { reset(); onClose(); };

  // -------------------------------------------------------------- editor ---
  const updateRow = (i, key, value) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, [key]: value };
      // When switching rental_type, drop the price for the *other* mode so a
      // stale value (e.g. a "monthly" price typed before switching to vacation)
      // can't sneak into the backend payload.
      if (key === 'rental_type') {
        if (value === 'vacation') next.monthly_price = '';
        else next.nightly_price = '';
      }
      // Israeli convention: long-term rentals' agent fee equals one month's
      // rent. Auto-fill the agent fee whenever the user types a monthly price
      // on a long-term row — but only if they haven't manually set the fee
      // themselves (treat blank or untouched 'no' as untouched).
      if (key === 'monthly_price' && next.rental_type === 'long-term') {
        const userTouchedFee =
          next.has_agent_fee === 'yes' && next.agent_fee_price !== ''
            && Number(next.agent_fee_price) !== Number(r.monthly_price);
        if (!userTouchedFee && value !== '') {
          next.has_agent_fee = 'yes';
          next.agent_fee_price = value;
          next.agent_fee_currency = next.currency || 'ILS';
        }
      }
      // Same idea when the user switches rental_type → long-term after
      // already typing a monthly price.
      if (key === 'rental_type' && value === 'long-term' && next.monthly_price) {
        if (next.has_agent_fee !== 'yes' || !next.agent_fee_price) {
          next.has_agent_fee = 'yes';
          next.agent_fee_price = next.monthly_price;
          next.agent_fee_currency = next.currency || 'ILS';
        }
      }
      return next;
    }));
    if (rowErrors[i]) setRowErrors(prev => { const n = { ...prev }; delete n[i]; return n; });
  };

  const addRow = () => setRows(prev => [...prev, blankProperty()]);
  const duplicateRow = (i) => setRows(prev => [...prev.slice(0, i + 1), { ...prev[i], _id: blankProperty()._id }, ...prev.slice(i + 1)]);
  const removeRow = (i) => setRows(prev => prev.length === 1 ? [blankProperty()] : prev.filter((_, idx) => idx !== i));

  const handleSaveAll = async () => {
    if (visibleRowSummary.length > 0) {
      const map = {};
      visibleRowSummary.forEach(({ i, msg }) => { map[i] = msg; });
      setRowErrors(map);
      toast.error(`Fix ${visibleRowSummary.length} row(s) before saving`);
      return;
    }
    setSaving(true);
    try {
      // Send the rows as TSV pasted text — the backend's /parse can read that
      // path without our needing a new endpoint. Strip the local `_id` (used
      // only for React keys) and the per-row media arrays (sent separately
      // in the /commit payload) so they never reach the backend parser.
      const LOCAL_ONLY = new Set(['_id', '_media_images', '_media_videos', '_media_uploading']);
      const headers = Object.keys(rows[0]).filter(h => !LOCAL_ONLY.has(h));
      const tsv = [
        headers.join('\t'),
        ...rows.map(r => headers.map(h => {
          const v = r[h];
          // Normalise boolean-like dropdowns to yes/no the backend expects.
          if (v === '' || v === null || v === undefined) return '';
          return String(v).replace(/\t/g, ' ').replace(/\n/g, ' ');
        }).join('\t')),
      ].join('\n');

      const fd = new FormData();
      fd.append('text', tsv);
      const parseRes = await axios.post(`${API}/properties/bulk/parse`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      const parsed = parseRes.data;
      const errMap = {};
      let hasError = false;
      parsed.rows.forEach(p => {
        if (p.errors.length > 0) {
          errMap[p.index - 1] = p.errors[0];
          hasError = true;
        }
      });
      if (hasError) {
        setRowErrors(errMap);
        toast.error('Some rows have errors — see them inline');
        setSaving(false);
        return;
      }

      const commitRes = await axios.post(
        `${API}/properties/bulk/commit`,
        {
          rows: parsed.rows.map((r, idx) => ({
            ...r.normalized,
            // Re-merge per-row media URLs that were stripped before /parse.
            // `parsed.rows` mirrors the input order so we can match by index.
            _media_images: rows[idx]?._media_images || [],
            _media_videos: rows[idx]?._media_videos || [],
          })),
        },
        authHeaders,
      );
      setCommitResult(commitRes.data);
      toast.success(`${commitRes.data.summary.created} properties created`);
      setStage('images');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------- spreadsheet import -
  const handleSpreadsheetImport = async () => {
    if (!file && !pasteText.trim()) {
      toast.error('Choose a file or paste rows first');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (pasteText.trim()) fd.append('text', pasteText);
      const parseRes = await axios.post(`${API}/properties/bulk/parse`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      const parsed = parseRes.data;
      // Surface every row in the visual editor for inline review
      const editorRows = parsed.rows.map(p => {
        const merged = { ...blankProperty(), ...p.normalized };
        // Coerce list / object fields back into the shape the editor expects
        if (typeof merged.amenities === 'string') {
          merged.amenities = merged.amenities
            .split(/[,;]/).map(a => a.trim()).filter(Boolean);
        } else if (!Array.isArray(merged.amenities)) {
          merged.amenities = [];
        }
        // Booleans -> yes/no strings
        for (const bf of ['has_elevator', 'is_shabbat_elevator', 'is_tama', 'sukkah_compatible', 'has_agent_fee', 'has_cleaning_fee']) {
          if (typeof merged[bf] === 'boolean') merged[bf] = merged[bf] ? 'yes' : 'no';
          if (!['yes', 'no'].includes(merged[bf])) merged[bf] = 'no';
        }
        return merged;
      });
      setRows(editorRows.length ? editorRows : [blankProperty()]);
      const errMap = {};
      parsed.rows.forEach((p, i) => { if (p.errors.length) errMap[i] = p.errors[0]; });
      setRowErrors(errMap);
      setShowImportPanel(false);
      setStage('editor');
      toast.success(
        parsed.summary.invalid
          ? `Imported ${parsed.summary.total} rows — ${parsed.summary.invalid} need fixing`
          : `Imported ${parsed.summary.total} rows — ready to save`,
      );
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------- smart paste -
  // The killer feature: paste a WhatsApp/email message containing N property
  // descriptions in mixed English/Hebrew, and Claude extracts structured rows
  // straight into the visual editor. No CSV, no template, no fuss.
  const handleSmartPaste = async () => {
    if (!smartPaste.trim()) {
      toast.error('Paste some property text first');
      return;
    }
    setSmartPasting(true);
    try {
      const res = await axios.post(
        `${API}/properties/bulk/extract`,
        { text: smartPaste },
        authHeaders,
      );
      const extracted = res.data.properties || [];
      if (!extracted.length) {
        toast.error('Could not find any properties in that text');
        return;
      }
      // Merge into blank-property defaults so missing fields keep dropdowns valid
      const editorRows = extracted.map(p => {
        const merged = { ...blankProperty() };
        for (const [k, v] of Object.entries(p)) {
          if (v === null || v === undefined) continue;
          merged[k] = v;
        }
        // Normalise booleans the editor expects (yes/no strings)
        for (const bf of ['has_elevator', 'is_shabbat_elevator', 'is_tama', 'sukkah_compatible', 'has_agent_fee', 'has_cleaning_fee']) {
          if (typeof merged[bf] === 'boolean') merged[bf] = merged[bf] ? 'yes' : 'no';
          if (!['yes', 'no'].includes(merged[bf])) merged[bf] = 'no';
        }
        // amenities: ensure array of canonical strings
        if (typeof merged.amenities === 'string') {
          merged.amenities = merged.amenities
            .split(/[,;]/).map(a => a.trim()).filter(Boolean);
        } else if (!Array.isArray(merged.amenities)) {
          merged.amenities = [];
        }
        return merged;
      });
      setRows(editorRows);
      setRowErrors({});
      setSmartPaste('');
      toast.success(`Extracted ${editorRows.length} propert${editorRows.length === 1 ? 'y' : 'ies'} — review below`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI extraction failed — try the manual editor');
    } finally {
      setSmartPasting(false);
    }
  };

  const downloadTemplate = (fmt) => window.open(`${API}/properties/bulk/template?fmt=${fmt}`, '_blank');

  // ------------------------------------------------------------- images ---
  const propertiesWithImageRefs = (commitResult?.created || []).filter(c => c.image_filenames?.length > 0);

  const handleAttachImages = async () => {
    if (!zipFile) {
      toast.error('Pick a ZIP of images first');
      return;
    }
    setAttaching(true);
    try {
      const mapping = {};
      commitResult.created.forEach(c => {
        if (c.image_filenames?.length) mapping[c.id] = c.image_filenames;
      });
      const fd = new FormData();
      fd.append('file', zipFile);
      fd.append('mapping', JSON.stringify(mapping));
      const res = await axios.post(`${API}/properties/bulk/images`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${res.data.attached.length} images attached${res.data.missing.length ? ` · ${res.data.missing.length} missing` : ''}`);
      setStage('done');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Image attach failed');
    } finally {
      setAttaching(false);
    }
  };

  // =========================================================================
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-2 sm:p-8" data-testid="bulk-upload-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Playfair Display' }}>
              <Sparkles size={20} className="text-[#D4AF37]" />
              Add multiple properties
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Add as many properties as you want — they're all created in one click.
            </p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-gray-100" data-testid="close-bulk-modal">
            <X size={20} />
          </button>
        </div>

        {/* ---------------- EDITOR STAGE ---------------- */}
        {stage === 'editor' && (
          <div className="px-6 py-5">
            {/* Smart paste — the killer feature for managers receiving listings via WhatsApp */}
            <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-[#1E6A6A]/5 to-[#D4AF37]/10 border border-[#1E6A6A]/20" data-testid="smart-paste-panel">
              <div className="flex items-start gap-2 mb-2">
                <Sparkles size={16} className="text-[#1E6A6A] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Got listings from WhatsApp, email, or a colleague?</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Paste anything — English, Hebrew, mixed — and we'll extract every property automatically.
                  </p>
                </div>
              </div>
              <textarea
                value={smartPaste}
                onChange={e => setSmartPaste(e.target.value)}
                placeholder={'Paste your property descriptions here…\n\nExample:\nסנהדריה מורחבת\n1.5 bedroom, fully furnished\nGround floor, 9000nis\n\nBelz area, 1BR, basement, 9500'}
                rows={smartPaste ? 6 : 3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm font-mono bg-white/70 transition-all"
                data-testid="smart-paste-input"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-gray-500">{smartPaste.length.toLocaleString()} / 30,000 characters</p>
                <button
                  onClick={handleSmartPaste}
                  disabled={smartPasting || !smartPaste.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#1E6A6A] text-[#D4AF37] text-xs font-semibold hover:bg-[#175757] disabled:opacity-50 inline-flex items-center gap-1.5"
                  data-testid="smart-paste-btn"
                >
                  <Sparkles size={12} />
                  {smartPasting ? 'Reading…' : 'Extract properties'}
                </button>
              </div>
            </div>

            {/* Tiny "got a spreadsheet?" affordance */}
            {!showImportPanel && (
              <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 text-sm text-amber-900">
                  <FileSpreadsheet size={16} />
                  <span>Already have your properties in a spreadsheet?</span>
                </div>
                <button
                  onClick={() => setShowImportPanel(true)}
                  className="text-xs font-semibold text-amber-900 underline hover:no-underline"
                  data-testid="show-import-panel"
                >
                  Import CSV / XLSX →
                </button>
              </div>
            )}

            {showImportPanel && (
              <div className="mb-5 p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50" data-testid="spreadsheet-import-panel">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Import from a spreadsheet</p>
                  <button onClick={() => setShowImportPanel(false)} className="text-xs text-gray-500 hover:text-gray-800" data-testid="close-import-panel">
                    Close
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Need a starting point? <button onClick={() => downloadTemplate('xlsx')} className="underline font-medium" data-testid="download-xlsx">download Excel template</button> or <button onClick={() => downloadTemplate('csv')} className="underline font-medium" data-testid="download-csv">CSV template</button>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-700">Upload .csv or .xlsx</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs text-gray-700 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-black file:text-[#D4AF37] file:text-xs file:font-semibold"
                      data-testid="bulk-upload-file"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-700">…or paste rows from Excel/Sheets</span>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder="Tab- or comma-separated rows, headers in first line"
                      rows={3}
                      className="mt-1 block w-full text-xs px-2 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      data-testid="bulk-paste-text"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleSpreadsheetImport}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 disabled:opacity-50"
                    data-testid="bulk-import-btn"
                  >
                    {saving ? 'Importing…' : 'Import into editor'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3" data-testid="bulk-rows">
              {rows.map((row, i) => (
                <PropertyRowCard
                  key={row._id || i}
                  index={i}
                  row={row}
                  error={rowErrors[i]}
                  onChange={(k, v) => updateRow(i, k, v)}
                  onDuplicate={() => duplicateRow(i)}
                  onRemove={() => removeRow(i)}
                  API={API}
                  token={token}
                />
              ))}
            </div>

            <button
              onClick={addRow}
              className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#1E6A6A] hover:bg-gray-50 text-sm font-semibold text-gray-600 hover:text-[#1E6A6A] flex items-center justify-center gap-2 transition-colors"
              data-testid="add-row-btn"
            >
              <Plus size={16} />
              Add another property
            </button>
          </div>
        )}

        {/* ---------------- IMAGES STAGE ---------------- */}
        {stage === 'images' && (
          <div className="px-6 py-5" data-testid="bulk-images-stage">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={20} className="text-green-600" />
              <p className="text-lg font-semibold">{commitResult.summary.created} properties created.</p>
            </div>
            {propertiesWithImageRefs.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Some rows referenced image filenames. Drop a ZIP file containing those images and we'll match them automatically.
                </p>
                <input
                  type="file"
                  accept=".zip"
                  onChange={e => setZipFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-black file:text-[#D4AF37] file:font-semibold"
                  data-testid="bulk-zip-file"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setStage('done')} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100" data-testid="skip-images-btn">
                    Skip images
                  </button>
                  <button
                    onClick={handleAttachImages}
                    disabled={!zipFile || attaching}
                    className="px-4 py-2 rounded-lg bg-black text-[#D4AF37] text-sm font-semibold hover:bg-gray-900 disabled:opacity-50"
                    data-testid="attach-images-btn"
                  >
                    {attaching ? 'Attaching…' : 'Attach images'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">You can add photos to each property later from your dashboard.</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setStage('done')} className="px-4 py-2 rounded-lg bg-black text-[#D4AF37] text-sm font-semibold" data-testid="continue-to-done-btn">
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------------- DONE STAGE ---------------- */}
        {stage === 'done' && (
          <div className="px-6 py-10 text-center" data-testid="bulk-done-stage">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>All set!</p>
            <p className="text-sm text-gray-600 mb-6">
              {commitResult.summary.created} properties added to your account.
            </p>
            <button
              onClick={() => { onDone && onDone(); close(); }}
              className="px-6 py-2.5 rounded-lg bg-black text-[#D4AF37] text-sm font-semibold hover:bg-gray-900"
              data-testid="bulk-finish-btn"
            >
              Done
            </button>
          </div>
        )}

        {/* ---------------- FOOTER ---------------- */}
        {stage === 'editor' && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl" data-testid="bulk-footer">
            <div className="text-xs text-gray-500">
              {rows.length} propert{rows.length === 1 ? 'y' : 'ies'}
              {Object.keys(rowErrors).length > 0 && (
                <span className="ml-2 text-red-600 font-medium">· {Object.keys(rowErrors).length} need fixing</span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100" data-testid="bulk-cancel-btn">
                Cancel
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-black text-[#D4AF37] text-sm font-semibold hover:bg-gray-900 disabled:opacity-50"
                data-testid="bulk-save-btn"
              >
                {saving ? 'Saving…' : `Save ${rows.length} propert${rows.length === 1 ? 'y' : 'ies'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// Property card — used inside the visual editor.
// ===========================================================================
const PropertyRowCard = ({ index, row, error, onChange, onDuplicate, onRemove, API, token }) => {
  const [showMore, setShowMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isPerNight = row.rental_type === 'vacation';

  const mediaImages = row._media_images || [];
  const mediaVideos = row._media_videos || [];
  const hasMedia = mediaImages.length + mediaVideos.length > 0;

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const results = await uploadFilesFast(files, API, token);
      const newImgs = [...mediaImages];
      const newVids = [...mediaVideos];
      for (const r of results) {
        if (r.error) {
          toast.error(`${r.original_name || r.filename}: ${r.error}`);
          continue;
        }
        if (r.file_type === 'video') newVids.push(r.url);
        else newImgs.push(r.url);
      }
      onChange('_media_images', newImgs);
      onChange('_media_videos', newVids);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url) => onChange('_media_images', mediaImages.filter(u => u !== url));
  const removeVideo = (url) => onChange('_media_videos', mediaVideos.filter(u => u !== url));

  return (
    <div
      className={`rounded-xl border ${error ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-white'} p-4 transition-colors`}
      data-testid={`bulk-row-${index}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Property {index + 1}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="text-xs font-medium text-gray-500 hover:text-[#1E6A6A] px-2 py-1 rounded hover:bg-gray-50"
            title="Duplicate this row"
            data-testid={`duplicate-row-${index}`}
          >
            Duplicate
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded text-red-500 hover:bg-red-50"
            title="Remove this row"
            data-testid={`remove-row-${index}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Per-property media uploader. Sits right at the top of the card so
          a user pasting N properties via smart paste can walk down the
          list and drop photos into each one without leaving the modal. */}
      <div className="mb-3">
        <label
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-wait' : 'border-[#1E6A6A]/30 bg-[#1E6A6A]/5 hover:bg-[#1E6A6A]/10 text-[#1E6A6A]'}`}
          data-testid={`row-media-upload-${index}`}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          <span className="text-xs font-semibold">
            {uploading
              ? 'Uploading…'
              : hasMedia
                ? `Add more photos / videos (${mediaImages.length + mediaVideos.length} attached)`
                : 'Add photos / videos for this property'}
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={onPickFiles}
            data-testid={`row-media-input-${index}`}
          />
        </label>
        {hasMedia && (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5 mt-2" data-testid={`row-media-grid-${index}`}>
            {mediaImages.map((url) => (
              <div key={url} className="relative aspect-square rounded-md overflow-hidden bg-gray-100 group">
                <img src={sizedImage(url, 160)} alt="" className="w-full h-full object-cover" loading="lazy" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center"
                  title="Remove photo"
                  data-testid={`remove-row-media-${index}-${mediaImages.indexOf(url)}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {mediaVideos.map((url) => (
              <div key={url} className="relative aspect-square rounded-md overflow-hidden bg-gray-900 group">
                {videoPoster(url, 160)
                  ? <img src={videoPoster(url, 160)} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
                  : <div className="absolute inset-0 flex items-center justify-center text-white text-[10px]">Video</div>}
                <span className="absolute bottom-0.5 left-0.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">▶ Video</span>
                <button
                  type="button"
                  onClick={() => removeVideo(url)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center"
                  title="Remove video"
                  data-testid={`remove-row-video-${index}-${mediaVideos.indexOf(url)}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid={`row-error-${index}`}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <div className="col-span-2 md:col-span-1">
          <Input label="Title*" value={row.title} onChange={v => onChange('title', v)} placeholder="Cozy Tel Aviv 2BR" testid={`r${index}-title`} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Input label="Address" value={row.address} onChange={v => onChange('address', v)} placeholder="King George 10" testid={`r${index}-address`} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <LocationSelect label="Area / Neighborhood*" value={row.area} onChange={v => onChange('area', v)} testid={`r${index}-area`} />
        </div>
        <Select label="Rental type*" value={row.rental_type} onChange={v => onChange('rental_type', v)} options={RENTAL_TYPES} testid={`r${index}-rental_type`} />
        <Select label="Property type" value={row.property_type} onChange={v => onChange('property_type', v)} options={PROPERTY_TYPES} testid={`r${index}-property_type`} />
        <NumberInput label="Bedrooms" value={row.bedrooms} onChange={v => onChange('bedrooms', v)} testid={`r${index}-bedrooms`} />
        <NumberInput label="Bathrooms" value={row.bathrooms} onChange={v => onChange('bathrooms', v)} testid={`r${index}-bathrooms`} />
        <NumberInput label="Floor" value={row.floor} onChange={v => onChange('floor', v)} testid={`r${index}-floor`} />
        <NumberInput label="Square meters" value={row.square_meters} onChange={v => onChange('square_meters', v)} testid={`r${index}-square_meters`} placeholder="e.g. 75" />

        <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {isPerNight ? (
            // Vacation rentals → nightly price only
            <div className="grid grid-cols-[1fr_90px] gap-2 md:col-span-2">
              <NumberInput
                label="Nightly price*"
                value={row.nightly_price}
                onChange={v => onChange('nightly_price', v)}
                testid={`r${index}-nightly_price`}
                placeholder="450"
              />
              <Select
                label="Currency"
                value={row.currency}
                onChange={v => onChange('currency', v)}
                options={[{ v: 'ILS', label: '₪ ILS' }, { v: 'USD', label: '$ USD' }]}
                testid={`r${index}-currency`}
              />
            </div>
          ) : (
            // Long-term / Short-term / Storage → monthly price only
            <div className="grid grid-cols-[1fr_90px] gap-2 md:col-span-2">
              <NumberInput
                label="Monthly price*"
                value={row.monthly_price}
                onChange={v => onChange('monthly_price', v)}
                testid={`r${index}-monthly_price`}
                placeholder="6500"
              />
              <Select
                label="Currency"
                value={row.currency}
                onChange={v => onChange('currency', v)}
                options={[{ v: 'ILS', label: '₪ ILS' }, { v: 'USD', label: '$ USD' }]}
                testid={`r${index}-currency`}
              />
            </div>
          )}
        </div>

        <div className="col-span-2">
          <Textarea
            label="Description"
            value={row.description}
            onChange={v => onChange('description', v)}
            placeholder="Bright, recently renovated 2-bedroom apartment with a balcony…"
            testid={`r${index}-description`}
          />
        </div>
      </div>

      <button
        onClick={() => setShowMore(!showMore)}
        className="mt-3 text-xs font-medium text-[#1E6A6A] hover:underline"
        data-testid={`toggle-more-${index}`}
      >
        {showMore ? '↑ Hide extra fields' : '↓ More fields (amenities, elevator, agent fee, sukkah, etc.)'}
      </button>

      {showMore && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumberInput label="Porches" value={row.porches} onChange={v => onChange('porches', v)} testid={`r${index}-porches`} />
          <NumberInput label="Porch sqm" value={row.porch_square_meters} onChange={v => onChange('porch_square_meters', v)} testid={`r${index}-porch_sqm`} />
          <NumberInput label="Min booking days" value={row.minimum_booking_days} onChange={v => onChange('minimum_booking_days', v)} testid={`r${index}-min_days`} />
          <Select label="Furniture" value={row.furniture_option} onChange={v => onChange('furniture_option', v)} options={FURNITURE_OPTIONS} testid={`r${index}-furniture`} />
          <Select label="Condition" value={row.condition} onChange={v => onChange('condition', v)} options={CONDITIONS} testid={`r${index}-condition`} />
          {(row.rental_type === 'vacation' || row.rental_type === 'short-term') && (
            <Select label="Cancellation policy" value={row.cancellation_policy} onChange={v => onChange('cancellation_policy', v)} options={CANCELLATION_POLICIES} testid={`r${index}-cancel_policy`} />
          )}
          {(row.rental_type === 'vacation' || row.rental_type === 'short-term') && row.cancellation_policy === 'custom' && (
            <div className="col-span-2 md:col-span-3">
              <label className="block">
                <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Custom cancellation policy</span>
                <textarea
                  value={row.custom_cancellation_policy || ''}
                  onChange={e => onChange('custom_cancellation_policy', e.target.value)}
                  placeholder="Describe your cancellation policy in detail…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border-2 border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 text-sm"
                  data-testid={`r${index}-custom_cancel`}
                />
              </label>
            </div>
          )}
          <Select label="Elevator" value={row.has_elevator} onChange={v => onChange('has_elevator', v)} options={YESNO} testid={`r${index}-elevator`} />
          <Select
            label="Shabbat elevator"
            value={row.is_shabbat_elevator}
            onChange={v => {
              // Shabbat elevator implies the building has an elevator; auto-set
              // the parent flag so the listing stays consistent.
              if (v === 'yes' && row.has_elevator !== 'yes') {
                onChange('has_elevator', 'yes');
              }
              onChange('is_shabbat_elevator', v);
            }}
            options={YESNO}
            testid={`r${index}-shabbat`}
          />
          <Select label="TAMA / earthquake reinforced" value={row.is_tama} onChange={v => onChange('is_tama', v)} options={YESNO} testid={`r${index}-tama`} />
          <Select label="Sukkah compatible" value={row.sukkah_compatible} onChange={v => onChange('sukkah_compatible', v)} options={YESNO} testid={`r${index}-sukkah`} />
          <Select label="Agent fee" value={row.has_agent_fee} onChange={v => onChange('has_agent_fee', v)} options={YESNO} testid={`r${index}-agent_fee`} />
          {row.has_agent_fee === 'yes' && (
            <div className="col-span-2 grid grid-cols-[1fr_90px] gap-2 md:col-span-2">
              <NumberInput
                label="Agent fee amount"
                value={row.agent_fee_price}
                onChange={v => onChange('agent_fee_price', v)}
                testid={`r${index}-agent_fee_price`}
                placeholder="6500"
              />
              <Select
                label="Currency"
                value={row.agent_fee_currency}
                onChange={v => onChange('agent_fee_currency', v)}
                options={[{ v: 'ILS', label: '₪ ILS' }, { v: 'USD', label: '$ USD' }]}
                testid={`r${index}-agent_fee_currency`}
              />
            </div>
          )}
          {(row.rental_type === 'vacation' || row.rental_type === 'short-term') && (
            <Select label="Cleaning fee" value={row.has_cleaning_fee} onChange={v => onChange('has_cleaning_fee', v)} options={YESNO} testid={`r${index}-cleaning_fee`} />
          )}
          {(row.rental_type === 'vacation' || row.rental_type === 'short-term') && row.has_cleaning_fee === 'yes' && (
            <div className="col-span-2 grid grid-cols-[1fr_90px] gap-2 md:col-span-2">
              <NumberInput
                label="Cleaning fee amount"
                value={row.cleaning_fee_price}
                onChange={v => onChange('cleaning_fee_price', v)}
                testid={`r${index}-cleaning_fee_price`}
                placeholder="250"
              />
              <Select
                label="Currency"
                value={row.cleaning_fee_currency}
                onChange={v => onChange('cleaning_fee_currency', v)}
                options={[{ v: 'ILS', label: '₪ ILS' }, { v: 'USD', label: '$ USD' }]}
                testid={`r${index}-cleaning_fee_currency`}
              />
            </div>
          )}
          <div className="col-span-2 md:col-span-3">
            <AmenitiesGrid
              value={Array.isArray(row.amenities) ? row.amenities : []}
              onChange={v => onChange('amenities', v)}
              testid={`r${index}-amenities`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const YESNO = [{ v: 'no', label: 'No' }, { v: 'yes', label: 'Yes' }];

// ----- tiny presentational input wrappers -----
const Input = ({ label, value, onChange, placeholder, testid }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</span>
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
      data-testid={testid}
    />
  </label>
);

const NumberInput = ({ label, value, onChange, placeholder, testid }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</span>
    <input
      type="number"
      value={value === '' || value === undefined || value === null ? '' : value}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
      data-testid={testid}
    />
  </label>
);

const Select = ({ label, value, onChange, options, testid }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</span>
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
      data-testid={testid}
    >
      {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  </label>
);

// Area / Neighborhood select — grouped by Israeli city.
// LocationSelect — combobox with type-ahead. Same UX as the regular Add
// Property form's LocationPicker, just compact for the bulk row layout.
// Free typing also stores whatever the user types so custom areas survive.
const LocationSelect = ({ label, value, onChange, testid }) => {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const matches = LOCATION_OPTIONS.flatMap((group) =>
    group.neighborhoods
      .filter((n) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (
          n.toLowerCase().includes(s) ||
          group.city.toLowerCase().includes(s) ||
          `${group.city} - ${n}`.toLowerCase().includes(s)
        );
      })
      .map((n) => ({ value: `${group.city} - ${n}`, city: group.city, neighborhood: n }))
  );

  return (
    <div className="relative" ref={ref}>
      <label className="block">
        <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</span>
        <input
          type="text"
          value={open ? search : (value || '')}
          onChange={(e) => {
            setSearch(e.target.value);
            // Mirror typed text into the row value so users can save a
            // non-canonical area name (matches LocationPicker semantics).
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setSearch('');
            setOpen(true);
          }}
          placeholder="Type to search…"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
          data-testid={testid}
        />
      </label>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">No matches — typed value will be saved as-is</div>
          ) : (
            matches.map((loc) => (
              <div
                key={loc.value}
                onClick={() => {
                  onChange(loc.value);
                  setSearch('');
                  setOpen(false);
                }}
                className="px-3 py-2 hover:bg-[#1E6A6A]/10 cursor-pointer text-sm transition-colors"
              >
                <span className="font-medium text-gray-700">{loc.neighborhood}</span>
                <span className="text-gray-500 text-xs ml-2">({loc.city})</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const Textarea = ({ label, value, onChange, placeholder, testid }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</span>
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
      data-testid={testid}
    />
  </label>
);

// Same 13-amenity grid as the regular Add/Edit form, rendered as a compact
// checkbox cluster so bulk-upload rows stay readable.
const AmenitiesGrid = ({ value, onChange, testid }) => {
  const toggle = (amenity) => {
    if (value.includes(amenity)) {
      onChange(value.filter(a => a !== amenity));
    } else {
      onChange([...value, amenity]);
    }
  };
  return (
    <div data-testid={testid}>
      <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Amenities</span>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5">
        {AMENITY_OPTIONS.map(amenity => (
          <label key={amenity} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(amenity)}
              onChange={() => toggle(amenity)}
              className="w-4 h-4 rounded border-gray-300 text-[#1E6A6A] focus:ring-[#1E6A6A]/30"
              data-testid={`${testid}-${amenity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
            />
            <span className="text-gray-700">{amenity}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default BulkUploadModal;
