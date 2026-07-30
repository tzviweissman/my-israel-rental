import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, EyeOff, Eye, Globe, MessageCircle, Check, Home as HomeIcon, Bell } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { AuthContext } from '../../App';
import NotificationSettings from './NotificationSettings';
import { phoneError, phonePreview } from '../../utils/phoneValidation';

const SettingsTab = ({ user, token, API }) => {
  const { i18n, t } = useTranslation();
  const { login } = useContext(AuthContext);
  const [language, setLanguage] = useState(
    user?.preferred_language || (i18n.language?.startsWith('he') ? 'he' : 'en')
  );
  const [savingLanguage, setSavingLanguage] = useState(false);

  // WhatsApp number editing — backed by the existing ``phone`` column
  // (see PUT /auth/whatsapp). We seed from the current user document so
  // the field shows what we already have on file.
  const [whatsappNumber, setWhatsappNumber] = useState(user?.phone || '');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  // Owner-only opt-out for the automated 12h chat nudge. Absent field
  // treated as enabled (opt-in-to-quiet) — matches the backend default.
  const [autoNudgeOptOut, setAutoNudgeOptOut] = useState(!!user?.auto_nudge_opt_out);
  const [savingAutoNudge, setSavingAutoNudge] = useState(false);
  const isPropertyLister = ['owner', 'manager', 'admin'].includes(user?.role);

  const handleToggleAutoNudge = async () => {
    const next = !autoNudgeOptOut;
    setSavingAutoNudge(true);
    try {
      await axios.put(
        `${API}/user/auto-nudge-opt-out`,
        { opt_out: next },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAutoNudgeOptOut(next);
      toast.success(next
        ? t('settings.autoNudgeOff', 'Auto reminders turned off')
        : t('settings.autoNudgeOn', 'Auto reminders turned on'));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save preference');
    } finally {
      setSavingAutoNudge(false);
    }
  };

  // Role switch: users can flip between renter ↔ owner self-service.
  // Managers can also step down to renter. Admins never see this card —
  // privilege boundary enforced both server-side and here.
  const [switchingRole, setSwitchingRole] = useState(false);
  const role = user?.role;
  // Each entry is one rendered "switch role" CTA. `from` is the user's
  // current role (we already know it), so we only need to declare the
  // target + UI copy. This list is filtered by `role` below.
  const ROLE_OPTIONS = {
    renter: { target: 'owner', title: t('settings.becomeListerTitle', 'Have a place to list?'), hint: t('settings.becomeListerHint', 'Switch your account from Renter to Lister to start posting properties for rent.'), cta: t('settings.becomeListerCta', 'Switch to lister'), note: t('settings.becomeListerNote', "We'll keep your saved searches and favorites.") },
    owner:  { target: 'renter', title: t('settings.becomeRenterTitle', 'Switch back to Renter?'), hint: t('settings.becomeRenterHint', 'Your listings stay safe in the database. You won\'t see the listing-management tools until you switch back to Lister.'), cta: t('settings.becomeRenterCta', 'Switch to renter'), note: t('settings.becomeRenterNote', 'You can switch back to Lister any time from this page.') },
    manager: { target: 'renter', title: t('settings.managerToRenterTitle', 'Step down to Renter?'), hint: t('settings.managerToRenterHint', 'You\'ll lose your manager privileges. Your listings stay safe.'), cta: t('settings.managerToRenterCta', 'Switch to renter'), note: t('settings.managerToRenterNote', 'Contact support if you change your mind — manager role can only be restored by an admin.') },
  };
  const switchOption = ROLE_OPTIONS[role] || null;

  const handleSwitchRole = async (targetRole) => {
    const labelTo = targetRole === 'owner' ? t('settings.role.lister', 'Lister') : t('settings.role.renter', 'Renter');
    const labelFrom = role === 'owner' ? t('settings.role.lister', 'Lister') : role === 'manager' ? t('settings.role.manager', 'Manager') : t('settings.role.renter', 'Renter');
    if (!window.confirm(
      t('settings.switchRoleConfirm', `Switch from ${labelFrom} to ${labelTo}? Your dashboard will update to reflect the new role.`)
        .replace('{from}', labelFrom).replace('{to}', labelTo),
    )) return;
    setSwitchingRole(true);
    try {
      const res = await axios.put(
        `${API}/auth/role`,
        { role: targetRole },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Swap the new JWT + user into the auth context so the rest of the
      // app (Navigation, Dashboard, gating) sees the new role immediately.
      login(res.data.token, res.data.user);
      toast.success(res.data.message || 'Role updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to switch role');
    } finally {
      setSwitchingRole(false);
    }
  };

  // Empty is valid here — it's how an owner opts out.
  const waErr = phoneError(whatsappNumber, t);

  const handleSaveWhatsapp = async (e) => {
    e?.preventDefault?.();
    if (waErr) {
      // Saving an ambiguous number would leave the owner with no WhatsApp
      // button and no indication why.
      toast.error(waErr);
      return;
    }
    setSavingWhatsapp(true);
    try {
      await axios.put(
        `${API}/auth/whatsapp`,
        { whatsapp_number: whatsappNumber },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t('settings.whatsappSaved', 'WhatsApp number saved'));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save WhatsApp number');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleSaveLanguage = async () => {
    setSavingLanguage(true);
    try {
      await axios.put(
        `${API}/auth/language`,
        { language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      i18n.changeLanguage(language);
      toast.success('Default language saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save language');
    } finally {
      setSavingLanguage(false);
    }
  };

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Password changed successfully');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{i18n.t('dashboard.accountSettings')}</h2>

      <NotificationSettings API={API} token={token} />

      {/* Self-service role switch. The exact CTA depends on the user's
          current role — renter sees "Switch to lister", owner sees
          "Switch to renter", manager sees "Step down to renter". Admins
          never get this card (privilege boundary). */}
      {switchOption && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6" data-testid="role-switch-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-[#D4AF37]/15">
              <HomeIcon size={24} className="text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{switchOption.title}</h3>
              <p className="text-sm text-gray-500">{switchOption.hint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSwitchRole(switchOption.target)}
            disabled={switchingRole}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-all disabled:opacity-60"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="switch-role-btn"
          >
            <HomeIcon size={16} /> {switchingRole ? t('dashboard.saving', 'Saving…') : switchOption.cta}
          </button>
          <p className="text-[11px] text-gray-400 mt-2">{switchOption.note}</p>
        </div>
      )}

      {/* Language preference */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-[#1E6A6A]/10">
            <Globe size={24} className="text-[#1E6A6A]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{i18n.t('dashboard.defaultLanguage')}</h3>
            <p className="text-sm text-gray-500">
              {i18n.t('dashboard.defaultLanguageHint')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { value: 'en', label: 'English', sub: 'EN' },
            { value: 'he', label: 'עברית', sub: 'HE' },
          ].map((opt) => {
            const active = language === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLanguage(opt.value)}
                data-testid={`language-option-${opt.value}`}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-[#1E6A6A] bg-[#1E6A6A]/5 text-[#1E6A6A]'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className={`text-xs font-bold ${active ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                  {opt.sub}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSaveLanguage}
          disabled={savingLanguage}
          className="w-full px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-all disabled:opacity-60"
          style={{ backgroundColor: '#1E6A6A' }}
          data-testid="save-language-btn"
        >
          {savingLanguage ? i18n.t('dashboard.saving') : i18n.t('dashboard.saveDefaultLanguage')}
        </button>
      </div>

      {/* WhatsApp number — used for renter-message + contract-signed
          notifications. Same field powers the public profile / email
          signature, so editing here updates both contexts. */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-emerald-50">
            <MessageCircle size={24} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {t('settings.whatsappTitle', 'WhatsApp number')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('settings.whatsappHint', "We'll text you when a renter messages you or signs a contract.")}
            </p>
          </div>
        </div>
        <form onSubmit={handleSaveWhatsapp} className="flex flex-col sm:flex-row gap-3">
          <input
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+972 50 123 4567"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            aria-invalid={waErr ? 'true' : undefined}
            data-testid="settings-whatsapp-input"
            inputMode="tel"
            autoComplete="tel"
          />
          <button
            type="submit"
            disabled={savingWhatsapp}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-all disabled:opacity-60"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="settings-whatsapp-save-btn"
          >
            <Check size={16} /> {savingWhatsapp ? i18n.t('dashboard.saving') : t('common.save', 'Save')}
          </button>
        </form>
        {waErr ? (
          <p className="text-[11px] text-red-600 mt-2" data-testid="settings-whatsapp-error">
            {waErr}
          </p>
        ) : phonePreview(whatsappNumber) ? (
          <p className="text-[11px] text-gray-500 mt-2" data-testid="settings-whatsapp-preview">
            {t('phone.willDial', {
              number: phonePreview(whatsappNumber),
              defaultValue: `Renters will reach you at ${phonePreview(whatsappNumber)}`,
            })}
          </p>
        ) : null}
        <p className="text-[11px] text-gray-400 mt-2">
          {t('settings.whatsappLeaveBlank', 'Leave blank to hide the WhatsApp button on your listings and turn off WhatsApp notifications. International format recommended (+country code).')}
        </p>
      </div>

      {/* Auto chat-reminder toggle — visible only for owner/manager/admin
          since renters aren't the ones being nudged. Backed by
          PUT /api/user/auto-nudge-opt-out. */}
      {isPropertyLister && (
        <div
          className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6"
          data-testid="auto-nudge-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-amber-500/15">
              <Bell size={24} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">
                {t('settings.autoNudgeTitle', 'Auto reply reminders')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('settings.autoNudgeHint', "We'll email you if a renter's message has been sitting in your inbox for 12+ hours without a reply. Replies within a day dramatically increase booking rates.")}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer" data-testid="auto-nudge-toggle-row">
            <button
              type="button"
              role="switch"
              aria-checked={!autoNudgeOptOut}
              onClick={handleToggleAutoNudge}
              disabled={savingAutoNudge}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoNudgeOptOut ? 'bg-gray-300' : 'bg-[#1E6A6A]'
              } disabled:opacity-60`}
              data-testid="auto-nudge-toggle"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoNudgeOptOut ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-800">
              {autoNudgeOptOut
                ? t('settings.autoNudgeOffLabel', 'Off — no auto reminders')
                : t('settings.autoNudgeOnLabel', 'On — remind me after 12h')}
            </span>
          </label>
          <p className="text-[11px] text-gray-400 mt-2">
            {t('settings.autoNudgeThrottle', 'One reminder per conversation every 24 hours. Admins can still send manual reminders.')}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-[#1E6A6A]/10">
            <KeyRound size={24} className="text-[#1E6A6A]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{i18n.t('dashboard.changePassword')}</h3>
            <p className="text-sm text-gray-500">{i18n.t('dashboard.changePasswordHint')}</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{i18n.t('dashboard.currentPassword')}</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                className="w-full px-4 py-2.5 pe-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                required
                placeholder={i18n.t('dashboard.currentPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{i18n.t('dashboard.newPassword')}</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="w-full px-4 py-2.5 pe-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                required
                placeholder={i18n.t('dashboard.newPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{i18n.t('dashboard.confirmNewPassword')}</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                className="w-full px-4 py-2.5 pe-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                required
                placeholder={i18n.t('dashboard.confirmNewPasswordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-all"
            style={{ backgroundColor: '#1E6A6A' }}
          >
            {i18n.t('dashboard.updatePassword')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsTab;
