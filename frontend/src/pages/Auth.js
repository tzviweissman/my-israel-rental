import React, { useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

const Auth = () => {
  const { mode } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'renter'
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'signup' && formData.password !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }
    if (mode === 'signup' && !termsAccepted) {
      toast.error(t('auth.mustAcceptTerms'));
      return;
    }
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const response = await axios.post(`${API}${endpoint}`, formData);
      login(response.data.token, response.data.user);
      toast.success(mode === 'login' ? t('auth.welcomeBack') : t('auth.accountCreated'));
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('auth.failed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]">
          <h2 className="text-3xl font-bold mb-8 text-center" style={{ fontFamily: 'Playfair Display' }}>
            {mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="auth-form">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('auth.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50"
                  required
                  data-testid="auth-name-input"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">{t('auth.email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50"
                required
                data-testid="auth-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50"
                  required
                  data-testid="auth-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('auth.confirmPassword')}</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 ${confirmPassword && confirmPassword !== formData.password ? 'border-red-400' : 'border-[#E5E5E5]'}`}
                      required
                      data-testid="auth-confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      data-testid="toggle-confirm-password-visibility"
                    >
                      {showConfirmPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== formData.password && (
                    <p className="text-xs text-red-500 mt-1" data-testid="password-mismatch-error">{t('auth.passwordMismatch')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('auth.phone')}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50"
                    data-testid="auth-phone-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('auth.role')}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50"
                    data-testid="auth-role-select"
                  >
                    <option value="renter">{t('auth.renter')}</option>
                    <option value="owner">{t('auth.owner')}</option>
                  </select>
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 accent-[#D4AF37] cursor-pointer"
                  data-testid="auth-terms-checkbox"
                />
                <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer leading-snug">
                  {t('auth.agreeToTerms')}{' '}
                  <a href="/terms" target="_blank" className="font-medium underline underline-offset-2" style={{ color: '#D4AF37' }} data-testid="auth-terms-link">
                    {t('auth.termsAndConditions')}
                  </a>
                </label>
              </div>
            )}

            <button type="submit" className="w-full primary-btn" data-testid="auth-submit-button">
              {t('auth.submit')}
            </button>
          </form>

          <div className="mt-6 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-gray-600">
                {t('auth.noAccount')}{' '}
                <a href="/auth/signup" className="font-medium" style={{ color: '#4A90D9' }} data-testid="auth-toggle-link">
                  {t('auth.signUpHere')}
                </a>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                {t('auth.haveAccount')}{' '}
                <a href="/auth/login" className="font-medium" style={{ color: '#4A90D9' }} data-testid="auth-toggle-link">
                  {t('auth.loginHere')}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
