import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../App';
import { Globe, User, LogOut, LayoutDashboard } from 'lucide-react';

const Navigation = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'he' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glassmorphism sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display', color: '#D4AF37' }} data-testid="nav-logo">
            MyIsraelRental.com
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/properties/long-term" className="text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-long-term">
              {t('nav.longTerm')}
            </Link>
            <Link to="/properties/short-term" className="text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-short-term">
              {t('nav.shortTerm')}
            </Link>
            <Link to="/properties/vacation" className="text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-vacation">
              {t('nav.vacation')}
            </Link>
            <Link to="/properties/storage" className="text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-storage">
              {t('nav.storage')}
            </Link>

            <button onClick={toggleLanguage} className="flex items-center gap-2 text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="language-toggle">
              <Globe size={18} />
              {i18n.language === 'en' ? 'עב' : 'EN'}
            </button>

            {user ? (
              <>
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-2 text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-dashboard">
                  <LayoutDashboard size={18} />
                  {t('nav.dashboard')}
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-logout">
                  <LogOut size={18} />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="text-base font-medium hover:text-[#D4AF37] transition-colors" data-testid="nav-login">
                  {t('nav.login')}
                </Link>
                <Link to="/auth/signup" className="primary-btn" data-testid="nav-signup">
                  {t('nav.signup')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;