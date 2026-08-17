import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { API, AuthContext } from '../App';
import ContractUploadForm from './contracts/ContractUploadForm';
import ContractListItem from './contracts/ContractListItem';

/**
 * Owner-side contract manager: list/upload/translate/sign/delete contracts.
 * Owns all server state + API calls; the row + upload card live in
 * /components/contracts/. This is a pure orchestrator.
 */
const ContractManager = ({ properties }) => {
  const { user, token } = useContext(AuthContext);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [expandedContract, setExpandedContract] = useState(null);
  const [translatingId, setTranslatingId] = useState(null);
  const [signingContractId, setSigningContractId] = useState(null);
  const [signerName, setSignerName] = useState('');

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (user && token) fetchContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/contracts`, auth);
      setContracts(res.data);
    } catch (err) {
      console.error('Failed to fetch contracts', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadContract = async (file, propertyId) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('property_id', propertyId);
      await axios.post(`${API}/contracts/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Contract uploaded successfully!');
      setShowUploadForm(false);
      fetchContracts();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const translateContract = async (contractId, direction) => {
    setTranslatingId(contractId);
    try {
      const formData = new FormData();
      formData.append('direction', direction);
      await axios.post(`${API}/contracts/${contractId}/translate`, formData, auth);
      toast.success('Translation completed!');
      fetchContracts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Translation failed');
    } finally {
      setTranslatingId(null);
    }
  };

  const signContract = async (contractId, signatureData) => {
    if (!signatureData) return toast.error('Please provide your signature.');
    if (!signerName.trim()) return toast.error('Please enter your name.');
    try {
      await axios.post(`${API}/contracts/${contractId}/sign`, {
        contract_id: contractId,
        signer_name: signerName,
        signature_data: signatureData,
      }, auth);
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
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/contracts/${contractId}`, auth);
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

  const getPropertyTitle = (propertyId) => {
    const p = properties.find((prop) => prop.id === propertyId);
    return p ? p.title : propertyId;
  };

  return (
    <div className="space-y-6" data-testid="contract-manager">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
          Contracts
        </h2>
        <button
          onClick={() => setShowUploadForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: 'var(--brand-primary)' }}
          data-testid="upload-contract-btn"
        >
          <Upload size={16} />
          Upload Contract
        </button>
      </div>

      {showUploadForm && (
        <ContractUploadForm
          properties={properties}
          uploading={uploading}
          onUpload={uploadContract}
          onClose={() => setShowUploadForm(false)}
          onError={(msg) => toast.error(msg)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-[var(--brand-primary)]" />
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
            <ContractListItem
              key={contract.id}
              contract={contract}
              propertyTitle={getPropertyTitle(contract.property_id)}
              expanded={expandedContract === contract.id}
              onToggleExpand={() =>
                setExpandedContract(expandedContract === contract.id ? null : contract.id)
              }
              translatingId={translatingId}
              onTranslate={translateContract}
              isSigning={signingContractId === contract.id}
              onBeginSign={() =>
                setSigningContractId(signingContractId === contract.id ? null : contract.id)
              }
              onCancelSign={() => { setSigningContractId(null); setSignerName(''); }}
              onConfirmSign={(signatureData) => signContract(contract.id, signatureData)}
              signerName={signerName}
              setSignerName={setSignerName}
              onDownload={downloadContract}
              onDelete={deleteContract}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractManager;
