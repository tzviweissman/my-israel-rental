/**
 * Notice when a newer front end has been deployed, and pick it up.
 *
 * The gap this closes: `staleBuildInterceptor` only ever noticed the
 * BACKEND moving — it watches an `X-Build-Id` response header and a 404
 * from a route the server does not have yet. A frontend-only deploy (most
 * of them: copy, layout, a fixed menu) changes no header and breaks no
 * route, so someone who left a tab open kept the old bundle indefinitely
 * and was never told.
 *
 * The version marker is CRA's own `asset-manifest.json`, whose `main.js`
 * entry carries a content hash that changes exactly when the bundle does.
 * Nothing has to be stamped at build time and no build config changes —
 * CRA emits this file on every production build, and `serve` publishes it.
 *
 * WHEN we check matters more than how often. A timer alone means either
 * checking constantly or telling someone about an update long after it
 * landed; the useful moment is when a person returns to the tab, which is
 * also the moment a reload costs them least.
 */
import i18n from '../i18n';
import { toast } from 'sonner';

const MANIFEST = '/asset-manifest.json';
const POLL_MS = 5 * 60 * 1000;

// Which version we already reloaded for. Without this, a bundle that
// keeps reporting "new" — a CDN serving a stale manifest, a half-finished
// rollout — would reload the page forever.
const RELOADED_FOR = '__auto_reload_for';
const TOAST_SHOWN = '__update_toast_shown';

let baseline = null;
let started = false;

const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};

/** The deployed bundle's content hash, or null if it cannot be read.
 *  Never throws: offline, a 404 under `npm start` (the dev server does not
 *  emit a manifest), or malformed JSON all mean "no answer", not "broken". */
async function fetchVersion() {
  try {
    const res = await fetch(`${MANIFEST}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.files?.['main.js'] || null;
  } catch {
    return null;
  }
}

/**
 * Is reloading right now free of consequence for this person?
 *
 * A reload discards everything in memory. Doing that under someone typing
 * a message, or five steps into the posting wizard, would be a worse bug
 * than the stale bundle it fixes — so anything that looks like work in
 * progress downgrades the automatic reload to an offer.
 */
function safeToReload() {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
    return false;
  }
  // A field holding something the user put there. `defaultValue` is what
  // the markup shipped with, so a difference is a person's edit.
  const fields = [...document.querySelectorAll('input, textarea')];
  const dirty = fields.some((f) => {
    if (f.type === 'hidden' || f.disabled || f.offsetParent === null) return false;
    if (f.type === 'checkbox' || f.type === 'radio') return f.checked !== f.defaultChecked;
    return (f.value || '') !== (f.defaultValue || '');
  });
  if (dirty) return false;

  // An open dialog usually means a decision half-made.
  const dialog = document.querySelector('[role="dialog"], dialog[open]');
  if (dialog && dialog.offsetParent !== null) return false;

  return true;
}

function offerUpdate() {
  if (session.get(TOAST_SHOWN)) return;
  session.set(TOAST_SHOWN, '1');
  toast(i18n.t('update.available', 'A newer version of the site is available.'), {
    duration: 15000,
    position: 'top-center',
    action: {
      label: i18n.t('update.refresh', 'Update now'),
      onClick: () => window.location.reload(),
    },
  });
}

async function check() {
  const latest = await fetchVersion();
  if (!latest) return;

  if (!baseline) {
    baseline = latest;
    // Arrived on the version we reloaded for — the reload worked, so let
    // a future update reload again.
    if (session.get(RELOADED_FOR) === latest) session.del(RELOADED_FOR);
    return;
  }
  if (latest === baseline) return;

  // Already tried reloading for this exact version and we are still on the
  // old one: reloading again would not help. Ask instead of looping.
  if (session.get(RELOADED_FOR) === latest) {
    offerUpdate();
    return;
  }

  if (safeToReload()) {
    session.set(RELOADED_FOR, latest);
    window.location.reload();
  } else {
    offerUpdate();
  }
}

export function startVersionWatcher() {
  if (started) return;
  started = true;

  check();
  setInterval(check, POLL_MS);
  // Returning to the tab is the cheapest possible moment to reload.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
}

export default startVersionWatcher;
