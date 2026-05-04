import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Star, CheckCircle2 } from 'lucide-react';

/**
 * Cover-image picker modal.
 */
const CoverPickerModal = ({ property, API, auth, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [busyUrl, setBusyUrl] = useState(null);
  const apiOrigin = API.replace('/api', '');
  const images = property?.images || [];

  if (!property) return null;

  const pick = async (url) => {
    if (!url || url === images[0]) return;
    setBusyUrl(url);
    try {
      await axios.post(`${API}/properties/${property.id}/cover`, { image_url: url }, auth);
      toast.success(t('bulk.coverUpdated'));
      onSaved && onSaved(property.id, url);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('bulk.coverFailed'));
    } finally {
      setBusyUrl(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center" data-testid="cover-picker-modal">
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('bulk.chooseCoverPhoto')}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{property.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" data-testid="cover-picker-close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {images.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">{t('bulk.noPhotosYet')}</div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((url, i) => {
                const isCover = i === 0;
                const src = url.startsWith('/api') ? `${apiOrigin}${url}` : url;
                return (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => pick(url)}
                    disabled={busyUrl === url}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                      isCover ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/40' : 'border-transparent hover:border-[#1E6A6A]'
                    }`}
                    data-testid={`cover-pick-${i}`}
                  >
                    <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {isCover && (
                      <div className="absolute top-1 left-1 bg-[#D4AF37] text-white rounded-md px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 shadow">
                        <Star size={10} fill="white" /> {t('bulk.coverBadge')}
                      </div>
                    )}
                    {!isCover && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                        <span className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded-md bg-white text-[#1E6A6A] text-xs font-semibold flex items-center gap-1 shadow">
                          {busyUrl === url ? t('bulk.coverSaving') : <><CheckCircle2 size={12} /> {t('bulk.setAsCover')}</>}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverPickerModal;
