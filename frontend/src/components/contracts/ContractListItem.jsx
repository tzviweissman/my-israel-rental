import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  ChevronDown, ChevronUp, Download, Trash2, PenTool, Languages,
  Loader2, AlertCircle, Check,
} from 'lucide-react';

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const FILE_ICON = { pdf: '📄', docx: '📝' };

const StatusBadge = ({ contract }) => {
  if (contract.signed)
    return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Signed</span>;
  if (contract.translation_status === 'completed')
    return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Translated</span>;
  if (contract.translation_status === 'pending')
    return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Translating...</span>;
  return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Uploaded</span>;
};

const TranslationPanel = ({ contract, translatingId, onTranslate }) => {
  const [viewMode, setViewMode] = useState('original');
  return (
    <div className="bg-gray-50 rounded-xl p-4 mb-4" data-testid={`translate-section-${contract.id}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Languages size={18} className="text-[#1E6A6A]" />
          <h4 className="text-sm font-semibold text-gray-800">Translation</h4>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onTranslate(contract.id, 'he-en')}
            disabled={translatingId === contract.id || !contract.extracted_text}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid={`translate-he-en-${contract.id}`}
          >
            {translatingId === contract.id ? <Loader2 size={12} className="animate-spin" /> : null}
            Hebrew → English
          </button>
          <button
            onClick={() => onTranslate(contract.id, 'en-he')}
            disabled={translatingId === contract.id || !contract.extracted_text}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
            style={{ backgroundColor: '#D4AF37' }}
            data-testid={`translate-en-he-${contract.id}`}
          >
            {translatingId === contract.id ? <Loader2 size={12} className="animate-spin" /> : null}
            English → Hebrew
          </button>
        </div>
      </div>

      {!contract.extracted_text ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs">
          <AlertCircle size={14} />
          No readable text was extracted from this file. Translation is not available for this contract.
        </div>
      ) : (
        <div>
          <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setViewMode('original')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'original' ? 'bg-[#1E6A6A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Original
            </button>
            {contract.translated_text && (
              <>
                <button
                  onClick={() => setViewMode('translated')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'translated' ? 'bg-[#1E6A6A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Translated
                </button>
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'side-by-side' ? 'bg-[#1E6A6A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Side by Side
                </button>
              </>
            )}
          </div>

          {viewMode === 'side-by-side' && contract.translated_text ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-80 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Original</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{contract.extracted_text}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-80 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-[#1E6A6A] font-semibold mb-2">
                  Translated ({contract.translation_direction === 'he-en' ? 'English' : 'Hebrew'})
                </p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed" dir={contract.translation_direction === 'en-he' ? 'rtl' : 'ltr'}>
                  {contract.translated_text}
                </p>
              </div>
            </div>
          ) : viewMode === 'translated' && contract.translated_text ? (
            <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-80 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wider text-[#1E6A6A] font-semibold mb-2">
                Translated ({contract.translation_direction === 'he-en' ? 'English' : 'Hebrew'})
              </p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed" dir={contract.translation_direction === 'en-he' ? 'rtl' : 'ltr'}>
                {contract.translated_text}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-80 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Original Extracted Text</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{contract.extracted_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SignaturePanel = ({ contract, signerName, setSignerName, onSign, onCancel }) => {
  const sigCanvasRef = useRef(null);
  const handleSign = () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return onSign(null);
    onSign(sigCanvasRef.current.toDataURL('image/png'));
  };
  return (
    <div className="bg-gray-50 rounded-xl p-4 mb-4" data-testid={`signing-section-${contract.id}`}>
      <div className="flex items-center gap-2 mb-3">
        <PenTool size={18} className="text-[#D4AF37]" />
        <h4 className="text-sm font-semibold text-gray-800">Digital Signature</h4>
      </div>
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Enter your full legal name"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
          data-testid="signer-name-input"
        />
      </div>
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">Draw Your Signature</label>
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 overflow-hidden">
          <SignatureCanvas
            ref={sigCanvasRef}
            penColor="#1E6A6A"
            canvasProps={{
              width: 500, height: 150, className: 'w-full',
              style: { width: '100%', height: '150px' },
            }}
          />
        </div>
        <button
          onClick={() => sigCanvasRef.current?.clear()}
          className="text-xs text-gray-400 hover:text-red-500 mt-1"
        >
          Clear signature
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSign}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#D4AF37' }}
          data-testid={`confirm-sign-btn-${contract.id}`}
        >
          <Check size={14} /> Confirm & Sign
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * One row in the contracts list. Header is always visible; clicking it
 * toggles the expanded panel which exposes download / sign / delete plus
 * the translation + signing sub-panels. All callbacks come from the parent
 * (ContractManager) so this stays purely presentational.
 */
const ContractListItem = ({
  contract,
  propertyTitle,
  expanded, onToggleExpand,
  translatingId, onTranslate,
  isSigning, onBeginSign, onCancelSign, onConfirmSign,
  signerName, setSignerName,
  onDownload, onDelete,
}) => {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      data-testid={`contract-${contract.id}`}
    >
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{FILE_ICON[contract.file_type] || '🖼️'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{contract.original_filename}</p>
            <p className="text-xs text-gray-500">
              {propertyTitle} • {formatDate(contract.created_at)} • {formatFileSize(contract.file_size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge contract={contract} />
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 pt-4 pb-4">
            <button
              onClick={() => onDownload(contract.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-colors"
              data-testid={`download-btn-${contract.id}`}
            >
              <Download size={14} /> Download
            </button>
            {!contract.signed && (
              <button
                onClick={onBeginSign}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
                data-testid={`sign-btn-${contract.id}`}
              >
                <PenTool size={14} /> Sign
              </button>
            )}
            <button
              onClick={() => onDelete(contract.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors"
              data-testid={`delete-btn-${contract.id}`}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>

          <TranslationPanel
            contract={contract}
            translatingId={translatingId}
            onTranslate={onTranslate}
          />

          {isSigning && (
            <SignaturePanel
              contract={contract}
              signerName={signerName}
              setSignerName={setSignerName}
              onSign={onConfirmSign}
              onCancel={onCancelSign}
            />
          )}

          {contract.signatures && contract.signatures.length > 0 && (
            <div className="bg-green-50 rounded-xl p-4" data-testid={`signatures-${contract.id}`}>
              <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Check size={16} /> Signatures ({contract.signatures.length})
              </h4>
              <div className="space-y-3">
                {contract.signatures.map((sig) => (
                  <div
                    key={`${sig.signer_name}-${sig.signed_at}`}
                    className="flex items-center gap-3 bg-white rounded-lg p-3 border border-green-200"
                  >
                    <img src={sig.signature_data} alt="Signature" className="h-10 w-auto border border-gray-100 rounded" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{sig.signer_name}</p>
                      <p className="text-xs text-gray-500">Signed {formatDate(sig.signed_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractListItem;
