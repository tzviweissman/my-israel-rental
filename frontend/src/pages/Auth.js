import React, { useState, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, CheckCircle } from 'lucide-react';
import WelcomePopups from '../components/WelcomePopups';

const Auth = () => {
  const { mode } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password state
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetToken] = useState(searchParams.get('token') || '');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showWelcomePopups, setShowWelcomePopups] = useState(false);

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
      if (mode === 'signup' && formData.role === 'renter') {
        setShowWelcomePopups(true);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t('auth.failed'));
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setForgotSending(true);
    try {
      const res = await axios.post(`${API}/auth/forgot-password`, { email: forgotEmail });
      // Always redirect to reset page with the token
      navigate(`/auth/reset-password?token=${res.data.reset_token}`);
      if (res.data.email_sent) {
        toast.success('Password reset email sent! Also redirecting you now...');
      } else {
        toast.success('Redirecting to password reset...');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setForgotSending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setResetting(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        token: resetToken,
        new_password: resetPassword
      });
      setResetDone(true);
      toast.success('Password has been reset successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password. The link may have expired.');
    } finally {
      setResetting(false);
    }
  };

  // --- Forgot Password View ---
  if (mode === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]">
            {forgotSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display' }}>Check Your Email</h2>
                <p className="text-gray-600 text-sm mb-6">
                  We've sent a password reset link to <strong>{forgotEmail}</strong>. Check your inbox (and spam folder) and click the link to reset your password.
                </p>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full primary-btn"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#1E6A6A] mb-6 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Login
                </button>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-[#1E6A6A]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={24} className="text-[#1E6A6A]" />
                  </div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Forgot Password?</h2>
                  <p className="text-sm text-gray-500 mt-2">Enter your email and we'll help you reset your password.</p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-5" data-testid="forgot-password-form">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        required
                        data-testid="forgot-email-input"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotSending}
                    className="w-full primary-btn disabled:opacity-50"
                    data-testid="forgot-submit-btn"
                  >
                    {forgotSending ? 'Sending...' : 'Reset Password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Reset Password View ---
  if (mode === 'reset-password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5]">
            {resetDone ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display' }}>Password Reset!</h2>
                <p className="text-gray-600 text-sm mb-6">Your password has been successfully reset. You can now log in with your new password.</p>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full primary-btn"
                  data-testid="back-to-login-btn"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={24} className="text-[#D4AF37]" />
                  </div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Set New Password</h2>
                  <p className="text-sm text-gray-500 mt-2">Enter your new password below.</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-5" data-testid="reset-password-form">
                  <div>
                    <label className="block text-sm font-medium mb-2">New Password</label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-4 py-3 pr-12 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        required
                        minLength={6}
                        data-testid="reset-new-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      >
                        {showResetPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 ${resetConfirmPassword && resetConfirmPassword !== resetPassword ? 'border-red-400' : 'border-[#E5E5E5]'}`}
                      required
                      data-testid="reset-confirm-password-input"
                    />
                    {resetConfirmPassword && resetConfirmPassword !== resetPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={resetting}
                    className="w-full primary-btn disabled:opacity-50"
                    data-testid="reset-submit-btn"
                  >
                    {resetting ? 'Resetting...' : 'Set New Password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Login / Signup View ---
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-20 pb-12">
      {showWelcomePopups && <WelcomePopups onDismiss={() => { setShowWelcomePopups(false); navigate('/dashboard'); }} />}
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
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <a
                    href="/auth/forgot-password"
                    className="text-sm font-medium hover:underline transition-colors"
                    style={{ color: '#D4AF37' }}
                    data-testid="forgot-password-link"
                  >
                    Forgot your password?
                  </a>
                </div>
              )}
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
                      className={`w-full px-4 py-3 pr-12 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 ${confirmPassword && confirmPassword !== formData.password ? 'border-red-400' : 'border-[#E5E5E5]'}`}
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
                    className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    data-testid="auth-phone-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('auth.role')}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
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
                <a href="/auth/signup" className="font-medium" style={{ color: '#1E6A6A' }} data-testid="auth-toggle-link">
                  {t('auth.signUpHere')}
                </a>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                {t('auth.haveAccount')}{' '}
                <a href="/auth/login" className="font-medium" style={{ color: '#1E6A6A' }} data-testid="auth-toggle-link">
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
