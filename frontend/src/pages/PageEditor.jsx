/**
 * "Edit your page" for a business whose page was designed for them (a
 * hand-built page, docs/hand-built-pages.md). Tzvi, 9 Oct 2026: edit it the
 * way Claude Design works, "easy to move text or change text ... or photos".
 *
 * The page itself is framed with ?mir-edit=1; frontend/server.js then loads
 * public/pages/mir-editor.js into it, which does the clicking, typing,
 * dragging and resizing on the page and reports every change here. This
 * screen keeps undo and redo, uploads replacement photos, switches between
 * laptop and phone (moves are kept per device), and saves to
 * PUT /api/marketplace/businesses/:id/page-edits, after which the live page
 * shows the change for every visitor.
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Laptop, Smartphone, Undo2, Redo2, ExternalLink, Loader2, RotateCcw, Images, X, ChevronLeft, ChevronRight, Trash2, Plus } from 'lucide-react';
import { API, AuthContext } from '../App';
import { uploadOneFile } from '../utils/fastUpload';

const EMPTY = { text: {}, img: {}, style: {} };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function PageEditor() {
  const { t } = useTranslation();
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const [biz, setBiz] = useState(null);
  const [device, setDevice] = useState('d');
  const [hist, setHist] = useState({ past: [], now: EMPTY, future: [] });
  const [saved, setSaved] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  // A designed site can have several pages (site.json, written on publish).
  const [pages, setPages] = useState([]);
  const [pageName, setPageName] = useState('index');
  const [box, setBox] = useState({ w: 1200, h: 800 });
  const frame = useRef(null);
  const stage = useRef(null);
  const fileInput = useRef(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const picking = useRef(null);
  const auth = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const dirty = !same(hist.now, saved);

  useEffect(() => {
    axios.get(`${API}/marketplace/business/${businessId}`)
      .then((r) => setBiz(r.data.business || r.data))
      .catch(() => toast.error(t('pageEditor.notFound', 'This page could not be opened')));
  }, [businessId, t]);

  useEffect(() => {
    if (!biz?.slug) return;
    fetch(`/pages/${biz.slug}/site.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => setPages(Array.isArray(l) ? l : []))
      .catch(() => setPages([]));
  }, [biz]);

  // The stage's size, so the laptop view can be scaled to fit.
  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [biz]);

  const send = useCallback((msg) => {
    frame.current?.contentWindow?.postMessage({ source: 'mir-dashboard', ...msg }, window.location.origin);
  }, []);

  const push = useCallback((edits) => {
    setHist((h) => (same(h.now, edits) ? h : { past: [...h.past, h.now].slice(-100), now: edits, future: [] }));
  }, []);
  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      send({ type: 'mir:load', edits: prev });
      return { past: h.past.slice(0, -1), now: prev, future: [h.now, ...h.future] };
    });
  }, [send]);
  const redo = useCallback(() => {
    setHist((h) => {
      if (!h.future.length) return h;
      const next = h.future[0];
      send({ type: 'mir:load', edits: next });
      return { past: [...h.past, h.now], now: next, future: h.future.slice(1) };
    });
  }, [send]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin || !e.data || e.data.source !== 'mir-editor') return;
      const d = e.data;
      if (d.type === 'mir:ready') {
        setReady(true);
        // First load: what is saved. After a device switch the frame
        // reloads, and gets whatever is being worked on.
        setHist((h) => {
          if (h.past.length || h.future.length || !same(h.now, EMPTY)) { send({ type: 'mir:load', edits: h.now }); return h; }
          setSaved(d.edits || EMPTY);
          return { past: [], now: d.edits || EMPTY, future: [] };
        });
      } else if (d.type === 'mir:change') push(d.edits);
      else if (d.type === 'mir:undo') undo();
      else if (d.type === 'mir:redo') redo();
      else if (d.type === 'mir:pick') { picking.current = d.key; fileInput.current?.click(); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [push, undo, redo, send]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const key = picking.current;
    if (!file || !key) return;
    const tid = toast.loading(t('pageEditor.uploading', 'Uploading the photo…'));
    try {
      const url = await uploadOneFile(file, API, token);
      send({ type: 'mir:image', key, url });
      toast.success(t('pageEditor.photoIn', 'Photo replaced. Save to put it live.'), { id: tid });
    } catch (err) {
      toast.error(err.message || t('pageEditor.uploadFailed', 'The photo did not upload. Try again.'), { id: tid });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/marketplace/businesses/${businessId}/page-edits`, { edits: hist.now }, auth);
      setSaved(r.data.edits);
      setHist((h) => ({ ...h, now: r.data.edits }));
      toast.success(t('pageEditor.saved', 'Saved. Your page shows the changes now.'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('pageEditor.saveFailed', 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    if (!window.confirm(t('pageEditor.resetConfirm', 'Put the page back exactly as it was designed? Every change you saved is removed.'))) return;
    try {
      await axios.delete(`${API}/marketplace/businesses/${businessId}/page-edits`, auth);
      setSaved(EMPTY);
      setHist({ past: [], now: EMPTY, future: [] });
      setReady(false);
      setFrameKey((k) => k + 1);
      toast.success(t('pageEditor.resetDone', 'Back to the original design.'));
    } catch {
      toast.error(t('pageEditor.saveFailed', 'Could not save. Try again.'));
    }
  };

  const switchPage = (name) => {
    if (name === pageName) return;
    setPageName(name);
    setReady(false);
    setFrameKey((k) => k + 1);
  };

  const switchDevice = (d) => {
    if (d === device) return;
    setDevice(d);
    setReady(false);
    setFrameKey((k) => k + 1);
  };

  if (!biz) {
    return <div className="pe-loading"><Loader2 className="animate-spin" size={22} /></div>;
  }
  const slug = biz.slug;
  const W = device === 'd' ? 1280 : 390;
  const H = device === 'd' ? Math.max(720, Math.round(box.h / Math.min(1, (box.w - 32) / 1280))) : 844;
  const scale = device === 'd' ? Math.min(1, (box.w - 32) / 1280) : Math.min(1, (box.h - 24) / 844);

  return (
    <div className="pe">
      <style>{CSS}</style>
      <header className="pe-bar">
        <button type="button" className="pe-btn pe-ghost" onClick={() => (!dirty || window.confirm(t('pageEditor.leave', 'Leave without saving your changes?'))) && navigate('/dashboard?tab=my-businesses')}>
          <ArrowLeft size={16} className="pe-flip" /> <span>{t('pageEditor.back', 'Back')}</span>
        </button>
        <div className="pe-title">
          <strong>{t('pageEditor.title', 'Edit your page')}</strong>
          <span>{biz.name}</span>
        </div>
        {pages.length > 1 && (
          <label className="pe-page">
            <span className="pe-hide-sm">{t('pageEditor.page', 'Page')}</span>
            <select value={pageName} onChange={(e) => switchPage(e.target.value)}>
              {pages.map((p) => <option key={p.page} value={p.page}>{p.title}</option>)}
            </select>
          </label>
        )}
        <div className="pe-group" role="group" aria-label={t('pageEditor.device', 'Screen')}>
          <button type="button" className={`pe-seg${device === 'd' ? ' on' : ''}`} aria-pressed={device === 'd'} onClick={() => switchDevice('d')}>
            <Laptop size={16} /> <span>{t('pageEditor.laptop', 'Laptop')}</span>
          </button>
          <button type="button" className={`pe-seg${device === 'm' ? ' on' : ''}`} aria-pressed={device === 'm'} onClick={() => switchDevice('m')}>
            <Smartphone size={16} /> <span>{t('pageEditor.phone', 'Phone')}</span>
          </button>
        </div>
        <div className="pe-group">
          <button type="button" className="pe-icon" onClick={undo} disabled={!hist.past.length} aria-label={t('pageEditor.undo', 'Undo')} title={t('pageEditor.undo', 'Undo')}><Undo2 size={17} className="pe-flip" /></button>
          <button type="button" className="pe-icon" onClick={redo} disabled={!hist.future.length} aria-label={t('pageEditor.redo', 'Redo')} title={t('pageEditor.redo', 'Redo')}><Redo2 size={17} className="pe-flip" /></button>
        </div>
        <div className="pe-end">
          <button type="button" className={`pe-btn pe-ghost${photosOpen ? ' on' : ''}`} onClick={() => setPhotosOpen((o) => !o)} aria-expanded={photosOpen}>
            <Images size={15} /> <span className="pe-hide-sm">{t('pageEditor.photos', 'Photos')}</span>
          </button>
          <button type="button" className="pe-btn pe-ghost" onClick={resetAll} title={t('pageEditor.reset', 'Original design')}>
            <RotateCcw size={15} /> <span className="pe-hide-sm">{t('pageEditor.reset', 'Original design')}</span>
          </button>
          <a className="pe-btn pe-ghost" href={`/business/${slug}${pageName === 'index' ? '' : `/${pageName}`}?fresh=1`} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> <span className="pe-hide-sm">{t('pageEditor.viewLive', 'View live')}</span>
          </a>
          <button type="button" className="pe-btn pe-save" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {dirty ? t('pageEditor.save', 'Save') : t('pageEditor.savedShort', 'Saved')}
          </button>
        </div>
      </header>
      <p className="pe-help">{t('pageEditor.help', 'Click text to select it, click again to type. Drag anything to move it. Click a photo to replace it. Moves on laptop and on phone are kept separately.')}</p>
      <div className="pe-stage" ref={stage}>
        <div className="pe-frame-wrap" style={{ width: W * scale, height: H * scale }}>
          <iframe
            key={frameKey}
            ref={frame}
            title={t('pageEditor.title', 'Edit your page')}
            src={`/business/${slug}${pageName === 'index' ? '' : `/${pageName}`}?mir-edit=1`}
            className={`pe-frame${device === 'm' ? ' phone' : ''}`}
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          />
          {!ready && <div className="pe-cover"><Loader2 className="animate-spin" size={22} /></div>}
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
      {photosOpen && (
        <GalleryPanel slug={slug} businessId={businessId} token={token} auth={auth} t={t}
          onClose={() => setPhotosOpen(false)} onSaved={() => { setReady(false); setFrameKey((k) => k + 1); }} />
      )}
    </div>
  );
}

/**
 * The owner's own photos for the page's gallery (Tzvi, 19 Oct 2026: owners
 * add pictures without ruining the page's look). The page decides how they
 * look ([data-mir-gallery], public/pages/mir-gallery.js); here the owner only
 * adds, orders, removes, and taps the part of each photo that matters most,
 * which the crop keeps in view. Photos too small to look sharp are refused.
 */
