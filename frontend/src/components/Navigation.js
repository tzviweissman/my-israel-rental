import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext, API } from '../App';
import { Globe, LogOut, LayoutDashboard, Menu, X, Home, Building, Palmtree, Warehouse, ChevronRight, Search, Bell } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const Navigation = () => {
  const { t, i18n } = useTranslation();
  const { user, logout, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  const [homeShowSearch, setHomeShowSearch] = useState(false);
  const navSearch_ref = useRef('');
  const [navSearch, setNavSearch] = useState('');
  const menuRef = useRef(null);
  
  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);

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
  
  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user || !token) return;
    try {
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };
  
  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };
  
  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };
  
  const clearAllNotifications = () => {
    // Use a toast-based confirm. window.confirm() gets silently blocked inside
    // preview iframes and some browsers, making the button "do nothing".
    toast((tInst) => (
      <div className="flex flex-col gap-2 min-w-[240px]">
        <p className="text-sm font-medium">Clear all notifications?</p>
        <p className="text-xs text-gray-500">This cannot be undone.</p>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(tInst);
              try {
                await axios.delete(`${API}/notifications/clear-all`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setNotifications([]);
                setUnreadCount(0);
                toast.success('All notifications cleared');
              } catch (error) {
                console.error('Failed to clear notifications', error);
                toast.error(error?.response?.data?.detail || 'Failed to clear notifications');
              }
            }}
            className="flex-1 px-3 py-1.5 rounded-md bg-red-500 text-white text-xs hover:bg-red-600"
            data-testid="confirm-clear-notifications-btn"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss(tInst)}
            className="flex-1 px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };
  
  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    
    // Navigate directly to the specific item based on notification type and entity ID
    if (notification.booking_id) {
      // Navigate to dashboard bookings tab and scroll to specific booking
      navigate(`/dashboard?tab=bookings&highlight=${notification.booking_id}`);
    } else if (notification.property_id) {
      // Navigate directly to the property detail page
      navigate(`/property/${notification.property_id}`);
    } else if (notification.sublease_id) {
      // Navigate to dashboard subleases tab and highlight sublease
      navigate(`/dashboard?tab=subleases&highlight=${notification.sublease_id}`);
    } else {
      // Fallback to dashboard
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setShowNotifications(false);
    };
    if (menuOpen || showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, showNotifications]);
  
  // Fetch notifications on mount and periodically
  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, token]);

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

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            {user && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                  data-testid="notification-bell"
                >
                  <Bell size={scrolled ? 20 : 22} color="#D4AF37" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div
                    className="absolute right-0 top-full mt-3 w-[calc(100vw-2rem)] sm:w-96 max-w-md max-h-[70vh] sm:max-h-[500px] overflow-y-auto rounded-2xl"
                    style={{
                      backgroundColor: '#1E6A6A',
                      border: '1.5px solid rgba(212,175,55,0.25)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)'
                    }}
                    data-testid="notification-dropdown"
                  >
                    <div className="sticky top-0 bg-[#1E6A6A] border-b border-[#D4AF37]/20 p-3 sm:p-4 flex items-center justify-between">
                      <h3 className="text-white font-bold text-sm">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors whitespace-nowrap"
                          >
                            Mark all as read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={clearAllNotifications}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors whitespace-nowrap"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-6 sm:p-8 text-center">
                        <Bell size={32} className="mx-auto mb-3 text-white/30" />
                        <p className="text-white/60 text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left p-3 sm:p-4 hover:bg-white/5 transition-colors ${
                              !notification.read ? 'bg-white/10' : ''
                            }`}
                            data-testid={`notification-${notification.id}`}
                          >
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !notification.read ? 'bg-[#D4AF37]' : 'bg-transparent'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs sm:text-sm break-words ${!notification.read ? 'text-white font-medium' : 'text-white/70'}`}>
                                  {notification.message}
                                </p>
                                <p className="text-[10px] sm:text-xs text-white/40 mt-1">
                                  {new Date(notification.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Menu Button */}
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
      </div>
    </nav>
  );
};

export default Navigation;
