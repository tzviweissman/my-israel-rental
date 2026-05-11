import React from 'react';
import { FileText, Upload, Loader2, Copy, Check } from 'lucide-react';

/**
 * One row in the renter's "Your Sublease Listings" table. Owns nothing —
 * the parent supplies the data + callback handlers.
 */
const SubleaseListItem = ({
  sub,
  imageUrl,
  uploadingFor,
  copiedSignLink,
  onEdit,
  onToggleActive,
  onConfirmDelete,
  onUpload,
  onCopySignLink,
}) => {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
      data-testid={`sublease-${sub.id}`}
    >
      <div className="flex items-center gap-4 p-4">
        <div
          className="w-16 h-16 rounded-lg bg-gray-200 shrink-0"
          style={{
            backgroundImage: `url(${imageUrl(sub.images)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-800 truncate">{sub.title}</p>
          <p className="text-xs text-gray-500">
            {sub.area} • {sub.bedrooms_available} bed
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(sub.available_from).toLocaleDateString()} —{' '}
            {new Date(sub.available_to).toLocaleDateString()}
          </p>
          {sub.holiday_tags && sub.holiday_tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {sub.holiday_tags.includes('sukkot') && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D4AF37]/15 text-[#8a6d1d]">
                  Sukkot
                </span>
              )}
              {sub.holiday_tags.includes('pesach') && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D4AF37]/15 text-[#8a6d1d]">
                  Pesach
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold" style={{ color: '#D4AF37' }}>
            {sub.currency === 'USD' ? '$' : '₪'}
            {sub.price?.toLocaleString()}
            <span className="text-[10px] font-normal text-gray-500">
              {sub.price_type === 'per_night' ? '/night' : ' total'}
            </span>
          </p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              sub.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {sub.active ? 'Active' : 'Paused'}
          </span>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => onEdit(sub)}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
            data-testid={`edit-sublease-${sub.id}`}
          >
            Edit
          </button>
          <button
            onClick={() => onToggleActive(sub.id, sub.active)}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-colors"
            data-testid={`toggle-sublease-${sub.id}`}
          >
            {sub.active ? 'Pause' : 'Activate'}
          </button>
          <button
            onClick={() => onConfirmDelete(sub.id)}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors"
            data-testid={`delete-sublease-${sub.id}`}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
        {sub.contract_id && sub.sign_token ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText size={16} className="text-[#1E6A6A] shrink-0" />
              <span className="text-xs font-medium text-gray-700 truncate">Contract uploaded</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                  sub.contract_signed
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {sub.contract_signed ? 'Signed' : 'Awaiting signature'}
              </span>
            </div>
            <button
              onClick={() => onCopySignLink(sub.sign_token)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1E6A6A]/20 text-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors shrink-0"
              data-testid={`copy-sign-link-${sub.id}`}
            >
              {copiedSignLink === sub.sign_token ? (
                <>
                  <Check size={12} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy Signing Link
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onUpload(sub.id)}
              disabled={uploadingFor === sub.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors disabled:opacity-50"
              data-testid={`upload-contract-${sub.id}`}
            >
              {uploadingFor === sub.id ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload size={12} /> Upload Contract for Sublessee to Sign
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubleaseListItem;
