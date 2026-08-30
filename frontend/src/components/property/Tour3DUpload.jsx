/**
 * "Add 3D Tour" — the owner's side of the walkthrough feature.
 *
 * THE UPLOAD DOES NOT GO THROUGH OUR SERVER. The browser asks the backend
 * to sign an upload, then POSTs the file straight to Cloudinary's edge.
 * A 500MB walkthrough over a domestic uplink is slow enough already
 * without relaying it through a Railway container, and our backend stays
 * out of the bandwidth path entirely. Same mechanism the gallery uploads
 * already use (`/api/cloudinary/signature`), with a per-listing folder so
 * a leaked signature cannot be pointed at anything else.
 *
 * VALIDATION HAPPENS TWICE, ON PURPOSE. Here, so somebody who picked a
 * 2GB file finds out in a second rather than after a twenty-minute
 * upload; and again on the server, which re-reads the real duration and
 * size from Cloudinary rather than believing anything this file sends.
 * The check here is a courtesy to the owner, not a control.
 *
 * WHY THE DURATION CHECK IS ASYNC. There is no way to know how long a
 * video is without decoding its metadata, so we load it into a detached
 * <video> and wait. It can fail — a codec the browser cannot parse — and
 * when it does we let the upload proceed and let the server reject it,
 * because refusing a file we simply could not measure would block valid
 * footage on older browsers.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  Box, Upload, Loader2, AlertCircle, CheckCircle2, Trash2,
} from 'lucide-react';
import { API } from '../../App';

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_SECONDS = 5 * 60;
const ACCEPT = 'video/mp4,video/quicktime';

// How often we ask whether the reconstruction has finished. The work takes
// minutes, so a tight poll would be thousands of pointless requests; slow
// enough to be cheap, quick enough that an owner who waits sees it flip.
const POLL_MS = 15000;

/** Read a video's duration in seconds, or null if it cannot be measured. */
const probeDuration = (file) => new Promise((resolve) => {
  let url;
  try {
    url = URL.createObjectURL(file);
  } catch {
    resolve(null);
    return;
  }
  const video = document.createElement('video');
  let settled = false;
  const finish = (value) => {
    if (settled) return;
    settled = true;
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
    resolve(value);
  };
  // Some browsers never fire either event for an unsupported codec.
  const timer = setTimeout(() => finish(null), 8000);
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    clearTimeout(timer);
    finish(Number.isFinite(video.duration) ? video.duration : null);
  };
  video.onerror = () => { clearTimeout(timer); finish(null); };
  video.src = url;
});

