import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const CancelBookingModal = ({
  isOpen,
  onClose,
  onSubmit,
  type, // 'cancel', 'request', 'deny'
  processing
}) => {
  const { t } = useTranslation();
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');

  const handleSubmit = () => {
    const reason = cancelReason === 'other' ? customCancelReason : cancelReason;
    onSubmit(reason);
  };

  const handleClose = () => {
    setCancelReason('');
    setCustomCancelReason('');
    onClose();
  };

  if (!isOpen) return null;

  const getTitle = () => {
    switch(type) {
      case 'cancel': return t('cancelBooking.titleCancel');
      case 'request': return t('cancelBooking.titleRequest');
      case 'deny': return t('cancelBooking.titleDeny');
      default: return t('cancelBooking.titleCancel');
    }
  };

  const getButtonText = () => {
    switch(type) {
      case 'cancel': return t('cancelBooking.titleCancel');
      case 'request': return t('cancelBooking.titleRequest');
      case 'deny': return t('cancelBooking.btnDeny');
      default: return t('common.submit');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]" onClick={handleClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{getTitle()}</h3>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            {type === 'deny' ? t('cancelBooking.denialLabel') : t('cancelBooking.cancellationLabel')}
          </label>
          <select
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50 mb-3"
          >
            <option value="">{t('cancelBooking.selectReason')}</option>
            <option value="change_of_plans">{t('cancelBooking.changeOfPlans')}</option>
            <option value="found_better_option">{t('cancelBooking.foundBetter')}</option>
            <option value="property_issues">{t('cancelBooking.propertyIssues')}</option>
            <option value="scheduling_conflict">{t('cancelBooking.scheduling')}</option>
            <option value="financial_reasons">{t('cancelBooking.financialReasons')}</option>
            <option value="other">{t('cancelBooking.otherLabel')}</option>
          </select>

          {cancelReason === 'other' && (
            <textarea
              value={customCancelReason}
              onChange={(e) => setCustomCancelReason(e.target.value)}
              placeholder={t('cancelBooking.otherSpecify')}
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/50"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={processing || !cancelReason || (cancelReason === 'other' && !customCancelReason)}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? t('cancelBooking.processing') : getButtonText()}
          </button>
          <button
            onClick={handleClose}
            disabled={processing}
            className="px-4 py-3 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelBookingModal;