const MIN_WIDTH = 1000;
const MAX_PHOTOS = 24;
function widthOf(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { resolve(img.naturalWidth); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
function GalleryPanel({ slug, businessId, token, auth, t, onClose, onSaved }) {
  const [items, setItems] = useState(null);
  const [savedItems, setSavedItems] = useState([]);
  const [hasPlace, setHasPlace] = useState(true);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    axios.get(`${API}/marketplace/business/${slug}/page-edits`)
      .then((r) => { const g = r.data.gallery || []; setItems(g); setSavedItems(g); })
      .catch(() => setItems([]));
    fetch(`/business/${slug}`, { cache: 'no-cache' }).then((r) => r.text())
      .then((html) => setHasPlace(/data-mir-gallery/.test(html))).catch(() => {});
  }, [slug]);
  const changed = items && !same(items, savedItems);
  const move = (i, d) => setItems((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const focus = (i, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = Math.round(((e.clientX - r.left) / r.width) * 100);
    const fy = Math.round(((e.clientY - r.top) / r.height) * 100);
    setItems((l) => l.map((p, k) => (k === i ? { ...p, fx, fy } : p)));
  };
  const add = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_PHOTOS - items.length;
    if (room <= 0) { toast.error(t('pageEditor.galleryFull', 'Up to 24 photos.')); return; }
    setBusy(true);
    const added = [];
    for (const file of files.slice(0, room)) {
      // eslint-disable-next-line no-await-in-loop
      if ((await widthOf(file)) < MIN_WIDTH) {
        toast.error(t('pageEditor.photoSmall', '{{name}} is too small to look sharp. Use a photo at least 1000 pixels wide.', { name: file.name }));
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadOneFile(file, API, token);
        added.push({ url, fx: 50, fy: 50, alt: '' });
      } catch (err) {
        toast.error(err.message || t('pageEditor.uploadFailed', 'The photo did not upload. Try again.'));
      }
    }
    setItems((l) => [...l, ...added]);
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await axios.put(`${API}/marketplace/businesses/${businessId}/page-gallery`, { gallery: items }, auth);
      setItems(r.data.gallery);
      setSavedItems(r.data.gallery);
      toast.success(t('pageEditor.gallerySaved', 'Saved. Your photos are on your page now.'));
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('pageEditor.saveFailed', 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="pe-gal" aria-label={t('pageEditor.photos', 'Photos')}>
      <div className="pe-gal-head">
        <strong>{t('pageEditor.galleryTitle', 'Your photos')}</strong>
        <button type="button" className="pe-icon" onClick={onClose} aria-label={t('pageEditor.close', 'Close')}><X size={18} /></button>
      </div>
      <p className="pe-gal-help">{hasPlace
        ? t('pageEditor.galleryHelp', "Photos you add here show in your page's gallery, in your page's own style. Tap each photo on the part that matters most: the crop keeps it in view.")
        : t('pageEditor.galleryNoPlace', 'Your page does not have a gallery yet. Your photos are kept here, and show once a gallery is added to your page.')}</p>
      {items === null ? <Loader2 className="animate-spin" size={20} /> : (
        <ul className="pe-gal-list">
          {items.map((p, i) => (
            <li key={p.url}>
              <button type="button" className="pe-gal-pic" onClick={(e) => focus(i, e)} aria-label={t('pageEditor.setFocus', 'Set the part of the photo to keep in view')}>
                <img src={p.url} alt="" />
                <span className="pe-gal-dot" style={{ left: `${p.fx}%`, top: `${p.fy}%` }} />
              </button>
              <div className="pe-gal-acts">
                <button type="button" className="pe-icon" onClick={() => move(i, -1)} disabled={!i} aria-label={t('pageEditor.earlier', 'Earlier')}><ChevronLeft size={16} className="pe-flip" /></button>
                <button type="button" className="pe-icon" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t('pageEditor.later', 'Later')}><ChevronRight size={16} className="pe-flip" /></button>
                <button type="button" className="pe-icon" onClick={() => setItems((l) => l.filter((_, k) => k !== i))} aria-label={t('pageEditor.remove', 'Remove')}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="pe-gal-foot">
        <button type="button" className="pe-btn pe-ghost" onClick={() => input.current?.click()} disabled={busy || !items}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t('pageEditor.addPhotos', 'Add photos')}
        </button>
        <button type="button" className="pe-btn pe-save" onClick={save} disabled={!changed || busy}>
          {changed ? t('pageEditor.save', 'Save') : t('pageEditor.savedShort', 'Saved')}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={add} />
    </aside>
  );
}

const CSS = `
.pe { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: var(--surface-muted); }
.pe-loading { min-height: 100vh; display: grid; place-items: center; color: var(--brand-muted); }
.pe-bar { user-select: none; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--brand-border); flex-wrap: wrap; }
.pe-title { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; margin-inline-end: auto; }
.pe-title strong { font-size: 1rem; color: var(--ink); }
.pe-title span { font-size: .85rem; color: var(--brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pe-group { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--surface-muted); box-shadow: inset 0 0 0 1px var(--brand-border); }
.pe-seg, .pe-icon { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; min-width: 44px; justify-content: center; padding: 0 12px; border-radius: 9px; font-weight: 600; font-size: .9rem; color: var(--ink); background: transparent; transition: background 150ms ease-out; }
.pe-icon { padding: 0 10px; }
.pe-seg.on { background: var(--surface); box-shadow: 0 1px 2px rgb(17 24 39 / .12); }
.pe-icon:disabled { opacity: .35; }
.pe-seg:hover:not(.on), .pe-icon:hover:not(:disabled) { background: var(--surface); }
.pe-page { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: .9rem; color: var(--ink); }
.pe-page select { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--brand-border); background: var(--surface); font: inherit; max-width: 220px; }
.pe-page select:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.pe-end { display: flex; align-items: center; gap: 8px; }
.pe-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; font-weight: 600; font-size: .9rem; text-decoration: none; transition: background 150ms ease-out, transform 150ms ease-out; }
.pe-ghost { color: var(--ink); background: transparent; border: 1px solid var(--brand-border); }
.pe-ghost:hover { background: var(--surface-muted); }
.pe-save { background: var(--action); color: var(--action-ink); padding: 0 22px; }
.pe-save:disabled { background: var(--surface-muted); color: var(--brand-muted); box-shadow: inset 0 0 0 1px var(--brand-border); }
.pe-save:active:not(:disabled) { transform: translateY(1px); }
.pe-btn:focus-visible, .pe-seg:focus-visible, .pe-icon:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.pe-help { user-select: none; margin: 0; padding: 8px 16px; font-size: .88rem; color: var(--brand-muted); background: var(--surface); border-bottom: 1px solid var(--brand-border); }
.pe-stage { flex: 1; min-height: 0; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 16px; }
.pe-frame-wrap { position: relative; flex: none; }
.pe-frame { border: 0; background: var(--surface); transform-origin: 0 0; display: block; box-shadow: 0 1px 2px rgb(17 24 39 / .06), 0 18px 40px -20px rgb(17 24 39 / .3); }
.pe-frame.phone { border-radius: 28px; }
.pe-cover { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(249 250 251 / .85); color: var(--brand-muted); }
[dir="rtl"] .pe-flip { transform: scaleX(-1); }
.pe-ghost.on { background: var(--surface-muted); }
.pe-gal { position: fixed; z-index: 61; top: 0; bottom: 0; inset-inline-end: 0; width: min(380px, 100vw); display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--surface); border-inline-start: 1px solid var(--brand-border); box-shadow: -18px 0 40px -24px rgb(17 24 39 / .35); overflow: auto; }
.pe-gal-head { display: flex; align-items: center; justify-content: space-between; }
.pe-gal-help { margin: 0; font-size: .88rem; color: var(--brand-muted); }
.pe-gal-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pe-gal-pic { position: relative; display: block; width: 100%; aspect-ratio: 4 / 3; padding: 0; border: 0; border-radius: 10px; overflow: hidden; cursor: crosshair; background: var(--surface-muted); }
.pe-gal-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pe-gal-dot { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 3px solid #fff; background: var(--gold); box-shadow: 0 0 0 1px rgb(17 24 39 / .4); pointer-events: none; }
.pe-gal-acts { display: flex; justify-content: center; gap: 2px; margin-top: 4px; }
.pe-gal-acts .pe-icon { min-height: 36px; min-width: 36px; }
.pe-gal-foot { margin-top: auto; display: flex; justify-content: space-between; gap: 8px; position: sticky; bottom: 0; background: var(--surface); padding-top: 8px; }
@media (max-width: 760px) { .pe-hide-sm { display: none; } .pe-title { width: 100%; order: -1; } }
`;
