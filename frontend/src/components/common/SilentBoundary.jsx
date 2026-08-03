import React from 'react';

/**
 * An error boundary that renders nothing when its subtree throws.
 *
 * For non-essential UI mounted at the application root — currently sonner's
 * <Toaster/>. A toast that fails to render should cost you the toast, not the
 * application.
 *
 * Why not the regular `ErrorBoundary`
 * -----------------------------------
 * That one calls `useLocation()` and `useNavigate()` so it can clear itself on
 * navigation and offer a "go home" button. Both throw outside a <Router>, and
 * <Toaster/> is mounted in index.js — OUTSIDE App, which is where
 * <BrowserRouter> lives. Using it there would crash the app on startup, which
 * is a considerably worse bug than the one being fixed.
 *
 * It also renders a full-screen "something went wrong" page. That is right for
 * a route and wrong for a toast: a failed notification should be invisible,
 * not take over the viewport.
 *
 * What this protects against
 * --------------------------
 * The Toaster renders values that came off the wire. `toast.error(x)` with a
 * non-string `x` — e.g. a FastAPI 422 `detail`, which is an array of objects —
 * throws "Objects are not valid as a React child" during render. Mounted at
 * the root with no boundary, that unmounted the ENTIRE app: a blank white
 * page, no message, nothing to click. See utils/apiError.js, which stops the
 * bad value at the source; this is the backstop for the next one.
 */
class SilentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Silent to the user, never silent to the console — otherwise this
    // boundary becomes a place where bugs go to disappear.
    console.error(
      'SilentBoundary caught a render error (subtree suppressed):',
      error,
      info?.componentStack,
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default SilentBoundary;
