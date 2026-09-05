/**
 * K3 — the page editor, with the page itself as the preview.
 *
 * From docs/business-page-customization-spec.md:
 *
 *   The editor shows the real page component, with the real business data,
 *   and the pending edits applied — not a mock of it. Two renderers of one
 *   design drift, and the one that drifts is the one the owner is looking
 *   at.
 *
 *   Changes apply on change, save is explicit, and leaving without saving
 *   discards. An owner must never wonder whether what they are seeing is
 *   live.
 *
 * So there is no preview markup in this file. `<BusinessPage>` is imported
 * and rendered, exactly the component `/business/{slug}` renders, fed the
 * payload from exactly the endpoint that page reads — with the unsaved
 * edits merged over it. Anything the owner sees here is something the page
 * can actually do, because it IS the page doing it.
 *
 * WHY THE PAYLOAD IS FETCHED AND NOT PASSED IN
 * --------------------------------------------
 * The dashboard's own list is a different, smaller shape: it carries no
 * listings, no ratings, no collections — and none of the three fields
 * edited here. A preview built on it would be a business page with an
 * empty catalogue, which is not this owner's page and would be a lie about
 * the thing they are deciding on.
 *
 * WHY THE PREVIEW IS INERT
 * ------------------------
 * Clicks are swallowed. A live "Message" button inside the preview would
 * navigate the frame to a chat thread with no way back, losing the edits;
 * a service card would do the same. The owner is looking at the page, not
 * shopping on it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Loader2, Monitor, Smartphone, ImagePlus, Trash2, Plus, CreditCard, AlertCircle,
} from 'lucide-react';
import BusinessPage from '../../pages/BusinessPage';
import PreviewFrame from './PreviewFrame';
import { ACCENTS, ACCENT_NAMES, DEFAULT_ACCENT } from '../../utils/businessAccent';
import BusinessShelfEditor, { cleanCollections } from './BusinessShelfEditor';
import PageThemeDials, { dialLabel, dialValueLabel } from './PageThemeDials';
import PageBriefForm from './PageBriefForm';
import {
  DIAL_DEFAULTS, PRESETS, briefToTheme, composeDefault, normalizeTheme, themeDiff,
} from '../../utils/pageComposition';
import { uploadOneFile } from '../../utils/fastUpload';

// The two shapes a page is actually read at. Not a slider: an owner asked
// to pick a pixel width is being asked a question they have no way to
// answer, and every answer between these two tells them nothing new.
const DEVICES = {
  desktop: 1280,
  phone: 390,
};

/** Which allowlisted provider a URL belongs to, or null.
 *
 *  ADVISORY ONLY. The gate is `backend/utils/payment_links.py`, which
 *  re-checks every link on save and refuses with a message naming what is
 *  accepted — a second client, or this one with its JavaScript edited,
 *  gets nowhere. What this buys is that the owner finds out while they are
 *  looking at the field rather than after pressing Save.
 *
 *  `providers` comes from the API, so the list of domains exists in one
 *  place. The matching RULE is duplicated here, and deliberately matches
 *  the server's: host equality, or a subdomain with a dot boundary. Never
 *  `endsWith(domain)` on its own — that is how `evil-paybox.co.il` gets in.
 */
export function matchProvider(raw, providers) {
  const value = String(raw || '').trim();
  if (!value || !Array.isArray(providers) || providers.length === 0) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;   // includes "//paybox.co.il/x" — no scheme to check
  }
  // A payment link over plain http is not one, and neither is a
  // `javascript:` URL dressed up as a link.
  if (url.protocol !== 'https:') return null;
  // Credentials in a payment URL are either a mistake or an attack, and
  // they are what makes `https://paybox.co.il@evil.com` look right.
  if (url.username || url.password) return null;
  // "paybox.co.il." is a valid absolute form of the same host.
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  return providers.find(
    (p) => host === p.domain || host.endsWith(`.${p.domain}`),
  ) || null;
}

let rowSeq = 0;
const newRow = (link = {}) => ({
  key: `pl-${(rowSeq += 1)}`,
  url: link.url || '',
  label: link.label || '',
  // Until the owner types in the label field it follows the URL, so
  // pasting a Bit link produces a button that says "Bit" without anyone
  // having to think about it.
  labelTouched: Boolean(link.label),
});

