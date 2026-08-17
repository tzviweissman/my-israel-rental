import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const validateFile = (file, onError) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp',
  ];
  if (!allowed.includes(file.type)) {
    onError('Unsupported file type. Please upload PDF, DOCX, JPG, PNG, or WebP files.');
    return false;
  }
  if (file.size > 50 * 1024 * 1024) {
    onError('File too large. Maximum size is 50MB.');
    return false;
  }
  return true;
};

/**
 * Drag-and-drop contract upload card. Owns its local file + property-id
 * selection + drag visual state; everything else (API call, fetchContracts)
 * is delegated to the parent via ``onUpload``.
 */
const ContractUploadForm = ({ properties, uploading, onUpload, onClose, onError }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file, onError)) setSelectedFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file, onError)) setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedPropertyId) {
      onError('Please select a property and a file.');
      return;
    }
    const ok = await onUpload(selectedFile, selectedPropertyId);
    if (ok) {
      setSelectedFile(null);
      setSelectedPropertyId('');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" data-testid="upload-form">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Upload New Contract</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Property</label>
        <select
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm"
          data-testid="contract-property-select"
        >
          <option value="">Choose a property...</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.title} — {p.area}</option>
          ))}
        </select>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragActive ? 'border-[var(--brand-primary)] bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5' : 'border-gray-300 hover:border-[var(--gold)] hover:bg-gray-50'
        }`}
        data-testid="contract-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="contract-file-input"
        />
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText size={24} className="text-[var(--brand-primary)]" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="text-red-400 hover:text-red-600 ml-2"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div>
            <Upload size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">Drop your contract here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, JPG, PNG, WebP (max 50MB)</p>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={uploading || !selectedFile || !selectedPropertyId}
        className="mt-4 w-full py-3 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all hover:shadow-md"
        style={{ backgroundColor: 'var(--gold)' }}
        data-testid="submit-upload-btn"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Uploading...
          </span>
        ) : (
          'Upload Contract'
        )}
      </button>
    </div>
  );
};

export default ContractUploadForm;
