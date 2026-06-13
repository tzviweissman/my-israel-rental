import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Undo2, CheckCircle2 } from 'lucide-react';
import { API } from '../../App';

/**
 * Bottom-center snackbar shown after a bulk-delete. Gives the admin a
 * 10-second window to undo the operation by hitting `Undo`. The visual
 * progress bar makes the safety window legible; the backend tombstone
 * stays valid much longer than 10s, but the explicit countdown gives
 * the admin agency without leaving a "what if I want to undo later"
 * mental load on the screen forever.
 */
const UndoBulkDeleteSnackbar = ({ tid, message, snapshotId, headers, onRestored, notifyStatsChange }) => {
  const { t } = useTranslation();
  // remainingPct goes from 100 → 0 over 10 seconds.
  const [remainingPct, setRemainingPct] = useState(100);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const total = 10000;
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(0, 100 - (elapsed / total) * 100);
      setRemainingPct(pct);
      if (pct <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const handleUndo = async () => {
    setRestoring(true);
    try {
      const res = await axios.post(
        `${API}/admin/properties/bulk-restore`,
        { snapshot_id: snapshotId },
        { headers },
      );
      const restored = res.data?.restored ?? 0;
      toast.dismiss(tid);
      toast.success(
        `${restored} ${restored === 1 ? t('admin.listingRestoredOne', 'listing restored') : t('admin.listingRestoredMany', 'listings restored')}`
      );
      if (onRestored) onRestored();
      if (notifyStatsChange) notifyStatsChange();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('admin.undoFailed', 'Could not undo — snapshot may have expired'));
      setRestoring(false);
    }
  };

  return (
    <div
      className="bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 overflow-hidden w-[360px]"
      data-testid="bulk-delete-undo-snackbar"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
        <span className="text-sm flex-1 leading-tight">{message}</span>
        <button
          type="button"
          onClick={handleUndo}
          disabled={restoring}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 text-xs font-semibold transition-colors"
          data-testid="bulk-delete-undo-btn"
        >
          <Undo2 size={14} />
          {restoring ? t('common.loading') : t('common.undo')}
        </button>
      </div>
      {/* Countdown bar — drains right-to-left so RTL users see it the
          same direction as the elapsed time arrow. */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-amber-500 transition-all duration-100"
          style={{ width: `${remainingPct}%` }}
        />
      </div>
    </div>
  );
};

export default UndoBulkDeleteSnackbar;