export default function BusinessPageEditor({ business, API, token, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const auth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  const [page, setPage] = useState(null);        // the real public payload
  const [failed, setFailed] = useState(false);
  const [providers, setProviders] = useState([]);
  // Served alongside the provider list rather than written down again
  // here. The cap is enforced at the API — a form that disagrees with it
  // either blocks a link the server would take or offers one it refuses.
  const [maxLinks, setMaxLinks] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [device, setDevice] = useState(
    // A phone-sized dashboard defaults to the phone view: scaling a 1280px
    // page into a 360px column is a picture of the layout, not a reading
    // of it.
    () => (typeof window !== 'undefined' && window.innerWidth < 1024 ? 'phone' : 'desktop'),
  );
  const fileRef = useRef(null);

  // The edits, and the values they are edits TO. `saved` moves only on a
  // successful save, which is what makes "unsaved changes" a fact rather
  // than a guess.
  const [saved, setSaved] = useState(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [coverUrl, setCoverUrl] = useState(null);
  const [rows, setRows] = useState([]);
  // What the page leads with, and how it is grouped. Both have been on
  // the business document and rendered by the page since it was built,
  // with no way to set either (dead-ends audit 2026-09-03, #10).
  const [pinned, setPinned] = useState([]);
  const [collections, setCollections] = useState([]);
  /* Phase 2 - the six dials and the brief behind them.
     `touched` is which dials the owner has set BY HAND. It exists because
     the brief and the dials are two ways to reach the same six values,
     and without it answering a later question would silently undo a dial
     the owner had already moved. The brief proposes; a hand does not get
     overruled by a tap. */
  const [theme, setTheme] = useState(DIAL_DEFAULTS);
  const [touched, setTouched] = useState(() => new Set());
  const [brief, setBrief] = useState({});
  /* P7f - "then show what changed". It teaches the vocabulary, so the
     next choice is sharper than the last, and it is how an owner finds
     out they can reach the same result with a free button. */
  const [changed, setChanged] = useState([]);

  const slug = business?.slug || business?.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        /* The public page's own endpoint, with the owner's token attached.
           The token does two things: it lets an owner design a page that
           is still hidden or has nothing published yet — the endpoint
           serves those to the owner alone — and it stops the editor
           counting as a visit, because view tracking drops a view whose
           viewer is the owner. */
        const { data } = await axios.get(
          `${API}/marketplace/business/${encodeURIComponent(slug)}`,
          auth,
        );
        if (cancelled) return;
        setPage(data);
        setAccent(ACCENTS[data.accent] ? data.accent : DEFAULT_ACCENT);
        setCoverUrl(data.cover_url || null);
        setRows((data.payment_links || []).map(newRow));
        setPinned((data.pinned_service_ids || []).slice(0, 3));
        setCollections((data.collections || []).map((c) => ({ ...c, service_ids: c.service_ids || [] })));
        const loadedTheme = normalizeTheme(data.page && data.page.theme);
        setTheme(loadedTheme);
        setBrief(data.page_brief || {});
        /* Which dials were set BY HAND, worked out rather than guessed:
           a dial whose saved value is what the saved brief would have
           produced was not set by hand, and one that differs was. Exact,
           because both halves are stored.

           The obvious shortcut - "anything saved counts as touched" - is
           wrong in the case that matters most: an owner who saved once
           and came back to answer the questions would find that every
           answer moved nothing, and the brief would be inert for exactly
           the people using it properly. */
        const derived = briefToTheme(data.page_brief || {}, loadedTheme);
        setTouched(new Set(
          Object.keys(DIAL_DEFAULTS).filter((d) => loadedTheme[d] !== derived[d]),
        ));
        setSaved({
          accent: ACCENTS[data.accent] ? data.accent : DEFAULT_ACCENT,
          cover_url: data.cover_url || null,
          payment_links: data.payment_links || [],
          pinned_service_ids: (data.pinned_service_ids || []).slice(0, 3),
          collections: cleanCollections(data.collections || []),
          theme: loadedTheme,
          brief: data.page_brief || {},
          composed: Boolean(data.page),
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [API, slug, auth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/marketplace/payment-providers`);
        if (cancelled) return;
        setProviders(data.providers || []);
        if (Number.isFinite(data.max)) setMaxLinks(data.max);
      } catch {
        /* The form still works: every link is checked on save and refused
           with the server's own message. Only the early warning is lost. */
      }
    })();
    return () => { cancelled = true; };
  }, [API]);

  /* What the three fields will be once saved — and therefore what the
     preview must show. A row whose URL is not from an accepted provider is
     NOT here, because it will not be on the page either: showing it would
     promise the owner a button that is about to be refused.

     The label falls back to the provider's name rather than being sent
     empty, so the server's own fallback never fires. Two places deciding
     what a button says is one place too many. */
  const validLinks = useMemo(() => rows.reduce((out, r) => {
    const provider = matchProvider(r.url, providers);
    if (!provider) return out;
    out.push({ label: r.label.trim() || provider.name, url: r.url.trim() });
    return out;
  }, []), [rows, providers]);

  /* The preview's business: the real payload with the pending edits over
     it. This object is the entire mechanism — there is no second renderer
     to keep in step, only a different value for three keys. */
  /* The blocks. There is no block editor yet - phase 1 built the library
     and the schema, not a canvas - so these are whatever the business
     already has, or the document that describes the page it already had.
     Saving a dial on a business that has never been designed therefore
     writes a composition of its CURRENT page plus the new theme, rather
     than inventing a layout nobody asked for. */
  const blocks = useMemo(
    () => (page && page.page && (page.page.blocks || []).length
      ? page.page.blocks
      : composeDefault(page).blocks),
    [page],
  );

  /* The palette dial IS the accent picker. One decision, one control: a
     second colour control in the same panel is two controls that can
     disagree, and the one that loses is whichever they used first. */
  const fullTheme = useMemo(() => ({ ...theme, palette: accent }), [theme, accent]);

  const previewBusiness = useMemo(() => (page ? {
    ...page,
    accent,
    cover_url: coverUrl,
    payment_links: validLinks,
    page: { theme: fullTheme, blocks },
    // The preview is the point of this screen, so every edit has to reach
    // it. Cleaned, not raw: a group being typed has no name yet, and the
    // preview would show a heading over nothing until the owner finished
    // the word. It appears the moment it has a name and something in it,
    // which is also exactly when it would save.
    pinned_service_ids: pinned,
    collections: cleanCollections(collections),
  } : null), [page, accent, coverUrl, validLinks, pinned, collections, fullTheme, blocks]);

  const dirty = useMemo(() => {
    if (!saved) return false;
    if (JSON.stringify(pinned) !== JSON.stringify(saved.pinned_service_ids || [])) return true;
    if (JSON.stringify(cleanCollections(collections)) !== JSON.stringify(saved.collections || [])) return true;
    if (JSON.stringify(brief) !== JSON.stringify(saved.brief || {})) return true;
    // A theme that MATCHES the defaults is still a change on a business
    // that has never been designed: saving is what turns "the page it
    // happens to have" into "the page it chose".
    if (themeDiff(saved.theme, theme).length > 0) return true;
    if (!saved.composed && touched.size > 0) return true;
    return accent !== saved.accent
      || (coverUrl || null) !== (saved.cover_url || null)
      || JSON.stringify(validLinks) !== JSON.stringify(
        (saved.payment_links || []).map((p) => ({ label: p.label, url: p.url })),
      );
  }, [saved, accent, coverUrl, validLinks, pinned, collections, brief, theme, touched]);

  const close = useCallback(() => {
    if (dirty) {
      // eslint-disable-next-line no-alert
      const ok = window.confirm(t(
        'pageDesign.confirmDiscard',
        'Close without saving? Your changes to this page will be lost.',
      ));
      if (!ok) return;
    }
    onClose && onClose();
  }, [dirty, onClose, t]);

  // A reload with unsaved edits loses them silently otherwise. Same promise
  // as the confirm above, made to the browser's own leave-the-page path.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setRow = (key, patch) => setRows(
    (list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)),
  );

  const onUrlChange = (row, value) => {
    const provider = matchProvider(value, providers);
    setRow(row.key, {
      url: value,
      // Only while the owner has not written their own label.
      label: row.labelTouched ? row.label : (provider ? provider.name : ''),
    });
  };

  const pickCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';   // so choosing the same file twice still fires
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadOneFile(file, API, token);
      setCoverUrl(url);
    } catch (err) {
      toast.error(err?.message || t('pageDesign.coverFailed', 'Could not upload that photo'));
    } finally {
      setUploading(false);
    }
  };

  const markTouched = (dials) => setTouched((prev) => {
    const next = new Set(prev);
    dials.forEach((d) => next.add(d));
    return next;
  });

  const applyTheme = (next, touchedDials) => {
    const clean = normalizeTheme(next);
    setChanged(themeDiff(theme, clean));
    setTheme(clean);
    if (touchedDials) markTouched(touchedDials);
  };

  /* An answer moves the dials the owner has NOT set by hand.
     This is P2's crux running for real, with no model behind it: the
     brief becomes a position on six axes. Later a model produces the same
     six values from the same brief with more nuance, which makes
     generation a swap rather than a rebuild - and means the questions are
     tested against whether they change anything before anyone is charged
     for an answer. */
  const changeBrief = (nextBrief) => {
    setBrief(nextBrief);
    const proposed = briefToTheme(nextBrief, { ...theme, palette: accent });
    const merged = { ...theme };
    Object.keys(DIAL_DEFAULTS).forEach((d) => {
      if (!touched.has(d)) merged[d] = proposed[d];
    });
    setChanged(themeDiff(theme, merged));
    setTheme(merged);
  };

  const pickPreset = (name) => applyTheme({ ...theme, ...PRESETS[name] }, Object.keys(PRESETS[name]));

  const save = async () => {
    setSaving(true);
    try {
      // A group with no name or nothing in it is dropped rather than
      // sent: the API would take it and the page would render a heading
      // over nothing.
      const keptCollections = cleanCollections(collections);
      /* Every key spelled out rather than spread. The API refuses an
         unexpected one outright (`extra="forbid"` on every level of the
         composition), which is the point of the schema - but it means a
         stray key here is a save that fails wholesale rather than one
         field being ignored. */
      const briefPayload = {
        showing: brief.showing || null,
        action: brief.action || null,
        audience: brief.audience || null,
        pricing: brief.pricing || null,
        strengths: brief.strengths || [],
        note: (brief.note || '').trim(),
      };
      await axios.patch(
        `${API}/marketplace/businesses/${business.id}`,
        {
          accent,
          cover_url: coverUrl,
          payment_links: validLinks,
          pinned_service_ids: pinned,
          collections: keptCollections,
          page: { theme: fullTheme, blocks },
          page_brief: briefPayload,
        },
        auth,
      );
      setCollections(keptCollections);
      setBrief(briefPayload);
      setSaved({
        accent, cover_url: coverUrl, payment_links: validLinks,
        pinned_service_ids: pinned, collections: keptCollections,
        theme, brief: briefPayload, composed: true,
      });
      toast.success(t('pageDesign.saved', 'Your page is updated'));
      onSaved && onSaved();
    } catch (err) {
      // The API names what it accepts when it refuses a payment link, and
      // that message is more use to the owner than anything written here.
      toast.error(
        err?.response?.data?.detail
        || t('pageDesign.saveFailed', 'Could not save — try again'),
      );
    } finally {
      setSaving(false);
    }
  };

  const dir = i18n.dir ? i18n.dir() : 'ltr';
  // Until the cap is known, adding is allowed: the API is the one that
  // decides, and guessing low would hide a link the owner is entitled to.
  const atCap = maxLinks !== null && rows.length >= maxLinks;

  const preview = (
    /* `min-w-0` is load-bearing, not tidiness. A flex item defaults to
       `min-width: auto`, which refuses to shrink below its content — and
       the content here is a 1280px-wide frame. Without it the panel stays
       1280px wide inside a narrower window, the scale stays 1, and the
       owner is shown their page with the right-hand third cut off. */
    <div className="h-[55vh] lg:h-auto lg:flex-1 min-h-0 min-w-0 flex flex-col shrink-0 lg:shrink"
      style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-center gap-1 py-2 shrink-0">
        {[['desktop', Monitor, t('pageDesign.desktop', 'Desktop')],
          ['phone', Smartphone, t('pageDesign.phone', 'Phone')]].map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-pressed={device === key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={device === key
                ? { background: 'var(--brand-primary)', color: '#fff' }
                : { color: 'var(--brand-muted)' }}
              data-testid={`page-design-device-${key}`}
            >
              <Icon size={13} /> {label}
            </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 px-3 pb-3">
        {previewBusiness ? (
          <PreviewFrame
            width={DEVICES[device]}
            dir={dir}
            lang={i18n.language}
            title={t('pageDesign.previewTitle', 'Preview of your business page')}
            className="w-full h-full"
          >
            {/* Clicks stopped in the capture phase, before an anchor's
                default or a card's handler can run. Not `pointer-events:
                none`, which would take the scrolling with it — and a
                preview you cannot scroll shows the owner the top of their
                page and nothing else. */}
            <div
              onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onSubmitCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}
              data-testid="page-design-preview"
            >
              <BusinessPage business={previewBusiness} preview />
            </div>
          </PreviewFrame>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {failed ? (
              <p className="text-sm text-center px-6" style={{ color: 'var(--brand-muted)' }}>
                {t('pageDesign.loadFailed', 'Could not load your page just now. Close this and try again.')}
              </p>
            ) : (
              <Loader2 className="animate-spin" size={20} style={{ color: 'var(--brand-muted)' }} />
            )}
          </div>
        )}
      </div>
    </div>
  );

  const controls = (
    <div
      className="w-full flex-1 lg:flex-none lg:w-[380px] min-h-0 lg:shrink-0 overflow-y-auto p-5 space-y-6 bg-white lg:border-e"
      style={{ borderColor: 'var(--brand-border)' }}
    >
      {/* ---- Accent (K1) ---- */}
      <section>
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {t('pageDesign.accent', 'Colour')}
        </h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
          {t('pageDesign.accentHint', 'Signs your page. Buttons stay the same everywhere on the site.')}
        </p>
        <div className="flex gap-2" role="radiogroup"
          aria-label={t('pageDesign.accent', 'Colour')}>
          {ACCENT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={accent === name}
              aria-label={t(`pageDesign.accent_${name}`, name)}
              onClick={() => setAccent(name)}
              className="w-12 h-12 rounded-xl border-2 transition-transform hover:scale-105"
              style={{
                background: ACCENTS[name].tint,
                borderColor: accent === name ? 'var(--ink)' : 'var(--brand-border)',
              }}
              data-testid={`page-design-accent-${name}`}
            />
          ))}
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--brand-muted)' }}>
          {t(`pageDesign.accent_${accent}`, accent)}
        </p>
      </section>

      {/* ---- Cover photo (K2) ---- */}
      <section className="pt-5 border-t" style={{ borderColor: 'var(--brand-border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {t('pageDesign.cover', 'Cover photo')}
        </h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
          {t('pageDesign.coverHint', 'A wide photo behind your name. Without one, your page uses a photo from your first service.')}
        </p>
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="w-full h-24 object-cover rounded-lg mb-2"
            style={{ border: '1px solid var(--brand-border)' }}
            data-testid="page-design-cover-thumb"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-60"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}
            data-testid="page-design-cover-pick"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {coverUrl
              ? t('pageDesign.coverReplace', 'Change photo')
              : t('pageDesign.coverAdd', 'Add a photo')}
          </button>
          {coverUrl && (
            <button
              type="button"
              onClick={() => setCoverUrl(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ color: 'var(--brand-muted)' }}
              data-testid="page-design-cover-remove"
            >
              <Trash2 size={13} /> {t('pageDesign.coverRemove', 'Remove')}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={pickCover}
            className="hidden"
            data-testid="page-design-cover-input"
          />
        </div>
      </section>

      {/* ---- The brief (P7b), then the dials it moves (P2) ---- */}
      <PageBriefForm
        business={page}
        brief={brief}
        onChange={changeBrief}
        theme={fullTheme}
        onPickPreset={pickPreset}
        previewBusiness={previewBusiness}
      />

      <PageThemeDials
        theme={fullTheme}
        onChange={(next) => applyTheme(next)}
        touched={touched}
        onTouch={markTouched}
      />

      {/* P7f - what just changed, in the same words the buttons use. Said
          plainly rather than animated, because the point is that they can
          read it and learn the vocabulary, not that they notice it. */}
      {changed.length > 0 && (
        <p className="text-xs -mt-3" style={{ color: 'var(--brand-muted)' }} data-testid="page-design-changed">
          {t('pageDesign.changed', 'Changed:')}{' '}
          {changed
            .filter((c) => c.dial !== 'palette')
            .map((c) => `${dialLabel(t, c.dial)} - ${dialValueLabel(t, c.dial, c.to)}`)
            .join(', ')}
        </p>
      )}

      {/* ---- What the page leads with, and its groups (C1 + C5) ---- */}
      <BusinessShelfEditor
        listings={page?.listings || []}
        pinned={pinned}
        onPinnedChange={setPinned}
        collections={collections}
        onCollectionsChange={setCollections}
      />

      {/* ---- Payment links (P1) ---- */}
      <section className="pt-5 border-t" style={{ borderColor: 'var(--brand-border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {t('pageDesign.payment', 'Payment links')}
        </h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
          {/* Said plainly because it is the reassurance that makes an owner
              willing to put a payment link here at all. */}
          {t('pageDesign.paymentHint', 'Your own link, on your own provider. The money never comes through us.')}
        </p>

        <div className="space-y-3">
          {rows.map((row) => {
            const provider = matchProvider(row.url, providers);
            const bad = row.url.trim().length > 0 && !provider;
            return (
              <div key={row.key} className="space-y-1.5" data-testid="page-design-payment-row">
                <div className="flex gap-1.5">
                  <input
                    value={row.url}
                    onChange={(e) => onUrlChange(row, e.target.value)}
                    placeholder="https://paybox.co.il/…"
                    dir="ltr"
                    className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm ${bad ? 'border-red-300' : ''}`}
                    style={{ borderColor: bad ? undefined : 'var(--brand-border)' }}
                    aria-label={t('pageDesign.paymentUrl', 'Payment link')}
                    aria-invalid={bad}
                    data-testid="page-design-payment-url"
                  />
                  <button
                    type="button"
                    onClick={() => setRows((l) => l.filter((r) => r.key !== row.key))}
                    className="p-2 rounded-lg shrink-0"
                    style={{ color: 'var(--brand-muted)' }}
                    aria-label={t('pageDesign.paymentRemove', 'Remove this link')}
                    data-testid="page-design-payment-remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {provider && (
                  <input
                    value={row.label}
                    onChange={(e) => setRow(row.key, { label: e.target.value, labelTouched: true })}
                    maxLength={40}
                    placeholder={provider.name}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--brand-border)' }}
                    aria-label={t('pageDesign.paymentLabel', 'Button text')}
                    data-testid="page-design-payment-label"
                  />
                )}
                {bad && (
                  <p className="text-xs flex items-start gap-1 text-red-700"
                    data-testid="page-design-payment-error">
                    <AlertCircle size={13} className="shrink-0 mt-px" />
                    {t('pageDesign.paymentRefused', 'We can only show links from a payment provider we recognise, over https.')}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!atCap && (
          <button
            type="button"
            onClick={() => setRows((l) => [...l, newRow()])}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--brand-primary)' }}
            data-testid="page-design-payment-add"
          >
            <Plus size={13} /> {t('pageDesign.paymentAdd', 'Add a payment link')}
          </button>
        )}

        {providers.length > 0 && (
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--brand-muted)' }}
            data-testid="page-design-payment-providers">
            <CreditCard size={12} className="inline me-1" aria-hidden="true" />
            {t('pageDesign.paymentAccepted', 'Accepted: {{list}}', {
              // De-duplicated: PayPal has two domains and reads as a
              // mistake listed twice.
              list: [...new Set(providers.map((p) => p.name))].join(', '),
            })}
          </p>
        )}
      </section>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--surface)' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('pageDesign.title', 'Design your page')}
      data-testid="business-page-editor"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--brand-border)' }}
      >
        <div className="min-w-0">
          <h2 className="text-base font-bold truncate"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('pageDesign.title', 'Design your page')}
          </h2>
          <p className="text-xs truncate" style={{ color: 'var(--brand-muted)' }}>
            {business?.name}
            {dirty && ` · ${t('pageDesign.unsaved', 'Unsaved changes')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={close}
            className="px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ color: 'var(--brand-muted)' }}
            data-testid="page-design-close"
          >
            <X size={16} className="inline me-1" />
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }}
            data-testid="page-design-save"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Preview above the controls on a phone, beside them on a desktop.
          Either way it is on screen while the control is being used —
          "changes apply on change" is worth nothing if the change happens
          off screen. */}
      <div className="flex-1 min-h-0 flex flex-col-reverse lg:flex-row">
        {controls}
        {preview}
      </div>
    </div>
  );
}
