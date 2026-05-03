import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { FileText, PenTool, Check, Download, Loader2, AlertCircle, X, MapPin, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '/api';

const SignContract = () => {
  const { t } = useTranslation();
  const { signToken } = useParams();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [showText, setShowText] = useState(false);
  const sigCanvasRef = useRef(null);

  useEffect(() => {
    fetchContract();
  }, [signToken]);

  const fetchContract = async () => {
    try {
      const res = await axios.get(`${API}/contracts/sign/${signToken}`);
      setContract(res.data);
      if (res.data.signed) setSigned(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired signing link.');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signerName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      toast.error('Please draw your signature.');
      return;
    }
    setSigning(true);
    try {
      const signatureData = sigCanvasRef.current.toDataURL('image/png');
      await axios.post(`${API}/contracts/sign/${signToken}`, {
        signer_name: signerName,
        signature_data: signatureData
      });
      toast.success('Contract signed successfully!');
      setSigned(true);
      fetchContract();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sign.');
    } finally {
      setSigning(false);
    }
  };

  const downloadContract = () => {
    if (contract) {
      window.open(`${API}/contracts/download/${contract.id}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-[#1E6A6A]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl p-8 border border-red-200 max-w-md text-center shadow-sm">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t('sign.invalidLink')}</h2>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1E6A6A]" style={{ fontFamily: 'Playfair Display' }}>MyIsraelRental</h1>
          <p className="text-xs text-[#D4AF37] tracking-widest uppercase mt-1">{t('sign.subleaseContract')}</p>
        </div>

        {/* Contract Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid="sign-contract-card">
          {/* Title Bar */}
          <div className="bg-gradient-to-r from-[#1E6A6A] to-[#267a7a] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <FileText size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t('sign.subleaseAgreement')}</h2>
                <p className="text-white/70 text-sm">{contract.original_filename}</p>
              </div>
            </div>
          </div>

          {/* Sublease Details */}
          {contract.sublease && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 mb-2">{contract.sublease.title}</h3>
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                {contract.sublease.area && (
                  <span className="flex items-center gap-1"><MapPin size={12} /> {contract.sublease.area}</span>
                )}
                {contract.sublease.available_from && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(contract.sublease.available_from).toLocaleDateString()} — {new Date(contract.sublease.available_to).toLocaleDateString()}
                  </span>
                )}
                {contract.sublease.price > 0 && (
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#D4AF37' }}>
                    <DollarSign size={12} />
                    {contract.sublease.currency === 'USD' ? '$' : '₪'}{contract.sublease.price.toLocaleString()}{contract.sublease.price_type === 'per_night' ? t('sign.perNightSuffix') : t('sign.totalSuffix')}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="p-6 space-y-5">
            {/* Contract Text */}
            {contract.extracted_text && (
              <div>
                <button
                  onClick={() => setShowText(!showText)}
                  className="flex items-center gap-2 text-sm font-medium text-[#1E6A6A] hover:underline mb-2"
                >
                  <FileText size={14} />
                  {showText ? t('sign.hideText') : t('sign.viewText')}
                </button>
                {showText && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 max-h-72 overflow-y-auto">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{contract.extracted_text}</p>
                  </div>
                )}
              </div>
            )}

            {/* Download */}
            <button
              onClick={downloadContract}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-colors"
              data-testid="download-contract-btn"
            >
              <Download size={16} /> {t('sign.downloadContract')}
            </button>

            {/* Existing Signatures */}
            {contract.signatures && contract.signatures.length > 0 && (
              <div className="bg-green-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Check size={16} /> {t('sign.signedBy')}
                </h4>
                <div className="space-y-2">
                  {contract.signatures.map((sig) => (
                    <div key={`${sig.signer_name}-${sig.signed_at}`} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-green-200">
                      <img src={sig.signature_data} alt="Signature" className="h-10 w-auto border border-gray-100 rounded" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sig.signer_name}</p>
                        <p className="text-xs text-gray-500">{t('sign.signedOn')} {new Date(sig.signed_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signing Section */}
            {!signed ? (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200" data-testid="signing-section">
                <div className="flex items-center gap-2 mb-4">
                  <PenTool size={18} className="text-[#D4AF37]" />
                  <h4 className="text-base font-bold text-gray-800">{t('sign.signThisContract')}</h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sign.fullLegalName')}</label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder={t('sign.fullLegalNamePlaceholder')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm"
                      data-testid="signer-name-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('sign.drawSignature')}</label>
                    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 overflow-hidden">
                      <SignatureCanvas
                        ref={sigCanvasRef}
                        penColor="#1E6A6A"
                        canvasProps={{
                          width: 600,
                          height: 160,
                          className: 'w-full',
                          style: { width: '100%', height: '160px' }
                        }}
                      />
                    </div>
                    <button
                      onClick={() => sigCanvasRef.current?.clear()}
                      className="text-xs text-gray-400 hover:text-red-500 mt-1.5 transition-colors"
                    >
                      {t('sign.clearSignature')}
                    </button>
                  </div>

                  <button
                    onClick={handleSign}
                    disabled={signing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50 transition-all hover:shadow-lg"
                    style={{ backgroundColor: '#D4AF37' }}
                    data-testid="confirm-sign-btn"
                  >
                    {signing ? (
                      <><Loader2 size={16} className="animate-spin" /> {t('sign.signing')}</>
                    ) : (
                      <><Check size={16} /> {t('sign.confirmAndSign')}</>
                    )}
                  </button>

                  <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                    {t('sign.signingDisclaimer')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={28} className="text-green-600" />
                </div>
                <h4 className="text-lg font-bold text-green-800">{t('sign.contractSigned')}</h4>
                <p className="text-sm text-green-600 mt-1">{t('sign.contractSignedMsg')}</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">{t('sign.footer')}</p>
      </div>
    </div>
  );
};

export default SignContract;
