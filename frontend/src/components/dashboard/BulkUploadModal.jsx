import React, { useState } from 'react';
import axios from 'axios';
import { Download, Upload, FileSpreadsheet, Clipboard, CheckCircle2, XCircle, AlertCircle, Image as ImageIcon, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 5-step wizard for bulk-creating properties. Steps:
 *   1. Template   — owner downloads the CSV or XLSX template
 *   2. Input      — upload a CSV/XLSX file OR paste tab/CSV rows
 *   3. Preview    — dry-run parse; shows inline errors per row; owner can
 *                   uncheck rows before commit
 *   4. Images     — optional ZIP upload to attach images by filename (auto-
 *                   skipped when no rows referenced any image_filenames)
 *   5. Done       — success summary
 */
const BulkUploadModal = ({ isOpen, onClose, onDone, API, token }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null); // {rows, summary}
  const [selected, setSelected] = useState(new Set()); // row indices to commit
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [attaching, setAttaching] = useState(false);

  if (!isOpen) return null;

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const propertiesWithImages = commitResult?.created?.filter((c) => c.image_filenames?.length > 0) || [];

  const reset = () => {
    setStep(1);
    setFile(null);
    setPasteText('');
    setParsed(null);
    setSelected(new Set());
    setCommitResult(null);
    setZipFile(null);
  };

  const close = () => { reset(); onClose(); };

  const downloadTemplate = (fmt) => {
    window.open(`${API}/properties/bulk/template?fmt=${fmt}`, '_blank');
  };

  const handleParse = async () => {
    if (!file && !pasteText.trim()) {
      toast.error('Upload a file or paste your rows first');
      return;
    }
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (pasteText.trim()) formData.append('text', pasteText);
      const res = await axios.post(`${API}/properties/bulk/parse`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setParsed(res.data);
      // Auto-select valid rows
      const valid = new Set(res.data.rows.filter((r) => r.errors.length === 0).map((r) => r.index));
      setSelected(valid);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to parse input');
    }
  };

  const toggleRow = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleCommit = async () => {
    const rowsToCommit = parsed.rows
      .filter((r) => selected.has(r.index) && r.errors.length === 0)
      .map((r) => r.normalized);
    if (rowsToCommit.length === 0) {
      toast.error('Select at least one valid row');
      return;
    }
    setCommitting(true);
    try {
      const res = await axios.post(`${API}/properties/bulk/commit`, { rows: rowsToCommit }, authHeaders);
      setCommitResult(res.data);
      toast.success(`${res.data.summary.created} properties created`);
      // Skip step 4 if no images to attach
      setStep(res.data.created.some((c) => c.image_filenames?.length > 0) ? 4 : 5);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleAttachImages = async () => {
    if (!zipFile) {
      toast.error('Select a ZIP of images first');
      return;
    }
    setAttaching(true);
    try {
      const mapping = {};
      commitResult.created.forEach((c) => {
        if (c.image_filenames?.length) mapping[c.id] = c.image_filenames;
      });
      const formData = new FormData();
      formData.append('file', zipFile);
      formData.append('mapping', JSON.stringify(mapping));
      const res = await axios.post(`${API}/properties/bulk/images`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${res.data.attached.length} images attached${res.data.missing.length ? ` · ${res.data.missing.length} missing` : ''}`);
      setStep(5);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Image attach failed');
    } finally {
      setAttaching(false);
    }
  };

  const finish = () => {
    onDone && onDone();
    close();
  };

  // ------------------------ RENDER ------------------------

  const StepDot = ({ n, label }) => (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          step > n ? 'bg-[#1E6A6A] text-[#D4AF37]'
          : step === n ? 'bg-[#D4AF37] text-white'
          : 'bg-gray-200 text-gray-500'
        }`}
      >
        {step > n ? <CheckCircle2 size={14} /> : n}
      </div>
      <span className={`text-xs ${step === n ? 'font-bold text-[#1E6A6A]' : 'text-gray-500'}`}>{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={close}>
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="bulk-upload-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#fafaf5] to-white">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Bulk Upload Properties</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add multiple listings in one go</p>
          </div>
          <button onClick={close} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="bulk-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
          <StepDot n={1} label="Template" />
          <ArrowRight size={14} className="text-gray-300" />
          <StepDot n={2} label="Input" />
          <ArrowRight size={14} className="text-gray-300" />
          <StepDot n={3} label="Preview" />
          <ArrowRight size={14} className="text-gray-300" />
          <StepDot n={4} label="Images" />
          <ArrowRight size={14} className="text-gray-300" />
          <StepDot n={5} label="Done" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {step === 1 && (
            <div className="space-y-4" data-testid="bulk-step-1">
              <p className="text-sm text-gray-600">
                Start by downloading our template. It includes all the columns we support, with a sample row showing the expected format.
                Lists (like amenities and image filenames) use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">;</code> as a separator.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => downloadTemplate('csv')}
                  className="flex items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E6A6A] hover:bg-[#fafaf5] transition-colors text-left"
                  data-testid="download-csv-template"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#1E6A6A]/10 flex items-center justify-center"><Download className="text-[#1E6A6A]" size={22} /></div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">CSV Template</p>
                    <p className="text-xs text-gray-500">Simplest — opens in Excel, Numbers, or Google Sheets</p>
                  </div>
                </button>
                <button
                  onClick={() => downloadTemplate('xlsx')}
                  className="flex items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E6A6A] hover:bg-[#fafaf5] transition-colors text-left"
                  data-testid="download-xlsx-template"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center"><FileSpreadsheet className="text-[#D4AF37]" size={22} /></div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Excel Template (.xlsx)</p>
                    <p className="text-xs text-gray-500">Preserves cell types — use if you prefer Excel-native</p>
                  </div>
                </button>
              </div>
              <div className="rounded-lg bg-[#1E6A6A]/5 border border-[#1E6A6A]/15 p-3 text-xs text-gray-600">
                <strong className="text-[#1E6A6A]">Required:</strong> title, rental_type, property_type, bedrooms, area.
                <br />
                <strong className="text-[#1E6A6A]">Tip:</strong> You can skip the image_filenames column and upload images later per-property via Edit.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4" data-testid="bulk-step-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E6A6A] hover:bg-[#fafaf5] cursor-pointer transition-colors min-h-[160px]">
                  <Upload className="text-[#1E6A6A]" size={28} />
                  <span className="font-semibold text-sm text-gray-800">Upload CSV or XLSX</span>
                  <span className="text-xs text-gray-500 text-center">{file ? file.name : 'Click or drag a file'}</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    data-testid="bulk-file-input"
                  />
                </label>
                <div className="flex flex-col p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E6A6A] transition-colors min-h-[160px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Clipboard className="text-[#D4AF37]" size={18} />
                    <span className="font-semibold text-sm text-gray-800">Or paste rows</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Copy rows from Excel/Google Sheets (tab or comma separated)</p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={4}
                    placeholder="title,rental_type,property_type,bedrooms,area,monthly_price..."
                    className="flex-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-[#1E6A6A] resize-none"
                    data-testid="bulk-paste-input"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && parsed && (
            <div className="space-y-3" data-testid="bulk-step-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> {parsed.summary.valid} valid
                </span>
                {parsed.summary.invalid > 0 && (
                  <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1.5">
                    <XCircle size={12} /> {parsed.summary.invalid} invalid
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {selected.size} selected to create
                </span>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left w-10"></th>
                      <th className="px-3 py-2 text-left w-12">#</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Area</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r) => {
                      const hasErr = r.errors.length > 0;
                      const title = r.raw.title || '(no title)';
                      const rt = r.raw.rental_type || '';
                      const price = r.raw.monthly_price || r.raw.nightly_price || '';
                      return (
                        <tr
                          key={r.index}
                          className={`border-b border-gray-100 ${hasErr ? 'bg-red-50/50' : ''}`}
                          data-testid={`bulk-row-${r.index}`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              disabled={hasErr}
                              checked={selected.has(r.index)}
                              onChange={() => toggleRow(r.index)}
                              className="accent-[#1E6A6A] w-4 h-4"
                              data-testid={`bulk-row-check-${r.index}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{r.index}</td>
                          <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">{title}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs max-w-[140px] truncate">{r.raw.area || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{rt}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{price || '-'}</td>
                          <td className="px-3 py-2 text-xs">
                            {hasErr ? (
                              <span className="text-red-600 flex items-center gap-1">
                                <AlertCircle size={12} /> {r.errors[0]}
                              </span>
                            ) : (
                              <span className="text-green-600">ok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length === 0 && (
                <p className="text-center py-8 text-gray-500 text-sm">No rows found. Check your file has a header row.</p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4" data-testid="bulk-step-4">
              <div className="rounded-lg bg-[#1E6A6A]/5 border border-[#1E6A6A]/15 p-3 text-xs text-gray-600">
                <strong className="text-[#1E6A6A]">{propertiesWithImages.length} of your new properties referenced images.</strong>
                {' '}Zip those image files together and upload — we'll match by filename and attach them automatically.
                You can skip this and upload images later per-property.
              </div>

              <div className="rounded-xl border border-gray-200 p-4 max-h-[240px] overflow-auto">
                <p className="text-xs text-gray-500 mb-2">Expected filenames:</p>
                <ul className="space-y-1.5">
                  {propertiesWithImages.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 text-xs">
                      <ImageIcon size={12} className="text-[#D4AF37] shrink-0 mt-0.5" />
                      <span className="font-medium text-gray-800 min-w-[120px] truncate">{p.title}</span>
                      <span className="text-gray-500 font-mono truncate">{p.image_filenames.join('; ')}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#D4AF37] hover:bg-[#fafaf5] cursor-pointer transition-colors">
                <Upload className="text-[#D4AF37]" size={24} />
                <span className="font-semibold text-sm text-gray-800">Upload ZIP of images</span>
                <span className="text-xs text-gray-500">{zipFile ? zipFile.name : 'Nested folders are OK — we match by filename'}</span>
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  data-testid="bulk-zip-input"
                />
              </label>
            </div>
          )}

          {step === 5 && commitResult && (
            <div className="space-y-4 text-center py-8" data-testid="bulk-step-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="text-green-600" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Playfair Display' }}>
                  {commitResult.summary.created} {commitResult.summary.created === 1 ? 'property' : 'properties'} created
                </h3>
                {commitResult.summary.skipped > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{commitResult.summary.skipped} skipped due to errors</p>
                )}
                <p className="text-sm text-gray-500 mt-2">You can edit individual listings and add more images from your dashboard.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
          <button
            onClick={step === 1 ? close : () => setStep(Math.max(1, step - 1))}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-[#1E6A6A] transition-colors"
          >
            {step === 1 ? 'Cancel' : <><ArrowLeft size={14} /> Back</>}
          </button>
          <div className="flex gap-2">
            {step === 1 && (
              <button onClick={() => setStep(2)} className="px-5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1.5" style={{ backgroundColor: '#1E6A6A' }} data-testid="bulk-next-1">
                Next <ArrowRight size={14} />
              </button>
            )}
            {step === 2 && (
              <button onClick={handleParse} className="px-5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1.5" style={{ backgroundColor: '#1E6A6A' }} data-testid="bulk-parse-btn">
                Parse & Preview <ArrowRight size={14} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleCommit}
                disabled={committing || selected.size === 0}
                className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: '#D4AF37' }}
                data-testid="bulk-commit-btn"
              >
                {committing ? 'Creating...' : `Create ${selected.size} ${selected.size === 1 ? 'property' : 'properties'}`}
              </button>
            )}
            {step === 4 && (
              <>
                <button onClick={() => setStep(5)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100" data-testid="bulk-skip-images">
                  Skip — upload later
                </button>
                <button
                  onClick={handleAttachImages}
                  disabled={attaching || !zipFile}
                  className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: '#1E6A6A' }}
                  data-testid="bulk-attach-images-btn"
                >
                  {attaching ? 'Attaching...' : 'Attach images'}
                </button>
              </>
            )}
            {step === 5 && (
              <button onClick={finish} className="px-5 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: '#1E6A6A' }} data-testid="bulk-finish-btn">
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
