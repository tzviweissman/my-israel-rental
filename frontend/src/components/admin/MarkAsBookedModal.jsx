import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DateField from '../common/DateField';
import { CalendarX, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Modal for the super-admin "Mark as booked" action.
 */
export const MarkAsBookedModal = ({ open, target, selectedCount = 0, saving = false, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockIndefinite, setBlockIndefinite] = useState(false);

  // Reset the form each time the modal opens
  useEffect(() => {
    if (open) {
      setBlockStart('');
      setBlockEnd('');
      setBlockIndefinite(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!blockIndefinite) {
      if (!blockStart || !blockEnd) {
        toast.error('Pick start & end dates, or tick "Block indefinitely".');
        return;
      }
      if (blockEnd <= blockStart) {
        toast.error('End date must be after start date.');
        return;
      }
    }
    onSubmit({
      start_date: blockIndefinite ? null : blockStart,
      end_date: blockIndefinite ? null : blockEnd,
      indefinite: blockIndefinite,
    });
  };

  const noun = selectedCount === 1 ? t('admin.propertyWord') : t('admin.propertiesWord');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      data-testid="mark-booked-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100"
          data-testid="close-mark-booked-modal"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <CalendarX size={20} className="text-amber-600" />
          <h2 className="text-lg font-bold">{t('admin.markAsBookedTitle')}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          {target?.mode === 'bulk'
            ? t('admin.markBookedDescBulk', { count: selectedCount, noun })
            : t('admin.markBookedDescSingle')}
        </p>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={blockIndefinite}
            onChange={e => setBlockIndefinite(e.target.checked)}
            data-testid="block-indefinite-checkbox"
          />
          <span className="text-sm font-medium">{t('admin.blockIndefinitely')}</span>
        </label>

        <div className={`grid grid-cols-2 gap-3 mb-5 ${blockIndefinite ? 'opacity-40' : ''}`}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('admin.startDate')}</label>
            <DateField
              value={blockStart}
              onChange={setBlockStart}
              disabled={blockIndefinite}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-not-allowed"
              testid="block-start-date"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('admin.endDate')}</label>
            <DateField
              value={blockEnd}
              onChange={setBlockEnd}
              min={blockStart || undefined}
              disabled={blockIndefinite}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-not-allowed"
              testid="block-end-date"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
            data-testid="cancel-mark-booked-btn"
          >
            {t('admin.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50"
            data-testid="confirm-mark-booked-btn"
          >
            {saving ? t('admin.saving') : t('admin.markAsBooked')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkAsBookedModal;
