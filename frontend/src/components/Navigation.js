import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext, API } from '../App';
import { Globe, LogOut, LayoutDashboard, Menu, X, Home, Building, Palmtree, Warehouse, ChevronRight, Search, Bell, MessageCircle, HelpCircle, Bed, Briefcase } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { playMessagePing, requestDesktopNotificationPermission, showDesktopNotification } from '../utils/messageAlerts';
import NavCategoryItem from './NavCategoryItem';

const Navigation = () => {
  const { t, i18n } = useTranslation();
  const { user, logout, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  // Mobile-only: collapse the bottom tab strip to text-only once the
  // user scrolls past a tiny threshold, on every page. Mirrors Airbnb's
  // mobile chrome where the icon strip disappears as you scroll into
  // the content, leaving just compact "Stays / Services" labels.
  const [mobileScrolled, setMobileScrolled] = useState(false);
  const navRef = useRef(null);
  // Publish the live nav height as a global CSS variable so pages with
  // a fixed bar (Stays, Home) can sit flush against it via
  // `style={{ top: 'var(--nav-h)' }}`. ResizeObserver keeps the value
  // in sync as the nav shrinks/expands (e.g. mobileScrolled collapsing
  // the bottom strip).
  useEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;
    let rafId = 0;
    const apply = () => {
      const h = el.offsetHeight || 0;
      document.documentElement.style.setProperty('--nav-h', `${h}px`);
    };
    apply();
    // Defer the apply() write to the next animation frame so writing
    // `--nav-h` (which can affect downstream layout) never happens
    // inside the ResizeObserver callback — that's what triggers the
    // benign "ResizeObserver loop completed with undelivered
    // notifications" warning in Chrome / webpack-dev-server overlay.
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    });
    ro.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);
  const menuRef = useRef(null);
  
  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  // Track which message-notification ids we've already alerted on so the
  // ping/desktop-popup only fires once per new arrival (not on every poll).
  const alertedMessageIdsRef = useRef(new Set());
  const initialFetchRef = useRef(true);
  // Unread inbox count (for the dedicated chat icon next to the bell)
  const [unreadConversations, setUnreadConversations] = useState(0);

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('he') ? 'en' : 'he';
    i18n.changeLanguage(newLang);
    // Persist preference to backend so it follows the user across devices.
    if (user && token) {
      axios
        .put(
          `${API}/auth/language`,
          { language: newLang },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .catch(() => {
          /* silent — local language change still applies */
        });
    }
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
  
  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user || !token) return;
    try {
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data || [];

      // Detect newly-arrived unread "new_message" notifications and fire
      // one ping + desktop popup per id. Skip on the very first fetch so we
      // don't blast the user with alerts for a backlog they already saw.
      if (!initialFetchRef.current) {
        const fresh = data.filter(
          (n) =>
            n.type === 'new_message' &&
            !n.read &&
            !alertedMessageIdsRef.current.has(n.id)
        );
        if (fresh.length > 0) {
          playMessagePing();
          fresh.forEach((n) => {
            alertedMessageIdsRef.current.add(n.id);
            showDesktopNotification(
              'New message',
              n.message || 'You have a new message',
              () => handleNotificationClick(n)
            );
          });
        }
      } else {
        data.forEach((n) => {
          if (n.type === 'new_message') alertedMessageIdsRef.current.add(n.id);
        });
        initialFetchRef.current = false;
      }

      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
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

  // Delete a single notification. We optimistically remove it from the panel
  // and roll back if the request fails so the user always gets instant feedback.
  const deleteNotification = async (notif) => {
    const prev = notifications;
    setNotifications((cur) => cur.filter((n) => n.id !== notif.id));
    if (!notif.read) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await axios.delete(`${API}/notifications/${notif.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      setNotifications(prev);
      if (!notif.read) setUnreadCount((c) => c + 1);
      toast.error(error?.response?.data?.detail || 'Failed to delete notification');
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
            {t('nav.clearAll')}
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss(tInst)}
            className="flex-1 px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };
  
  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    
    // Navigate directly to the specific item based on notification type and entity ID.
    // The trailing `_t` cache-buster guarantees the deep-link useEffect fires every
    // time, even when the user is already on the same booking/sublease.
    const t = Date.now();
    if (notification.type === 'new_message' && notification.property_id) {
      // Take the lister directly into the chat with the renter who messaged them.
      const params = new URLSearchParams();
      if (notification.sender_id) params.set('with', notification.sender_id);
      if (notification.sublease_id) params.set('sublease_id', notification.sublease_id);
      params.set('_t', String(t));
      navigate(`/chat/${notification.property_id}?${params.toString()}`);
    } else if (notification.booking_id) {
      navigate(`/dashboard?tab=bookings&highlight=${notification.booking_id}&_t=${t}`);
    } else if (notification.property_id) {
      // Navigate directly to the property detail page
      navigate(`/property/${notification.property_id}`);
    } else if (notification.sublease_id) {
      navigate(`/dashboard?tab=subleases&highlight=${notification.sublease_id}&_t=${t}`);
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

  // Poll unread inbox count for the chat-icon badge in the navbar
  useEffect(() => {
    if (!user || !token) return;
    const fetchUnreadConversations = async () => {
      try {
        const res = await axios.get(`${API}/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnreadConversations((res.data || []).filter((c) => c.unread).length);
      } catch (err) {
        console.error('Failed to fetch conversations', err);
      }
    };
    fetchUnreadConversations();
    const interval = setInterval(fetchUnreadConversations, 20000);
    return () => clearInterval(interval);
  }, [user, token]);

  useEffect(() => {
    if (!isHome) return;
    const handleScroll = () => {
      setHomeScrolled(window.scrollY > 120);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  // Mobile-only scroll watcher — fires on every page so the bottom tab
  // strip collapses to text-only on any scroll, matching the Airbnb
  // mobile chrome. Threshold kept tiny (40px) so the collapse is
  // noticeable as soon as the user starts reading content.
  useEffect(() => {
    const onScroll = () => setMobileScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Non-home pages always compact; home page depends on scroll
  const scrolled = isHome ? homeScrolled : true;

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? '#1E6A6A' : 'transparent',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-6" style={{ padding: scrolled ? '4px 24px' : '0 24px' }}>
        <div className="flex items-center justify-between relative">
          <Link to="/" className="flex items-center shrink-0" data-testid="nav-logo" onClick={() => window.scrollTo(0, 0)}>
            <img
              src="https://customer-assets.emergentagent.com/job_listing-manager-pro-2/artifacts/hx4hc6hw_IMG_1745%20%281%29.PNG"
              alt="MyIsraelRental"
              className={`w-auto transition-all duration-300 ${
                scrolled
                  ? 'h-12 sm:h-[60px] md:h-[60px]'
                  : 'h-20 sm:h-[140px] md:h-[200px]'
              }`}
              style={{ marginTop: scrolled ? '0' : '-8px' }}
            />
          </Link>

          {/* Category pill row — Airbnb-style rental-type tabs.
              Desktop: absolutely centered overlay in the same flex row.
              Mobile: handled separately below the main row. */}
          <div
            className="hidden md:flex items-end justify-center gap-8 pointer-events-none absolute left-1/2 top-1/2"
            style={{ transform: 'translate(-50%, -50%)' }}
            data-testid="nav-rental-categories"
          >
            <div className="flex items-end gap-8 pointer-events-auto">
            {/* Top-level pills — replaces the old 4-rental-type strip with
                the simpler Stays vs Services duality (Airbnb-style). The
                rental-type sub-filter now lives inside the Stays page
                Filters modal. */}
            {[
              { type: 'stays', icon: Bed, label: t('nav.stays', 'Stays'), to: '/stays' },
              { type: 'services', icon: Briefcase, label: t('nav.services', 'Services'), to: '/services' },
            ].map(({ type, icon: Icon, label, to }) => (
              <NavCategoryItem
                key={type}
                type={type}
                Icon={Icon}
                label={label}
                to={to}
                active={location.pathname.startsWith(to)}
                scrolled={scrolled}
              />
            ))}
            </div>
          </div>

          {/* Mobile-on-scroll search bar was removed per user request —
              the global nav stays clean on scroll, and dedicated
              category pages (/stays) own their own search experience. */}

          <div className="flex items-center gap-3">
            {/* Language toggle — desktop always, mobile shown only when
                signed out (signed-in users have bell + chat in this slot
                and can switch language inside the menu drawer). */}
            <button
              onClick={toggleLanguage}
              className={`${user ? 'hidden sm:flex' : 'flex'} p-2 rounded-full hover:bg-white/10 transition-colors items-center gap-1`}
              data-testid="language-toggle"
              aria-label={t('nav.toggleLanguage')}
              title={i18n.language.startsWith('he') ? 'Switch to English' : 'Switch to Hebrew'}
            >
              <Globe size={scrolled ? 20 : 22} color="#D4AF37" />
              <span
                className="text-[10px] font-bold tracking-wide"
                style={{ color: '#D4AF37' }}
              >
                {i18n.language.startsWith('he') ? 'EN' : 'עב'}
              </span>
            </button>

            {/* Inbox / Messages shortcut */}
            {user && (
              <button
                onClick={() => navigate('/dashboard?tab=messages')}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                data-testid="nav-messages-icon"
                aria-label="Messages"
                title="Messages"
              >
                <MessageCircle size={scrolled ? 20 : 22} color="#D4AF37" />
                {unreadConversations > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    data-testid="nav-messages-badge"
                  >
                    {unreadConversations > 9 ? '9+' : unreadConversations}
                  </span>
                )}
              </button>
            )}

            {/* Notification Bell */}
            {user && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    requestDesktopNotificationPermission();
                  }}
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

                {/* Notification Dropdown — fixed on mobile so it always
                    sits with safe insets from BOTH viewport edges (anchoring
                    via the bell's parent could push the panel off-screen
                    when the menu button took up the right-side space). */}
                {showNotifications && (
                  <div
                    className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[64px] sm:top-full sm:mt-3 sm:w-96 max-w-md max-h-[70vh] sm:max-h-[500px] overflow-y-auto rounded-2xl z-50"
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
                        <p className="text-white/60 text-sm">{t('nav.noNotifications')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`group relative w-full text-left p-3 sm:p-4 hover:bg-white/5 transition-colors ${
                              !notification.read ? 'bg-white/10' : ''
                            }`}
                            data-testid={`notification-${notification.id}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleNotificationClick(notification)}
                              className="w-full text-left"
                              data-testid={`notification-open-${notification.id}`}
                            >
                              <div className="flex items-start gap-2 sm:gap-3 pr-7">
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 text-white/70 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              data-testid={`notification-delete-${notification.id}`}
                              aria-label={t('nav.deleteNotification')}
                              title={t('nav.deleteNotification')}
                            >
                              <X size={12} />
                            </button>
                          </div>
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
              <span className="hidden sm:inline font-semibold tracking-wide" style={{ color: '#D4AF37', fontSize: scrolled ? '12px' : '14px' }}>{t('nav.menu')}</span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-3 w-72 rounded-2xl overflow-hidden z-[60]"
                style={{
                  backgroundColor: '#1E6A6A',
                  border: '1.5px solid rgba(212,175,55,0.25)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.08)'
                }}
                data-testid="nav-menu-dropdown"
              >
                {/* Language sync pill — visible only for logged-in users.
                    Reassures them their language preference is saved to
                    their account and follows them across devices. Click
                    to toggle to the other language. The actual /auth/language
                    PUT happens inside toggleLanguage() so the badge is also
                    the action. */}
                {user && (
                  <button
                    onClick={() => { toggleLanguage(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 border-b transition-colors hover:bg-white/5"
                    style={{ borderColor: 'rgba(212,175,55,0.15)' }}
                    data-testid="nav-language-sync-pill"
                    title={t('nav.toggleLanguage')}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(212,175,55,0.18)' }}
                    >
                      <Globe size={14} style={{ color: '#D4AF37' }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold" style={{ color: '#D4AF37' }}>
                        {i18n.language.startsWith('he') ? t('nav.hebrew') : t('nav.english')}
                        <span className="ml-1.5 opacity-50 font-normal">
                          · {t('nav.switchTo')}{i18n.language.startsWith('he') ? ' English' : ' עברית'}
                        </span>
                      </p>
                      <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'rgba(212,175,55,0.55)' }}>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: '#10B981' }}
                          aria-hidden
                        />
                        {t('nav.languageSynced')}
                      </p>
                    </div>
                  </button>
                )}

                {/* Stays + Services + Holiday quick-links (mobile drawer).
                    Storage rentals have been retired so the entry is gone. */}
                <div className="px-2 pt-3 pb-1">
                  <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: 'rgba(212,175,55,0.45)' }}>
                    {t('nav.browse', 'Browse')}
                  </p>
                  <button onClick={() => handleNav('/stays')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-stays">
                    <Bed size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.stays', 'Stays')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  <button onClick={() => handleNav('/services')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-services">
                    <Briefcase size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.services', 'Services')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="mx-4 border-t" style={{ borderColor: 'rgba(212,175,55,0.15)' }} />

                {/* Help / FAQ */}
                <div className="px-2 py-2">
                  <button onClick={() => handleNav('/faq')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: '#D4AF37' }} data-testid="nav-faq">
                    <HelpCircle size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.faq')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="mx-4 border-t" style={{ borderColor: 'rgba(212,175,55,0.15)' }} />

                {/* Language switch — mobile only (desktop has the icon in the top nav) */}
                <div className="sm:hidden px-2 py-2">
                  <button
                    onClick={() => { toggleLanguage(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group"
                    style={{ color: '#D4AF37' }}
                    data-testid="nav-language-toggle-mobile"
                  >
                    <Globe size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{i18n.language.startsWith('he') ? 'Switch to English' : 'עברית'}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="sm:hidden mx-4 border-t" style={{ borderColor: 'rgba(212,175,55,0.15)' }} />

                {/* Settings */}
                <div className="px-2 py-2">
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

        {/* Mobile-only category row — sits below the logo+menu row.
            Compact icons with full text labels (no wrap), evenly spaced.
            When the user scrolls past the threshold, the icons hide and
            only the text labels remain — matches Airbnb's compact mobile
            chrome from the screenshots. */}
        <div
          className={`md:hidden flex items-end justify-around transition-all duration-200 ${
            mobileScrolled ? 'pb-1 pt-0' : 'pb-2 pt-1'
          }`}
          data-testid="nav-rental-categories-mobile"
        >
          {/* Mobile mirror of the desktop pill row — same Stays/Services
              duality, kept here so the bottom strip on small screens
              matches the top one on lg+. */}
          {[
            { type: 'stays', icon: Bed, label: t('nav.stays', 'Stays'), to: '/stays' },
            { type: 'services', icon: Briefcase, label: t('nav.services', 'Services'), to: '/services' },
          ].map(({ type, icon: Icon, label, to }) => (
            <NavCategoryItem
              key={type}
              type={type}
              Icon={Icon}
              label={label}
              to={to}
              active={location.pathname.startsWith(to)}
              scrolled
              iconHidden={mobileScrolled}
              testidSuffix="-mobile"
            />
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