export default function Tour3DUpload({ propertyId, token, onChange }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  const [tour, setTour] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/properties/${propertyId}/tour`, authHeaders);
      setTour(res.data?.tour || null);
      return res.data?.tour || null;
    } catch {
      // A listing with no tour is the normal case, not an error worth
      // showing. Anything else is transient and the poll will retry.
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, token]);

  useEffect(() => { load(); }, [load]);

  // Poll only while there is something to wait for. An interval that runs
  // regardless is the usual way a detail page ends up making a request
  // every fifteen seconds forever.
  useEffect(() => {
    if (tour?.status !== 'processing') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      const next = await load();
      if (next && next.status !== 'processing') onChange?.(next);
    }, POLL_MS);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.status, load]);

  const pick = () => { setError(''); inputRef.current?.click(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Clear immediately so picking the same file twice still fires change.
    e.target.value = '';
    if (!file) return;

    setError('');

    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      setError(t('tour3d.errFormat', 'Please choose an MP4 or MOV video.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = Math.round(file.size / (1024 * 1024));
      setError(t('tour3d.errSize', 'That video is {{mb}}MB. The limit is 500MB.', { mb }));
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const seconds = await probeDuration(file);
      if (seconds !== null && seconds > MAX_SECONDS) {
        setError(t('tour3d.errLength', 'That video is {{min}} minutes long. The limit is 5 minutes.', {
          min: Math.round(seconds / 60),
        }));
        setBusy(false);
        return;
      }

      // 1. Reserve the tour and get a signature scoped to this listing.
      const begin = await axios.post(
        `${API}/properties/${propertyId}/tour`, {}, authHeaders,
      );
      const up = begin.data.upload;

      // 2. Straight to Cloudinary.
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', up.api_key);
      form.append('timestamp', up.timestamp);
      form.append('signature', up.signature);
      form.append('folder', up.folder);
      form.append('public_id', up.public_id);

      const cloud = await axios.post(
        `https://api.cloudinary.com/v1_1/${up.cloud_name}/video/upload`,
        form,
        {
          onUploadProgress: (evt) => {
            if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
          },
        },
      );

      // 3. Tell the backend it landed; it verifies and starts the job.
      await axios.post(
        `${API}/properties/${propertyId}/tour/attach`,
        { public_id: cloud.data.public_id },
        authHeaders,
      );

      const next = await load();
      onChange?.(next);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === 'string' && detail
          ? detail
          : t('tour3d.errUpload', 'The upload did not finish. Please try again.'),
      );
      // Report it so a pattern of failures is visible server-side rather
      // than only in one person's console.
      try {
        await axios.post(`${API}/upload-failure`, {
          where: '3d-tour', count: 1, reason: String(detail || err?.message || 'unknown'),
        }, authHeaders);
      } catch { /* the report failing must not mask the real error */ }
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await axios.delete(`${API}/properties/${propertyId}/tour`, authHeaders);
      setTour(null);
      onChange?.(null);
    } catch {
      setError(t('tour3d.errRemove', 'Could not remove the tour. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const status = tour?.status;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)' }}
      data-testid="tour3d-upload"
      data-status={status || 'none'}
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className="w-9 h-9 rounded-xl shrink-0 inline-flex items-center justify-center"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.12)', color: 'var(--brand-primary)' }}
        >
          <Box size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3
            className="text-base font-bold"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('tour3d.title', '3D tour')}
          </h3>
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
            {t('tour3d.blurb',
              'Upload a slow walkthrough video and we turn it into a 3D tour renters can move through. MP4 or MOV, up to 5 minutes.')}
          </p>
        </div>
      </div>

      {status === 'ready' && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-3"
          style={{ background: '#E6F4EA', color: '#2E7D4F' }}
          data-testid="tour3d-ready"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {t('tour3d.ready', 'Your 3D tour is live on the listing.')}
        </div>
      )}

      {status === 'processing' && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm mb-3"
          style={{ background: 'var(--bg)', color: 'var(--brand-muted)' }}
          data-testid="tour3d-processing"
        >
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t('tour3d.processing',
            'Building your 3D tour. This usually takes a while — you can leave this page.')}
        </div>
      )}

      {/* A failed tour is shown to the OWNER only; renters see nothing at
          all. They cannot fix it and a broken-looking listing costs them
          nothing to walk away from. */}
      {status === 'failed' && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm mb-3"
          style={{ background: '#FDECEC', color: '#8A1F1F' }}
          data-testid="tour3d-failed"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {tour?.error || t('tour3d.failed', 'The 3D tour could not be built.')}
            {' '}
            {t('tour3d.failedRetry', 'You can upload a different video.')}
          </span>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm mb-3"
          style={{ background: '#FDECEC', color: '#8A1F1F' }}
          role="alert"
          data-testid="tour3d-error"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {busy && progress > 0 && (
        <div className="mb-3" data-testid="tour3d-progress" data-progress={progress}>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--brand-border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: 'var(--brand-primary)' }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
            {t('tour3d.uploading', 'Uploading… {{pct}}%', { pct: progress })}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
          data-testid="tour3d-input"
        />
        <button
          type="button"
          onClick={pick}
          disabled={busy || status === 'processing'}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          data-testid="tour3d-add"
        >
          {busy
            ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            : <Upload size={16} aria-hidden="true" />}
          {tour
            ? t('tour3d.replace', 'Replace 3D tour')
            : t('tour3d.add', 'Add 3D tour')}
        </button>

        {tour && status !== 'processing' && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border disabled:opacity-50"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
            data-testid="tour3d-remove"
          >
            <Trash2 size={15} aria-hidden="true" />
            {t('tour3d.remove', 'Remove')}
          </button>
        )}
      </div>
    </div>
  );
}
