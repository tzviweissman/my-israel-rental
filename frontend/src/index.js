import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "@/index.css";
import App from "@/App";
import { Toaster } from "sonner";

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
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
      <Toaster position="top-right" duration={1500} />
    </HelmetProvider>
  </React.StrictMode>,
);
