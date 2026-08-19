import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Catches render errors so a crash shows a message instead of a white page.
 *
 * Why this exists
 * ---------------
 * React unmounts the whole tree when a render throws. With no boundary
 * anywhere in this app, every such error produced an identical symptom: a
 * completely blank page, no message, no console breadcrumb the user could
 * report, and no way back except typing a URL.
 *
 * That symptom showed up four separate times in one day, from four unrelated
 * causes — a missing translator in one component, a tab whose panel was
 * gated on a role that couldn't match, a default tab that didn't exist for
 * providers, and one on logout. Each was found only because someone hit it
 * and said "it's blank". A boundary turns all of them into something a
 * person can read and recover from, and prints the real error to the console
 * so the next one takes minutes rather than a round trip.
 *
 * Deliberately placed INSIDE the router and around the routes only, so the
 * navigation bar survives a page-level crash and the user can click their
 * way out rather than being stranded.
 */

/**
 * "Loading chunk 6419 failed" — the signature of a browser holding an OLD
 * page after a new deploy.
 *
 * The page was built against a previous release and asks for code files
 * whose names changed; the server no longer has them, the request 404s,
 * and the app dies on a route the visitor did nothing wrong to reach. It
 * hits real users the moment a deploy lands under an open tab, which is
 * exactly when they are least able to explain what happened.
 */
function isChunkLoadError(error) {
  if (!error) return false;
  const msg = String(error.message || error);
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk \S+ failed/i.test(msg) ||
    /Loading CSS chunk \S+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg)
  );
}

// One reload, ever, per session. A reload that does not fix it (a genuinely
// missing file, a broken deploy) must not become a refresh loop the user
// cannot escape — after one attempt they get the error screen and its
// Reload button, which is at least honest and under their control.
const RELOAD_FLAG = '__stale_build_reloaded';

function recoverFromStaleBuild() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    return false;   // private mode: prefer the error screen to a possible loop
  }
  // `true` forces a fresh document rather than a cached one, so the reload
  // fetches the CURRENT index.html and the chunk names it references.
  window.location.reload(true);
  return true;
}

class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    // A chunk that 404s during a lazy import rejects OUTSIDE React's
    // render, so the boundary never sees it — it surfaces as an unhandled
    // rejection. Catch it here and treat it exactly like a caught chunk
    // error, otherwise the same deploy leaves half the failures silent.
    this._onRejection = (e) => {
      if (isChunkLoadError(e?.reason) && recoverFromStaleBuild()) e.preventDefault();
    };
    window.addEventListener('unhandledrejection', this._onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this._onRejection);
  }

  componentDidCatch(error, info) {
    // The console is the only diagnostic anyone has here — make sure the
    // stack and the component trace both land in it.
    console.error('Render error caught by ErrorBoundary:', error, info?.componentStack);
    // A stale build is not a crash — it is a page asking for files that a
    // deploy has replaced. Recover silently rather than showing someone an
    // error screen for our release, not their action.
    if (isChunkLoadError(error)) recoverFromStaleBuild();
  }

  componentDidUpdate(prevProps) {
    // Navigating away should clear the error, otherwise the boundary keeps
    // showing the failure after the user has moved to a working page.
    if (this.state.error && prevProps.routeKey !== this.props.routeKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { t, onHome } = this.props;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 py-16"
        data-testid="error-boundary"
      >
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('errors.title', 'Something went wrong on this page')}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {t(
              'errors.body',
              "This one's on us, not you. Nothing you did was lost — try reloading, or head back and come at it again.",
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              data-testid="error-boundary-reload"
            >
              {t('errors.reload', 'Reload the page')}
            </button>
            <button
              type="button"
              onClick={onHome}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50"
              data-testid="error-boundary-home"
            >
              {t('errors.goHome', 'Go to home')}
            </button>
          </div>
          {/* The message itself, not a stack — enough for someone to quote in
              a bug report without a wall of minified frames. */}
          <p className="text-[11px] text-gray-400 mt-6 break-words">
            {String(error?.message || error)}
          </p>
        </div>
      </div>
    );
  }
}

/** Hook wrapper — error boundaries must be class components. */
const ErrorBoundary = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ErrorBoundaryInner
      t={t}
      routeKey={location.pathname}
      onHome={() => navigate('/')}
    >
      {children}
    </ErrorBoundaryInner>
  );
};

export default ErrorBoundary;
