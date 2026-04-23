import React, { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import SignatureCanvas from 'react-signature-canvas';
import {
  Upload, FileText, Languages, PenTool, Trash2, Download,
  ChevronDown, ChevronUp, X, Check, Loader2, AlertCircle, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const ContractManager = ({ properties }) => {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedContract, setExpandedContract] = useState(null);
  const [translatingId, setTranslatingId] = useState(null);
  const [signingContractId, setSigningContractId] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [viewMode, setViewMode] = useState('original'); // 'original' | 'translated' | 'side-by-side'
  const sigCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && token) {
      fetchContracts();
    }
  }, [user, token]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/contracts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContracts(res.data);
    } catch (err) {
      console.error('Failed to fetch contracts', err);
    } finally {
      setLoading(false);
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp'
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Unsupported file type. Please upload PDF, DOCX, JPG, PNG, or WebP files.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }
    setSelectedFile(file);
  };

  const uploadContract = async () => {
    if (!selectedFile || !selectedPropertyId) {
      toast.error('Please select a property and a file.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('property_id', selectedPropertyId);
      const res = await axios.post(`${API}/contracts/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Contract uploaded successfully!');
      setSelectedFile(null);
      setSelectedPropertyId('');
      setShowUploadForm(false);
      fetchContracts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const translateContract = async (contractId, direction) => {
    setTranslatingId(contractId);
    try {
      const formData = new FormData();
      formData.append('direction', direction);
      const res = await axios.post(`${API}/contracts/${contractId}/translate`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Translation completed!');
      fetchContracts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Translation failed');
    } finally {
      setTranslatingId(null);
    }
  };

  const signContract = async (contractId) => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      toast.error('Please provide your signature.');
      return;
    }
    if (!signerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    try {
      const signatureData = sigCanvasRef.current.toDataURL('image/png');
      await axios.post(`${API}/contracts/${contractId}/sign`, {
        contract_id: contractId,
        signer_name: signerName,
        signature_data: signatureData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contract signed successfully!');
      setSigningContractId(null);
      setSignerName('');
      fetchContracts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Signing failed');
    }
  };

  const deleteContract = (contractId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">Delete this contract?</p>
        <p className="text-xs text-gray-500 mb-3">This removes the uploaded file permanently. Renters with pending bookings will lose access to it.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/contracts/${contractId}`, { headers: { Authorization: `Bearer ${token}` } });
                toast.success('Contract deleted.');
                fetchContracts();
              } catch (err) {
                toast.error('Failed to delete contract.');
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-contract-${contractId}`}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const downloadContract = (contractId) => {
    window.open(`${API}/contracts/download/${contractId}`, '_blank');
  };

  const getFileIcon = (type) => {
    if (type === 'pdf') return '📄';
    if (type === 'docx') return '📝';
    return '🖼️';
  };

  const getStatusBadge = (contract) => {
    if (contract.signed) {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Signed</span>;
    }
    if (contract.translation_status === 'completed') {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Translated</span>;
    }
    if (contract.translation_status === 'pending') {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Translating...</span>;
    }
    return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Uploaded</span>;
  };

  const getPropertyTitle = (propertyId) => {
    const p = properties.find(prop => prop.id === propertyId);
    return p ? p.title : propertyId;
  };

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

  return (
    <div className="space-y-6" data-testid="contract-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
          Contracts
        </h2>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: '#1E6A6A' }}
          data-testid="upload-contract-btn"
        >
          <Upload size={16} />
          Upload Contract
        </button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" data-testid="upload-form">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Upload New Contract</h3>
            <button onClick={() => { setShowUploadForm(false); setSelectedFile(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Property Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Property</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
              data-testid="contract-property-select"
            >
              <option value="">Choose a property...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.title} — {p.area}</option>
              ))}
            </select>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragActive ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-300 hover:border-[#D4AF37] hover:bg-gray-50'
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
                <FileText size={24} className="text-[#1E6A6A]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-red-400 hover:text-red-600 ml-2">
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

          {/* Upload Button */}
          <button
            onClick={uploadContract}
            disabled={uploading || !selectedFile || !selectedPropertyId}
            className="mt-4 w-full py-3 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all hover:shadow-md"
            style={{ backgroundColor: '#D4AF37' }}
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
      )}

      {/* Contracts List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-[#1E6A6A]" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center" data-testid="no-contracts">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg font-medium">No contracts yet</p>
          <p className="text-gray-400 text-sm mt-1">Upload your first rental contract to get started.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="contracts-list">
          {contracts.map((contract) => (
            <div key={contract.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`contract-${contract.id}`}>
              {/* Contract Header Row */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer"
                onClick={() => setExpandedContract(expandedContract === contract.id ? null : contract.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{getFileIcon(contract.file_type)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{contract.original_filename}</p>
                    <p className="text-xs text-gray-500">{getPropertyTitle(contract.property_id)} • {formatDate(contract.created_at)} • {formatFileSize(contract.file_size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {getStatusBadge(contract)}
                  {expandedContract === contract.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedContract === contract.id && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-4 pb-4">
                    <button
                      onClick={() => downloadContract(contract.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-colors"
                      data-testid={`download-btn-${contract.id}`}
                    >
                      <Download size={14} /> Download
                    </button>
                    {!contract.signed && (
                      <button
                        onClick={() => setSigningContractId(signingContractId === contract.id ? null : contract.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
                        data-testid={`sign-btn-${contract.id}`}
                      >
                        <PenTool size={14} /> Sign
                      </button>
                    )}
                    <button
                      onClick={() => deleteContract(contract.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors"
                      data-testid={`delete-btn-${contract.id}`}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>

                  {/* Translation Section */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-4" data-testid={`translate-section-${contract.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Languages size={18} className="text-[#1E6A6A]" />
                        <h4 className="text-sm font-semibold text-gray-800">Translation</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => translateContract(contract.id, 'he-en')}
                          disabled={translatingId === contract.id || !contract.extracted_text}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
                          style={{ backgroundColor: '#1E6A6A' }}
                          data-testid={`translate-he-en-${contract.id}`}
                        >
                          {translatingId === contract.id ? <Loader2 size={12} className="animate-spin" /> : null}
                          Hebrew → English
                        </button>
                        <button
                          onClick={() => translateContract(contract.id, 'en-he')}
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

                    {!contract.extracted_text && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs">
                        <AlertCircle size={14} />
                        No readable text was extracted from this file. Translation is not available for this contract.
                      </div>
                    )}

                    {contract.extracted_text && (
                      <div>
                        {/* View mode toggle */}
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

                        {/* Text content */}
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

                  {/* Signing Section */}
                  {signingContractId === contract.id && (
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
                              width: 500,
                              height: 150,
                              className: 'w-full',
                              style: { width: '100%', height: '150px' }
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
                          onClick={() => signContract(contract.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                          style={{ backgroundColor: '#D4AF37' }}
                          data-testid={`confirm-sign-btn-${contract.id}`}
                        >
                          <Check size={14} /> Confirm & Sign
                        </button>
                        <button
                          onClick={() => { setSigningContractId(null); setSignerName(''); }}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Signatures Display */}
                  {contract.signatures && contract.signatures.length > 0 && (
                    <div className="bg-green-50 rounded-xl p-4" data-testid={`signatures-${contract.id}`}>
                      <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <Check size={16} /> Signatures ({contract.signatures.length})
                      </h4>
                      <div className="space-y-3">
                        {contract.signatures.map((sig) => (
                          <div key={`${sig.signer_name}-${sig.signed_at}`} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-green-200">
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractManager;
