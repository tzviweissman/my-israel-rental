import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, EyeOff, Eye, Globe } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const SettingsTab = ({ user, token, API }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(
    user?.preferred_language || (i18n.language?.startsWith('he') ? 'he' : 'en')
  );
  const [savingLanguage, setSavingLanguage] = useState(false);

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
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>Account Settings</h2>

      {/* Language preference */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-[#1E6A6A]/10">
            <Globe size={24} className="text-[#1E6A6A]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Default Language</h3>
            <p className="text-sm text-gray-500">
              The site will open in this language every time you sign in, on any device.
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
          {savingLanguage ? 'Saving…' : 'Save Default Language'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-[#1E6A6A]/10">
            <KeyRound size={24} className="text-[#1E6A6A]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
            <p className="text-sm text-gray-500">Update your password to keep your account secure</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                required
                placeholder="Enter current password"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                required
                placeholder="Enter new password (min 6 characters)"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                required
                placeholder="Confirm new password"
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
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsTab;
