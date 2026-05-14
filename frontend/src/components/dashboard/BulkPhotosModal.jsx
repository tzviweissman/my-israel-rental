import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Image as ImageIcon, Trash2, CheckCircle2, Loader2, Sparkles,
} from 'lucide-react';

/**
 * Bulk Photos Modal — drag/drop a batch of photos and either fan them out
 * to every selected property ("Same to all"), or assign distinct sets to
 * distinct properties ("Different per property"). Photos upload via the
 * existing `/api/upload/multiple` then attach via `/api/properties/bulk-images`.
 */

// ---------------------------------------------------------------------------
// File-level helpers — kept inside the file because they're only used here.
// ---------------------------------------------------------------------------
const PhotoThumb = ({ file, onRemove }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
      {src && <img src={src} alt={file.name} className="w-full h-full object-cover" />}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
};

const DropZone = ({ label, files, onFiles, onRemove, compact, testid }) => {
  const inputRef = useRef(null);
  const [hover, setHover] = useState(false);
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => { e.preventDefault(); setHover(false); onFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center ${
          hover ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-200 hover:border-gray-300'
        } ${compact ? 'py-4 px-3' : 'py-8 px-4'}`}
        data-testid={testid}
      >
        <ImageIcon size={compact ? 18 : 26} className="mx-auto text-gray-400 mb-1.5" />
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>{label}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <div className={`mt-3 grid ${compact ? 'grid-cols-6' : 'grid-cols-4 md:grid-cols-6'} gap-2`}>
          {files.map((f, i) => (
            <PhotoThumb key={`${f.name}-${i}`} file={f} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Public modal component.
// ---------------------------------------------------------------------------
const BulkPhotosModal = ({ properties, onClose, onSaved, API, token, auth }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('shared'); // 'shared' | 'per_property'
  const [sharedFiles, setSharedFiles] = useState([]);
  const [perPropFiles, setPerPropFiles] = useState({}); // { pid: File[] }
  const [progress, setProgress] = useState(null); // { current, total }
  const [saving, setSaving] = useState(false);

  const onDropFiles = (files, pid) => {
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (mode === 'shared' || !pid) {
      setSharedFiles(prev => [...prev, ...fileList]);
    } else {
      setPerPropFiles(prev => ({ ...prev, [pid]: [...(prev[pid] || []), ...fileList] }));
    }
  };

  const removeShared = (i) => setSharedFiles(prev => prev.filter((_, idx) => idx !== i));
  const removePer = (pid, i) => setPerPropFiles(prev => ({ ...prev, [pid]: (prev[pid] || []).filter((_, idx) => idx !== i) }));

  const uploadFiles = async (files) => {
    if (!files.length) return [];
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    const res = await axios.post(`${API}/upload/multiple`, fd, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    });
    return (res.data || []).filter(r => r.url).map(r => r.url);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'shared') {
        if (!sharedFiles.length) { toast.error(t('bulk.addOnePhoto')); setSaving(false); return; }
        setProgress({ current: 0, total: 1 });
        const urls = await uploadFiles(sharedFiles);
        setProgress({ current: 1, total: 1 });
        await axios.post(
          `${API}/properties/bulk-images`,
          { property_ids: properties.map(p => p.id), image_urls: urls },
          auth,
        );
        toast.success(t('bulk.addedPhotos', { count: urls.length, props: properties.length }));
      } else {
        const pids = Object.keys(perPropFiles).filter(pid => (perPropFiles[pid] || []).length);
        if (!pids.length) { toast.error(t('bulk.dropOntoOne')); setSaving(false); return; }
        setProgress({ current: 0, total: pids.length });
        const per_property = {};
        let i = 0;
        for (const pid of pids) {
          per_property[pid] = await uploadFiles(perPropFiles[pid]);
          i += 1;
          setProgress({ current: i, total: pids.length });
        }
        await axios.post(
          `${API}/properties/bulk-images`,
          { property_ids: pids, image_urls: [], per_property },
          auth,
        );
        toast.success(t('bulk.addedPhotosPerProp', { count: pids.length }));
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('bulk.photoUploadFailed'));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end md:items-center justify-center" data-testid="bulk-photos-modal">
      <div className="bg-white w-full md:max-w-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('bulk.bulkAddPhotos')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t('bulk.photosPropertiesSelected', { count: properties.length })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" data-testid="bulk-photos-close"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="inline-flex bg-gray-100 rounded-lg p-1 text-sm">
            <button
              onClick={() => setMode('shared')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'shared' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500'}`}
              data-testid="bulk-photos-mode-shared"
            >
              <Sparkles size={12} className="inline -mt-0.5 mr-1" />
              {t('bulk.photosSamePhotos')}
            </button>
            <button
              onClick={() => setMode('per_property')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'per_property' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500'}`}
              data-testid="bulk-photos-mode-per"
            >
              {t('bulk.photosDifferentPerProp')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'shared' ? (
            <DropZone
              label={t('bulk.dropHere')}
              files={sharedFiles}
              onFiles={(f) => onDropFiles(f)}
              onRemove={removeShared}
              testid="bulk-photos-shared-drop"
            />
          ) : (
            <div className="space-y-3">
              {properties.map(p => (
                <div key={p.id} className="rounded-xl border border-gray-200 p-3" data-testid={`bulk-photos-row-${p.id}`}>
                  <div className="font-medium text-sm mb-2">{p.title}</div>
                  <DropZone
                    label={t('bulk.dropPerProp')}
                    files={perPropFiles[p.id] || []}
                    onFiles={(f) => onDropFiles(f, p.id)}
                    onRemove={(i) => removePer(p.id, i)}
                    compact
                    testid={`bulk-photos-drop-${p.id}`}
                  />
                </div>
              ))}
            </div>
          )}
          {progress && (
            <div className="mt-4 text-xs text-gray-600 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#1E6A6A]" />
              {t('bulk.uploadingProgress', { current: progress.current, total: progress.total })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" data-testid="bulk-photos-cancel">{t('admin.cancel')}</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#D4AF37] text-white hover:bg-[#b8962f] disabled:bg-gray-300 flex items-center gap-2"
            data-testid="bulk-photos-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t('bulk.saveAndApplyShort')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPhotosModal;
