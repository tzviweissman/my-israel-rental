import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import UndoBulkDeleteSnackbar from './UndoBulkDeleteSnackbar';

/**
 * Confirmation toast for the Admin bulk delete action.
 *
 * Hosts the destructive confirm/cancel buttons plus an opt-in
 * "Auto-rescue duplicates" checkbox. When checked, the backend looks for
 * a surviving duplicate twin per row (same owner + address + rental_type
 * + bedrooms + floor, excluding everything also in this batch) and
 * REATTACHES chats / bookings / likes / images to it instead of
 * tombstoning. Best of both worlds: the legacy Undo path still works
 * for any row without a twin; rows WITH a twin are silently merged so
 * the renter conversation tree stays alive.
 */
const BulkDeleteConfirmToast = ({
  tid, ids, t, API, headers,
  setSelectedPropIds, fetchProperties, notifyStatsChange,
}) => {
  const [autoRescue, setAutoRescue] = useState(true);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await axios.delete(
        `${API}/admin/properties/bulk`,
        { headers, data: { property_ids: ids, auto_rescue_duplicates: autoRescue } },
      );
      toast.dismiss(tid);
      const {
        deleted = 0,
        messages_deleted = 0,
        bookings_deleted = 0,
        snapshot_id,
        rescued_count = 0,
        rescue_totals = {},
      } = res.data || {};
      setSelectedPropIds(new Set());
      fetchProperties();
      notifyStatsChange();

      const summary = `${deleted} ${deleted === 1
        ? t('admin.listingDeletedOne', 'listing deleted')
        : t('admin.listingDeletedMany', 'listings deleted')}`;
      const cleanup = (messages_deleted || bookings_deleted)
        ? ` (${messages_deleted} ${t('admin.messages', 'messages')}, ${bookings_deleted} ${t('admin.bookings', 'bookings')})`
        : '';
      const rescued = rescued_count > 0
        ? ` · rescued ${rescued_count} into duplicate twins (${rescue_totals.messages || 0} chats, ${rescue_totals.bookings || 0} bookings, ${rescue_totals.images_merged || 0} photos)`
        : '';

      if (snapshot_id) {
        toast.custom((undoTid) => (
          <UndoBulkDeleteSnackbar
            tid={undoTid}
            message={summary + cleanup + rescued}
            snapshotId={snapshot_id}
            headers={headers}
            onRestored={fetchProperties}
            notifyStatsChange={notifyStatsChange}
          />
        ), { duration: 10000, position: 'bottom-center' });
      } else {
        // All rows were rescued — no tombstone, no Undo needed.
        toast.success(summary + cleanup + rescued);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete listings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-96" data-testid="bulk-delete-confirm-toast">
      <p className="text-sm font-semibold text-gray-800 mb-1">
        {t('admin.bulkDeleteTitle', `Delete ${ids.length} listing${ids.length === 1 ? '' : 's'}?`, { count: ids.length })}
      </p>
      <p className="text-xs text-gray-500 mb-3">
        {t(
          'admin.bulkDeleteDesc',
          'This permanently removes the properties and their related chats, bookings and admin blocks. This cannot be undone.',
        )}
      </p>
      <label
        className="flex items-start gap-2 mb-4 p-2 rounded-lg cursor-pointer hover:bg-gray-50"
        style={{ border: '1px solid #e5e0d2' }}
        data-testid="auto-rescue-duplicates-row"
      >
        <input
          type="checkbox"
          checked={autoRescue}
          onChange={(e) => setAutoRescue(e.target.checked)}
          className="mt-0.5 accent-[var(--brand-primary)]"
          data-testid="auto-rescue-duplicates-checkbox"
        />
        <div>
          <p className="text-xs font-semibold text-gray-800 leading-snug">
            {t('admin.autoRescueDupesLabel', 'Auto-rescue duplicates')}
          </p>
          <p className="text-[11px] text-gray-500 leading-snug">
            {t(
              'admin.autoRescueDupesHelp',
              'If any deleted row has a surviving duplicate twin, move its chats, bookings & photos there instead of throwing them away.',
            )}
          </p>
        </div>
      </label>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => toast.dismiss(tid)}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
          data-testid="cancel-bulk-delete-btn"
        >
          {t('admin.cancel')}
        </button>
        <button
          onClick={confirm}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60"
          data-testid="confirm-bulk-delete-btn"
        >
          {busy ? t('admin.deleting', 'Deleting...') : `${t('admin.deleteAction', 'Delete')} (${ids.length})`}
        </button>
      </div>
    </div>
  );
};

export default BulkDeleteConfirmToast;
