import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext, API } from '../App';
import { Globe, LogOut, LayoutDashboard, Menu, X, Home, Building, Palmtree, Warehouse, ChevronRight, Search, Bell, MessageCircle, HelpCircle, Bed, Briefcase, Store } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { playMessagePing, requestDesktopNotificationPermission, showDesktopNotification } from '../utils/messageAlerts';
import NavCategoryItem from './NavCategoryItem';
import logoMark from '../assets/brand/logo-mark.png';

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
    // Highest-priority branch: notifications that carry an explicit
    // ``action_url`` (e.g. pricing-quarantine emails deep-link straight
    // into the price-edit form). Trust the backend's route so we don't
    // have to maintain a switch on every new notification type.
    if (notification.action_url) {
      navigate(notification.action_url);
      return;
    }
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
      data-testid="global-nav"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 glass-nav"
      style={{
        // The bar NEVER takes a fill. `.glass-nav` supplies the preview's
        // gradient scrim and the glass bubbles are the chrome — that is the
        // whole design. Solidifying on scroll (which this used to do) also
        // gave captions and notification cards a hard edge to clip against
        // at scene exits, which read as a rendering fault.
        boxShadow: 'none',
      }}
    >
      {/* Vertical padding per the preview's .bar: 14px clamp(16px,3vw,36px).
          It was 0 unscrolled, which put the first glass bubble 6px from the
          top edge — the bubbles read as clipped rather than floating. */}
      <div
        className="max-w-7xl mx-auto"
        style={{ padding: scrolled ? '8px clamp(16px,3vw,36px)' : '14px clamp(16px,3vw,36px)' }}
      >
        <div className="flex items-center justify-between relative">
          {/* Logo lockup, copied from `.lg` in the preview files rather than
              re-derived: the raw gold mark floating in the glass nav with a
              drop-shadow, NO navy tile behind it, wordmark in Playfair.

              Values are the preview's verbatim — 11px gap, 44px mark, 19px
              Playfair 700, and the two shadows that are what keep white text
              and a gold mark legible over arbitrary hero photography. The
              44px shrinks on scroll because this nav collapses; the preview
              is a fixed overlay and never does.

              Replaces a single PNG that rendered up to 200px tall and shoved
              the nav around as it shrank. */}
          <Link
            to="/"
            className="flex items-center shrink-0 gap-[11px]"
            data-testid="nav-logo"
            onClick={() => window.scrollTo(0, 0)}
          >
            <img
              src={logoMark}
              alt=""
              aria-hidden="true"
              className={`w-auto block transition-all duration-300 ${scrolled ? 'h-8' : 'h-11'}`}
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.55))' }}
            />
            <span
              className={`font-bold tracking-tight text-white transition-all duration-300 ${
                scrolled ? 'text-base' : 'text-[19px]'
              } hidden sm:inline`}
              style={{
                fontFamily: 'var(--font-head)',
                textShadow: '0 1px 8px rgba(0,0,0,.5)',
              }}
            >
              MyIsraelRental
            </span>
            {/* The wordmark is hidden on small screens, so the link still
                needs an accessible name there. */}
            <span className="sr-only sm:hidden">MyIsraelRental</span>
          </Link>

          {/* Desktop links — text-only glass pills per the previews. The
              bed/briefcase icon pills they replace are gone by ruling; the
              mobile drawer keeps icons, since tap targets benefit and the
              previews don't cover mobile.

              Four links, settled: "How it works" is deliberately absent —
              the cinematic home page IS the how-it-works, so a nav item
              pointing at a subsection of it would be circular.

              /requests is backed by a placeholder until Phase 3 replaces it
              in place, so this row never has to be rebuilt. */}
          <nav
            /* 900px, not Tailwind's `md` (768px), because that is the
               breakpoint the previews use: `@media(max-width:900px){.links,
               .signin{display:none}}`. At 768 the four link pills, the
               language pill, Sign in and the CTA do not fit on one line —
               they overlapped each other and clipped the wordmark. The
               drawer already carries these links below this width. */
            className="hidden min-[900px]:flex items-center gap-[9px] pointer-events-none absolute left-1/2 top-1/2"
            style={{ transform: 'translate(-50%, -50%)' }}
            data-testid="nav-rental-categories"
            aria-label={t('nav.primary', 'Primary')}
          >
            <div className="flex items-center gap-[9px] pointer-events-auto">
              {[
                { key: 'stays', label: t('nav.stays', 'Stays'), to: '/stays' },
                { key: 'services', label: t('nav.services', 'Services'), to: '/businesses' },
                { key: 'requests', label: t('nav.requests', 'Marketplace'), to: '/requests' },
                // No supply link here any more. "List / Offer" spoke to one
                // of three audiences and duplicated the CTA beside it; the
                // solid "Join free" button now carries every audience and
                // the role picker does the routing. /why-list still exists —
                // it's the Host card's "full pitch" link on the join page.
              ].map(({ key, label, to }) => {
                const active = location.pathname.startsWith(to);
                return (
                  <Link
                    key={key}
                    to={to}
                    className={`glass-pill ${active ? 'glass-pill-current' : ''}`}
                    // The gold dot is decorative; aria-current is what
                    // actually tells a screen reader which page this is.
                    aria-current={active ? 'page' : undefined}
                    data-testid={`nav-link-${key}`}
                  >
                    {label}
                    {active && <span className="glass-dot" aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Mobile-on-scroll search bar was removed per user request —
              the global nav stays clean on scroll, and dedicated
              category pages (/stays) own their own search experience. */}

          <div className="flex items-center gap-3">
            {/* Language toggle — desktop always, mobile shown only when
                signed out (signed-in users have bell + chat in this slot
                and can switch language inside the menu drawer). */}
            {/* `.lang` from the previews: a small glass pill reading
                "עברית / EN", not an icon. Both scripts are shown at once and
                the label never changes, which is the point — an Anglo reader
                who has accidentally switched to Hebrew can still find the way
                back, where a label that only says the OTHER language means
                the way out is written in the script they can't read. */}
            <button
              onClick={toggleLanguage}
              className={`${user ? 'hidden sm:inline-flex' : 'inline-flex'} glass-pill glass-pill-sm items-center`}
              data-testid="language-toggle"
              aria-label={t('nav.toggleLanguage')}
              title={i18n.language.startsWith('he') ? 'Switch to English' : 'Switch to Hebrew'}
            >
              עברית / EN
            </button>

            {/* Signed-out desktop: exactly the preview — lang, Sign in, and
                one solid CTA. Order matters and it is deliberate.

                There is no separate Sign Up. Auth is Google Identity, so
                signing in and signing up are the same flow; two buttons was
                inventory the preview correctly didn't have, and it split the
                one solid slot between two competing asks.

                That slot is now "Join free", which serves all three
                audiences at once — traveler, host, service provider — and
                hands the routing to the role picker on /join. The previous
                "List your property" spoke only to hosts, which meant the
                nav's loudest element was invisible to two thirds of the
                people it was trying to recruit. */}
            {!user && (
              /* Same 900px threshold as the link row above. The preview
                 hides only `.signin` here and keeps the CTA, but the
                 preview has no hamburger — this app does, and its drawer
                 already carries both Sign in and "List your property".
                 Keeping the CTA in the bar at 768 would put it beside a
                 hamburger holding the same button. */
              <div className="hidden min-[900px]:flex items-center gap-[9px]" data-testid="nav-auth-cluster">
                <button
                  onClick={() => navigate('/auth/login')}
                  className="glass-pill"
                  data-testid="nav-login-top"
                >
                  {t('nav.signin', 'Sign in')}
                </button>
                <button
                  onClick={() => navigate('/join')}
                  className="glass-pill-solid"
                  data-testid="nav-join-free"
                >
                  {t('nav.joinFree', 'Join free')}
                </button>
              </div>
            )}

            {/* Inbox / Messages shortcut */}
            {user && (
              <button
                onClick={() => navigate('/dashboard?tab=messages')}
                className="glass-pill relative inline-flex items-center justify-center !px-3"
                data-testid="nav-messages-icon"
                aria-label="Messages"
                title="Messages"
              >
                <MessageCircle size={scrolled ? 20 : 22} color="var(--gold)" />
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
                  className="glass-pill relative inline-flex items-center justify-center !px-3"
                  data-testid="notification-bell"
                >
                  <Bell size={scrolled ? 20 : 22} color="var(--gold)" />
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
                      backgroundColor: 'var(--brand-primary)',
                      border: '1.5px solid rgba(201, 162, 39,0.25)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)'
                    }}
                    data-testid="notification-dropdown"
                  >
                    <div className="sticky top-0 bg-[var(--brand-primary)] border-b border-[rgb(var(--gold-rgb)/<alpha-value>)]/20 p-3 sm:p-4 flex items-center justify-between">
                      <h3 className="text-white font-bold text-sm">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-[var(--gold)] hover:text-[rgb(var(--gold-rgb)/<alpha-value>)]/80 transition-colors whitespace-nowrap"
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
                                  !notification.read ? 'bg-[var(--gold)]' : 'bg-transparent'
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
              {/* One control, two presentations, because it opens the same
                  drawer either way.

                  Signed OUT on desktop it is hidden entirely: the preview is
                  the logged-out nav and has no Menu, and everything the
                  drawer holds — dashboard, messages, notifications, logout —
                  only exists once you are signed in. A hamburger that opens a
                  menu of things you cannot do is worse than no hamburger.

                  Signed IN on desktop it becomes the account pill: same glass
                  bubble, avatar/name instead of a burger icon.

                  Mobile keeps the drawer in both states — it is the only
                  place the nav links live at that width. */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                /* `min-[900px]:hidden`, matching the link row and auth
                   cluster. It was `md:hidden` (768px) — but once those two
                   moved to 900px, a logged-out visitor between 768 and
                   899px had no links, no Sign in, no CTA and no burger:
                   a nav containing only a logo and a language toggle. */
                className={`glass-pill inline-flex items-center gap-2 ${
                  user ? '' : 'min-[900px]:hidden'
                }`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                data-testid="nav-menu-button"
              >
                {user ? (
                  <>
                    {/* Initial as a cheap avatar — no image to load, and it
                        still reads as "this is you" rather than "settings". */}
                    <span
                      className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold"
                      style={{ background: 'rgba(255,255,255,.9)', color: 'var(--brand-primary-deep)' }}
                      aria-hidden="true"
                    >
                      {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden md:inline max-w-[9rem] truncate">
                      {(user.name || user.email || '').split(' ')[0]}
                    </span>
                    <span className="sr-only">{t('nav.account', 'Account menu')}</span>
                  </>
                ) : (
                  <>
                    {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
                    <span className="sr-only">{t('nav.menu')}</span>
                  </>
                )}
              </button>

            {menuOpen && (
              <div
                // `end-0` not `right-0`: in RTL the menu button sits on the
                // left, so a physical right-anchor pushed the panel away from
                // its trigger. `max-h` + overflow-y-auto because the panel
                // grows with the signed-in item list and was being clipped by
                // `overflow-hidden` on short viewports — the last entries
                // (Logout / Sign up) were simply unreachable. x stays hidden
                // so the rounded corners still clip.
                className="absolute end-0 top-full mt-3 w-72 rounded-2xl overflow-y-auto overflow-x-hidden max-h-[calc(100vh-96px)] sm:max-h-[80vh] z-[60] overscroll-contain"
                style={{
                  // Glass, but a DEEP glass. The nav pills sit at .12 alpha
                  // because they hold two words over a photo; this panel holds
                  // a dozen menu rows over whatever page is beneath it, and at
                  // that alpha the text underneath shows through and the list
                  // becomes unreadable. .92 over the deep brand blue keeps the
                  // frosted feel while the content stays legible — the blur is
                  // doing the aesthetic work, not the transparency.
                  backgroundColor: 'rgba(18, 59, 87, .92)',
                  backdropFilter: 'blur(14px) saturate(1.1)',
                  WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
                  border: '1.5px solid rgba(255, 255, 255, .28)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,.18), 0 16px 48px rgba(0,0,0,.5)',
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
                    style={{ borderColor: 'rgba(201, 162, 39,0.15)' }}
                    data-testid="nav-language-sync-pill"
                    title={t('nav.toggleLanguage')}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(201, 162, 39,0.18)' }}
                    >
                      <Globe size={14} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                        {i18n.language.startsWith('he') ? t('nav.hebrew') : t('nav.english')}
                        <span className="ml-1.5 opacity-50 font-normal">
                          · {t('nav.switchTo')}{i18n.language.startsWith('he') ? ' English' : ' עברית'}
                        </span>
                      </p>
                      <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'rgba(201, 162, 39,0.55)' }}>
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
                  <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: 'rgba(201, 162, 39,0.45)' }}>
                    {t('nav.browse', 'Browse')}
                  </p>
                  <button onClick={() => handleNav('/stays')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: 'var(--gold)' }} data-testid="nav-stays">
                    <Bed size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.stays', 'Stays')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  <button onClick={() => handleNav('/businesses')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: 'var(--gold)' }} data-testid="nav-services">
                    <Briefcase size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.services', 'Services')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  <button onClick={() => handleNav('/requests')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: 'var(--gold)' }} data-testid="nav-requests">
                    <Store size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.requests', 'Marketplace')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="mx-4 border-t" style={{ borderColor: 'rgba(201, 162, 39,0.15)' }} />

                {/* Help / FAQ */}
                <div className="px-2 py-2">
                  <button onClick={() => handleNav('/faq')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: 'var(--gold)' }} data-testid="nav-faq">
                    <HelpCircle size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{t('nav.faq')}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="mx-4 border-t" style={{ borderColor: 'rgba(201, 162, 39,0.15)' }} />

                {/* Language switch — mobile only (desktop has the icon in the top nav) */}
                <div className="sm:hidden px-2 py-2">
                  <button
                    onClick={() => { toggleLanguage(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group"
                    style={{ color: 'var(--gold)' }}
                    data-testid="nav-language-toggle-mobile"
                  >
                    <Globe size={16} className="opacity-60 group-hover:opacity-100" />
                    <span>{i18n.language.startsWith('he') ? 'Switch to English' : 'עברית'}</span>
                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                </div>

                <div className="sm:hidden mx-4 border-t" style={{ borderColor: 'rgba(201, 162, 39,0.15)' }} />

                {/* Settings */}
                <div className="px-2 py-2">
                  {user ? (
                    <>
                      <button onClick={() => handleNav(user.role === 'admin' ? '/admin' : '/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: 'var(--gold)' }} data-testid="nav-dashboard">
                        <LayoutDashboard size={16} className="opacity-60 group-hover:opacity-100" />
                        <span>{t('nav.dashboard')}</span>
                        <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-white/5 group" style={{ color: 'var(--gold)' }} data-testid="nav-logout">
                        <LogOut size={16} className="opacity-60 group-hover:opacity-100" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Two actions, matching the desktop bar's Sign in +
                          Join free, in the same order.

                          This drawer previously held ONE button, on the
                          reasoning that a "Sign Up" beside "Sign in" was
                          false inventory — Google Identity makes them the
                          same flow, so it implied a choice that didn't
                          exist. That reasoning doesn't cover "Join free":
                          it goes to the role picker, which is a genuinely
                          different destination, and below 900px this drawer
                          is the ONLY navigation — omitting it would hide the
                          site's primary CTA from every tablet and phone.

                          Still no solid gold: both are glass pills, per the
                          standing rule for the nav and drawer. */}
                      <button
                        onClick={() => handleNav('/auth/login')}
                        className="glass-pill w-full justify-center mt-1"
                        data-testid="nav-login"
                      >
                        {t('nav.signin', 'Sign in')}
                      </button>
                      <button
                        onClick={() => handleNav('/join')}
                        className="glass-pill w-full justify-center mt-2"
                        data-testid="nav-join-free-drawer"
                      >
                        {t('nav.joinFree', 'Join free')}
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
          {/* Mobile mirror of the desktop pill row. It carried only
              Stays/Services long after Marketplace became the third
              top-level destination, so on a phone /requests was reachable
              only by typing the URL - and phones are most of the traffic.
              Any link added to the desktop row above belongs here too. */}
          {[
            { type: 'stays', icon: Bed, label: t('nav.stays', 'Stays'), to: '/stays' },
            { type: 'services', icon: Briefcase, label: t('nav.services', 'Services'), to: '/businesses' },
            { type: 'requests', icon: Store, label: t('nav.requests', 'Marketplace'), to: '/requests' },
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
