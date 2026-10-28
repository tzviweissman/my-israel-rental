# Site audit, 10 Oct 2026 (automated, read-only)

Scope: commits from the last 3 days (9 Oct): owner page editor (page_edits.py, server.js, PageEditor.jsx, mir-editor.js), restaurant map pins, Businesses showcase row. No fixes made.

## Summary
0 Critical, 0 High, 2 Medium, 3 Low. Worth doing first: (1) put the two JobsBoard Hebrew strings in the right place, (2) block `//host` links in the page-editor sanitizer, (3) make the restaurant pin lookup safe to fail.

## Findings
1. **Medium: Hebrew shows English on the jobs board area box.** `pages/JobsBoard.jsx:205-206` uses `jobsBoard.areaPh` and `jobsBoard.areaFreeText`. Those strings exist in en.js/he.js but under `reviewForm`, not `jobsBoard` (en.js ~1033, ~4068; he.js ~1026, ~3910). The English fallback in the `t()` call shows instead. Fix: move or rename the keys.
2. **Medium: editor links can point off-site.** `backend/routes/marketplace/page_edits.py` HREF_RE allows anything starting with `/`, so `<a href="//evil.com">` is saved as-is (probe output confirmed). Scripts, event handlers and `javascript:` links ARE stripped correctly. An owner could put an off-site link on their own public page. Fix: require `/` not followed by `/`.
3. **Low: restaurant pin lookup fails silently.** `routes/restaurants.py`: `asyncio.create_task(_pin_from_address(...))` keeps no reference and has no try/except, so a Nominatim error vanishes. `admin/restaurants/pin-missing` runs lookups one by one (about 3 s each), so a large batch can time out. `lat`/`lng` are not range-checked.
4. **Low: image URL substitution.** `frontend/server.js` applyEdits passes the edited image URL as a string replacement, so a URL containing `$&` or `$'` would be mangled. Use a function replacer. Any https host is allowed for photos (tracking-pixel risk only).
5. **Low: CLAUDE.md says no new hardcoded hex.** PageEditor.jsx and ShowcaseCard/Strip use literal hexes (#F9FAFB, #E3E3E3, #F3F4F6 and so on) instead of tokens.

## Verified clean
- Price parity + page-edit tests: 28 passed.
- Translation keys: 2,887 keys used in the frontend, only the 2 above missing in both languages (a third hit, `tips.tip.share`, is in a comment). 28 keys exist in Hebrew only.
- No inline `fontFamily: 'Playfair Display'` in the frontend.
- Page-edit save/delete routes check ownership (`_owned`); editor postMessage checks origin both ways; `<script>`, `onerror`/`onclick` and `javascript:` are stripped.

## Not checked
- **Live listing price check DID NOT RUN**: the sandbox proxy returned 403 for myisraelrental.com/api/properties. No price findings either way.
- The rest of the backend suite: `tests/test_jobs_end_to_end.py` errors at collection here (needs services this sandbox lacks); I did not investigate or run the remainder.
- Screenshots / RTL / Lighthouse, production build, dependency audit, double-booking and IDOR sweeps, Obsidian notes (no Obsidian access in this session; used git history instead).
