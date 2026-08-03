import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "@/index.css";
import App from "@/App";
import { Toaster } from "sonner";
import SilentBoundary from "@/components/common/SilentBoundary";
import { i18nReady } from "@/i18n";

// Silence the benign "ResizeObserver loop completed with undelivered
// notifications" browser warning so it doesn't surface in the
// webpack-dev-server overlay or Sentry. We already defer our own
// observer callbacks to rAF, but third-party scripts / browser
// extensions (e.g. ad blockers, password managers) can still emit it.
const RO_WARNING = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;
window.addEventListener('error', (e) => {
  if (e?.message && RO_WARNING.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e?.reason?.message || e?.reason;
  if (typeof reason === 'string' && RO_WARNING.test(reason)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));

const renderApp = () =>
  root.render(
    <React.StrictMode>
      <HelmetProvider>
        <App />
        {/* The Toaster renders arbitrary values that came off the wire, and
            it lives OUTSIDE App's route-level ErrorBoundary — so a toast
            given a non-string (a FastAPI 422 `detail` is an array of
            objects) threw "Objects are not valid as a React child" at the
            root and unmounted the entire app: a blank white page, with the
            real error never shown. utils/apiError.js stops the bad value at
            the source; this stops any future one from being fatal.

            SilentBoundary rather than ErrorBoundary on purpose — the latter
            uses router hooks, and there is no <Router> out here (it lives
            inside <App/>), so it would throw on startup. */}
        <SilentBoundary>
          <Toaster position="top-right" duration={1500} />
        </SilentBoundary>
      </HelmetProvider>
    </React.StrictMode>,
  );

// Hold the first paint until i18next has the detected language in its store.
// English resolves on the next tick (it's bundled statically); a returning
// Hebrew visitor waits on one async locale chunk, which is what stops them
// from seeing a flash of English before the switch lands. If the locale chunk
// fails to load we render anyway — `fallbackLng: 'en'` keeps the UI usable
// rather than leaving a blank page.
i18nReady.then(renderApp, renderApp);
