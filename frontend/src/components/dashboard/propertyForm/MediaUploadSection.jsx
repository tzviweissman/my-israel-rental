import React from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Upload, X, Image as ImageIcon, Film, Star } from 'lucide-react';
import { uploadFilesFast } from '../../../utils/fastUpload';

/**
 * Drag/drop upload, progress bar, gallery thumbnails, and "set as cover"
 * promotion for property media. Owns its own uploading/progress state but
 * delegates the persisted `images`/`videos` arrays + the `uploadedFiles`
 * cache to the parent so editing flows hydrate correctly.
 */
const MediaUploadSection = ({
  form,
  setForm,
  uploadedFiles,
  setUploadedFiles,
  API,
  token,
}) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);

    const results = await uploadFilesFast(files, API, token, (fraction) => {
      setProgress(Math.round(fraction * 100));
    });

    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    failed.forEach((f) => toast.error(`Failed to upload ${f.original_name}: ${f.error}`));

    const newImages = ok.filter((f) => f.file_type === 'image').map((f) => f.url);
    const newVideos = ok.filter((f) => f.file_type === 'video').map((f) => f.url);
    setUploadedFiles((prev) => [...prev, ...ok]);
    setForm((prev) => ({
      ...prev,
      images: [...prev.images, ...newImages],
      videos: [...(prev.videos || []), ...newVideos],
    }));
    setUploading(false);
    if (ok.length > 0) toast.success(`${ok.length} file(s) uploaded`);
  };

  const removeUploadedFile = async (fileToRemove) => {
    try {
      await axios.delete(`${API}/upload/${fileToRemove.filename}`, authHeaders);
    } catch (err) {
      // Continue with local removal even if server deletion fails.
    }
    setUploadedFiles((prev) => prev.filter((f) => f.filename !== fileToRemove.filename));
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((u) => u !== fileToRemove.url),
      videos: (prev.videos || []).filter((u) => u !== fileToRemove.url),
    }));
  };

  // Promote one image to "cover" by reordering it to index 0 of `images`.
  const setAsCover = (file) => {
    if (file.file_type !== 'image') return;
    setForm((prev) => {
      if (!prev.images.includes(file.url)) return prev;
      const next = [file.url, ...prev.images.filter((u) => u !== file.url)];
      return { ...prev, images: next };
    });
    setUploadedFiles((prev) => {
      const target = prev.find((f) => f.filename === file.filename);
      if (!target) return prev;
      return [target, ...prev.filter((f) => f.filename !== file.filename)];
    });
  };

  return (
    <div data-testid="file-upload-section">
      <label className="block text-sm font-medium mb-2">{t('property.photosVideos')}</label>
      <div
        className="border-2 border-dashed border-[#E5E5E5] rounded-xl p-6 text-center hover:border-black/30 transition-colors cursor-pointer"
        onClick={() => document.getElementById('file-upload-input').click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('border-black/40', 'bg-gray-50');
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-black/40', 'bg-gray-50');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-black/40', 'bg-gray-50');
          const dt = new DataTransfer();
          Array.from(e.dataTransfer.files).forEach((f) => dt.items.add(f));
          const input = document.getElementById('file-upload-input');
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }}
        data-testid="file-drop-zone"
      >
        <Upload size={32} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 mb-1">{t('property.dragDrop')}</p>
        <p className="text-xs text-gray-400">{t('property.fileTypes')}</p>
        <input
          id="file-upload-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleFileUpload}
          data-testid="file-upload-input"
        />
      </div>

      {uploading && (
        <div className="mt-3" data-testid="upload-progress">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            {t('property.uploading')} {progress}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-black transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <>
          <p className="mt-4 text-xs text-gray-500 flex items-center gap-1.5">
            <Star size={12} className="text-[#D4AF37]" />
            Hover any image and click the star to set it as the cover photo (the one shown to renters first).
          </p>
          <div
            className="mt-2 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
            data-testid="uploaded-files-grid"
          >
            {uploadedFiles.map((file) => {
              const isCover = file.file_type === 'image' && form.images[0] === file.url;
              return (
                <div
                  key={file.filename}
                  className={`relative group rounded-lg overflow-hidden border ${
                    isCover ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/40' : 'border-[#E5E5E5]'
                  }`}
                  data-testid={`uploaded-file-${file.filename}`}
                >
                  {file.file_type === 'image' ? (
                    <img
                      src={file.url.startsWith('/api') ? `${API.replace('/api', '')}${file.url}` : file.url}
                      alt={file.original_name}
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <div className="w-full h-20 bg-gray-900 flex items-center justify-center">
                      <Film size={24} className="text-white" />
                    </div>
                  )}
                  {isCover && (
                    <div
                      className="absolute top-1 left-1 bg-[#D4AF37] text-white rounded-md px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 shadow"
                      data-testid={`cover-badge-${file.filename}`}
                    >
                      <Star size={10} fill="white" /> COVER
                    </div>
                  )}
                  {file.file_type === 'image' && !isCover && (
                    <button
                      type="button"
                      onClick={() => setAsCover(file)}
                      title="Set as cover image"
                      className="absolute top-1 left-1 bg-black/70 hover:bg-[#D4AF37] text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all"
                      data-testid={`set-cover-${file.filename}`}
                    >
                      <Star size={11} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeUploadedFile(file)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`remove-file-${file.filename}`}
                  >
                    <X size={14} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      {file.file_type === 'image' ? (
                        <ImageIcon size={10} className="text-white" />
                      ) : (
                        <Film size={10} className="text-white" />
                      )}
                      <span className="text-[10px] text-white truncate">{file.original_name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default MediaUploadSection;
