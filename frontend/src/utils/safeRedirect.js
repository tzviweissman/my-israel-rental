/**
 * safeRedirect — the one gate a post-sign-in `?redirect=` value goes through.
 *
 * Every gated route in the app sends people to sign in with
 * `?redirect=<encodeURIComponent(pathname + search)>`, so a legitimate value
 * is always a same-site path. Both sign-in paths read it: the email form in
 * pages/Auth.js and the Google flow in components/auth. Until 13 Sep 2026 the
 * Google flow ignored it entirely, and the email form used the raw value with
 * no check at all.
 *
 * Returns the path when it is safe to navigate to, otherwise null — and null
 * means "fall back to the dashboard", never an error the visitor sees.
 *
 * Rejected, and why:
 *   - anything not starting with "/"   an absolute or relative URL
 *   - "//host"                         protocol-relative: another site
 *   - any backslash                    browsers read "/\host" as "//host"
 *   - control characters               CR/LF and friends have no place in a path
 *   - "/auth" and "/auth/..."          sends a signed-in visitor back to the
 *                                      login form, which is a loop
 *
 * Control characters are found by char code rather than a regex character
 * class. The first version used one, and on its way to disk the escapes in it
 * became the raw bytes they describe, NUL included — a source file with a NUL
 * byte that git would treat as binary. Char codes cannot be mangled that way.
 */
const BACKSLASH = 92;
const DEL = 127;

const hasBackslashOrControlChar = (text) => {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === BACKSLASH || code < 32 || code === DEL) return true;
  }
  return false;
};

export default function safeRedirect(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null;
  if (hasBackslashOrControlChar(path)) return null;
  if (path === '/auth' || path.startsWith('/auth/') || path.startsWith('/auth?')) return null;
  return path;
}
