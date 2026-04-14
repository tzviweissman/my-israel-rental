import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../App';
import { Globe, LogOut, LayoutDashboard, Menu, X, Home, Building, Palmtree, Warehouse, ChevronRight, Search } from 'lucide-react';

const Navigation = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  const [homeShowSearch, setHomeShowSearch] = useState(false);
  const navSearch_ref = useRef('');
  const [navSearch, setNavSearch] = useState('');
  const menuRef = useRef(null);

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('he') ? 'en' : 'he';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const handleNav = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  const handleNavSearch = () => {
    if (navSearch.trim()) {
      navigate(`/properties/all?search=${navSearch}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!isHome) return;
    const handleScroll = () => {
      setHomeScrolled(window.scrollY > 120);
      setHomeShowSearch(window.scrollY > 450);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  // Non-home pages always compact; home page depends on scroll
  const scrolled = isHome ? homeScrolled : true;
  const showSearch = isHome ? homeShowSearch : false;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? '#1E6A6A' : 'transparent',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-6" style={{ padding: scrolled ? '4px 24px' : '0 24px' }}>
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center" data-testid="nav-logo" onClick={() => window.scrollTo(0, 0)}>
            <img
              src="https://customer-assets.emergentagent.com/job_listing-manager-pro-2/artifacts/hx4hc6hw_IMG_1745%20%281%29.PNG"
              alt="MyIsraelRental"
              className="w-auto transition-all duration-300"
              style={{ height: scrolled ? '70px' : '200px', marginTop: scrolled ? '0' : '-16px' }}
            />
          </Link>

          {scrolled && (
            <div
              className="flex-1 max-w-md mx-6 transition-all duration-500 overflow-hidden"
              style={{
                opacity: showSearch ? 1 : 0,
                maxWidth: showSearch ? '28rem' : '0',
                transform: showSearch ? 'scaleX(1)' : 'scaleX(0)',
                transformOrigin: 'center'
              }}
            >
              <div className="flex items-center bg-white/15 rounded-full border border-[#D4AF37]/30 overflow-hidden">
                <input
                  type="text"
                  placeholder={t('hero.searchPlaceholder')}
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleNavSearch()}
                  className="flex-1 px-4 py-2 bg-transparent text-white placeholder-white/60 text-sm focus:outline-none"
                  data-testid="nav-search-input"
                />
                <button
                  onClick={handleNavSearch}
                  className="px-3 py-2 text-white/80 hover:text-white transition-colors"
                  data-testid="nav-search-button"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: 'transparent',
                border: '1.5px solid #D4AF37',
                padding: scrolled ? '6px 14px' : '10px 18px'
              }}
              data-testid="nav-menu-button"
            >
              {menuOpen ? <X size={scrolled ? 16 : 18} color="#D4AF37" /> : <Menu size={scrolled ? 16 : 18} color="#D4AF37" />}
              <span className="font-semibold tracking-wide" style={{ color: '#D4AF37', fontSize: scrolled ? '12px' : '14px' }}>Menu</span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-3 w-72 rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: '#1E6A6A',
                  border: '1.5px solid rgba(212,175,55,0.25)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.08)'
                }}
                data-testid="nav-menu-dropdown"
              >
                {/* Rental Types */}
                <div className="px-2 pt-3 pb-1">
                  <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: 'rgba(212,175,55,0.45)' }}>
                    {t('nav.properties') || 'Properties'}
                  </p>
                  <button onClick={() => handleNav('/properties/long-term')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-long-term">
                    <Home size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.longTerm')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  <button onClick={() => handleNav('/properties/short-term')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-short-term">
                    <Building size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.shortTerm')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  <button onClick={() => handleNav('/properties/vacation')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-vacation">
                    <Palmtree size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.vacation')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  <button onClick={() => handleNav('/properties/storage')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-storage">
                    <Warehouse size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.storage')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="mx-4 border-t" style={{ borderColor: 'rgba(212,175,55,0.15)' }} />

                {/* Settings */}
                <div className="px-2 py-2">
                  <button onClick={toggleLanguage} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="language-toggle">
                    <Globe size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{i18n.language.startsWith('he') ? 'English' : 'עברית'}</span>
                  </button>

                  {user ? (
                    <>
                      <button onClick={() => handleNav(user.role === 'admin' ? '/admin' : '/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-dashboard">
                        <LayoutDashboard size={16} className="opacity-60 group-hover:opacity-100" />
                        <span>{t('nav.dashboard')}</span>
                        <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-logout">
                        <LogOut size={16} className="opacity-60 group-hover:opacity-100" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleNav('/auth/login')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-login">
                        <span className="w-4 h-4 flex items-center justify-center opacity-60 group-hover:opacity-100 text-xs">&#x2192;</span>
                        <span>{t('nav.login')}</span>
                      </button>
                      <button onClick={() => handleNav('/auth/signup')} className="w-full mt-1 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 hover:shadow-lg" style={{ backgroundColor: '#D4AF37', color: '#1E6A6A' }} data-testid="nav-signup">
                        {t('nav.signup')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
