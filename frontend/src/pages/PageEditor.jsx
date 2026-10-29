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
 * shows the change for every visitor. "Hours and notice" edits the same
 * opening hours and notice as the dashboard; "Link" on a piece of text ties
 * it to the hours or to a price there (Tzvi, 28 Oct 2026).
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Laptop, Smartphone, Undo2, Redo2, ExternalLink, Loader2, RotateCcw, Images, X, ChevronLeft, ChevronRight, Trash2, Plus, Wand2, Clock, Link2 } from 'lucide-react';
import { API, AuthContext } from '../App';
import { uploadOneFile } from '../utils/fastUpload';
import NoticeEditor from '../components/dashboard/NoticeEditor';

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
  const [askOpen, setAskOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  // The words being linked ({key, bind}) and the dashboard's figures they can show.
  const [linkFor, setLinkFor] = useState(null);
  const [live, setLive] = useState(null);
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

  const loadLive = useCallback(() => {
    if (!biz?.slug) return;
    axios.get(`${API}/marketplace/business/${biz.slug}/page-edits`)
      .then((r) => setLive({
        hours: r.data.hours || null,
        prices: r.data.prices || {},
        soldOut: Object.fromEntries((r.data.products || []).filter((p) => !p.in_stock).map((p) => [p.name, true])),
      }))
      .catch(() => setLive({ hours: null, prices: {}, soldOut: {} }));
  }, [biz]);
  useEffect(loadLive, [loadLive]);
  useEffect(() => { if (ready && live) send({ type: 'mir:live', ...live }); }, [ready, live, send]);

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
      else if (d.type === 'mir:link') { setLinkFor({ key: d.key, bind: d.bind }); setAskOpen(false); setPhotosOpen(false); setHoursOpen(false); }
      else if (d.type === 'mir:translate') {
        // A two-language page: the other language follows what the owner typed (page_edits.py page-translate).
        const lang = d.to === 'he' ? t('pageEditor.inHebrew', 'Hebrew') : t('pageEditor.inEnglish', 'English');
        axios.post(`${API}/marketplace/businesses/${businessId}/page-translate`, { texts: d.texts, to: d.to }, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => {
            send({ type: 'mir:translated', id: d.id, texts: r.data.texts });
            toast.success(t('pageEditor.translated', 'The {{lang}} version is updated too. To change it, click the words and choose {{lang}}.', { lang }));
          })
          .catch(() => toast.error(t('pageEditor.translateFailed', 'The {{lang}} version could not be updated. Click the words and choose {{lang}} to type it.', { lang })));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [push, undo, redo, send, businessId, token, t]);

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
          <button type="button" className={`pe-btn pe-ghost${askOpen ? ' on' : ''}`} onClick={() => { setAskOpen((o) => !o); setPhotosOpen(false); setHoursOpen(false); setLinkFor(null); }} aria-expanded={askOpen}>
            <Wand2 size={15} /> <span className="pe-hide-sm">{t('pageEditor.ask', 'Ask for a change')}</span>
          </button>
          <button type="button" className={`pe-btn pe-ghost${photosOpen ? ' on' : ''}`} onClick={() => { setPhotosOpen((o) => !o); setAskOpen(false); setHoursOpen(false); setLinkFor(null); }} aria-expanded={photosOpen}>
            <Images size={15} /> <span className="pe-hide-sm">{t('pageEditor.photos', 'Photos')}</span>
          </button>
          <button type="button" className={`pe-btn pe-ghost${hoursOpen ? ' on' : ''}`} onClick={() => { setHoursOpen((o) => !o); setAskOpen(false); setPhotosOpen(false); setLinkFor(null); }} aria-expanded={hoursOpen}>
            <Clock size={15} /> <span className="pe-hide-sm">{t('pageEditor.hoursNotice', 'Hours and notice')}</span>
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
      <p className="pe-help">{t('pageEditor.help', 'Click text to select it, click again to type. Drag anything to move it: it lines up with what is around it. Click a line or a card to add another just like it, or drag it to a new place in its row. Moves on laptop and on phone are kept separately.')}</p>
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
      {askOpen && (
        <RequestPanel businessId={businessId} token={token} auth={auth} t={t} dirty={dirty}
          onClose={() => setAskOpen(false)} onApplied={() => { setReady(false); setSaved(EMPTY); setHist({ past: [], now: EMPTY, future: [] }); setFrameKey((k) => k + 1); }} />
      )}
      {hoursOpen && (
        <HoursPanel biz={biz} businessId={businessId} auth={auth} t={t}
          onClose={() => setHoursOpen(false)} onSaved={(b) => { setBiz((x) => ({ ...x, ...b })); loadLive(); setReady(false); setFrameKey((k) => k + 1); }} />
      )}
      {linkFor && (
        <LinkPanel link={linkFor} live={live} t={t} onClose={() => setLinkFor(null)}
          onPick={(bind) => { send({ type: 'mir:bind', key: linkFor.key, bind }); setLinkFor(null); }} />
      )}
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


/**
 * Opening hours and the notice, the same ones the dashboard's page settings
 * edit (PATCH /marketplace/businesses/:id): set once, shown on the standard
 * page, on Google, in the designed page's linked words and in its corner.
 */
function HoursPanel({ biz, businessId, auth, t, onClose, onSaved }) {
  const [hours, setHours] = useState(biz.hours || '');
  const [notice, setNotice] = useState(biz.notice || null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const n = notice && notice.text && notice.text.trim() ? { text: notice.text.trim(), starts_on: notice.starts_on || null, ends_on: notice.ends_on || null } : null;
      await axios.patch(`${API}/marketplace/businesses/${businessId}`, { hours: hours.trim() || null, notice: n }, auth);
      toast.success(t('pageEditor.hoursSaved', 'Saved. Your pages show it now.'));
      onSaved({ hours: hours.trim() || null, notice: n });
    } catch (err) {
      toast.error(err.response?.data?.detail || t('pageEditor.saveFailed', 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="pe-gal" aria-label={t('pageEditor.hoursNotice', 'Hours and notice')}>
      <div className="pe-gal-head">
        <strong>{t('pageEditor.hoursNotice', 'Hours and notice')}</strong>
        <button type="button" className="pe-icon" onClick={onClose} aria-label={t('pageEditor.close', 'Close')}><X size={18} /></button>
      </div>
      <label className="pe-field">
        <span>{t('pageEditor.hoursLabel', 'Opening hours')}</span>
        <input value={hours} maxLength={200} onChange={(e) => setHours(e.target.value)} dir="auto"
          placeholder={t('pageEditor.hoursPlaceholder', 'Sun to Thu 9:00 to 18:00, Fri 9:00 to 13:00')} />
      </label>
      <p className="pe-gal-help">{t('pageEditor.hoursHelp', 'To show these hours on your page, click the hours there and choose Link. They then change whenever you change them here.')}</p>
      <NoticeEditor notice={notice} onChange={setNotice} />
      <p className="pe-gal-help">{t('pageEditor.noticeHelp', 'The notice shows in a corner of every page of your site between its dates, for example Closed for Sukkot, or Now in Special Market.')}</p>
      <div className="pe-gal-foot">
        <button type="button" className="pe-btn pe-ghost" onClick={onClose}>{t('pageEditor.close', 'Close')}</button>
        <button type="button" className="pe-btn pe-save" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : null} {t('pageEditor.save', 'Save')}
        </button>
      </div>
    </aside>
  );
}

/** What a piece of text can be linked to: the opening hours, or the price of something the business lists. */
function LinkPanel({ link, live, t, onClose, onPick }) {
  const prices = Object.entries(live?.prices || {});
  return (
    <aside className="pe-gal" aria-label={t('pageEditor.linkTitle', 'Link these words')}>
      <div className="pe-gal-head">
        <strong>{t('pageEditor.linkTitle', 'Link these words')}</strong>
        <button type="button" className="pe-icon" onClick={onClose} aria-label={t('pageEditor.close', 'Close')}><X size={18} /></button>
      </div>
      <p className="pe-gal-help">{t('pageEditor.linkHelp', 'Linked words follow your dashboard: change your hours or a price there and your page changes too. Out of stock shows as Sold out.')}</p>
      {!live ? <Loader2 className="animate-spin" size={20} /> : (
        <ul className="pe-links">
          <li><button type="button" className={link.bind === 'hours' ? 'on' : ''} onClick={() => onPick('hours')} disabled={!live.hours}>
            <Clock size={16} /> <span><b>{t('pageEditor.linkHours', 'Your opening hours')}</b><small>{live.hours || t('pageEditor.noHours', 'Not set yet: add them under Hours and notice')}</small></span>
          </button></li>
          {prices.map(([name, price]) => (
            <li key={name}><button type="button" className={link.bind === `price:${name}` ? 'on' : ''} onClick={() => onPick(`price:${name}`)}>
              <Link2 size={16} /> <span><b>{name}</b><small>₪{price}{live.soldOut[name] ? ` · ${t('pageEditor.soldOut', 'Sold out')}` : ''}</small></span>
            </button></li>
          ))}
        </ul>
      )}
      {!!live && !prices.length && <p className="pe-gal-help">{t('pageEditor.noPrices', 'Prices you add to your listings in the dashboard show here.')}</p>}
      <div className="pe-gal-foot">
        {link.bind ? <button type="button" className="pe-btn pe-ghost" onClick={() => onPick(null)}>{t('pageEditor.unlink', 'Unlink, back to my own words')}</button> : <span />}
        <button type="button" className="pe-btn pe-ghost" onClick={onClose}>{t('pageEditor.close', 'Close')}</button>
      </div>
    </aside>
  );
}


/**
 * "Ask for a change" (Tzvi, 19 Oct 2026: pages should update without us
 * building them by hand). The owner writes what they want and can attach
 * photos; the AI proposes changes to the page's fixed places only (wording,
 * a photo swap, the gallery, questions), shown here as a list. Nothing
 * changes until Apply, and an applied change can be undone. Anything else
 * becomes a design request for us. Backend: routes/marketplace/page_requests.py.
 */
function RequestPanel({ businessId, token, auth, t, dirty, onClose, onApplied }) {
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState(null);
  const input = useRef(null);
  const base = `${API}/marketplace/businesses/${businessId}/page-requests`;
  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy('photos');
    for (const file of files.slice(0, 8 - photos.length)) {
      // eslint-disable-next-line no-await-in-loop
      if ((await widthOf(file)) < MIN_WIDTH) {
        toast.error(t('pageEditor.photoSmall', '{{name}} is too small to look sharp. Use a photo at least 1000 pixels wide.', { name: file.name }));
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadOneFile(file, API, token);
        setPhotos((l) => [...l, url]);
      } catch (err) {
        toast.error(err.message || t('pageEditor.uploadFailed', 'The photo did not upload. Try again.'));
      }
    }
    setBusy('');
  };
  const send = async () => {
    setBusy('send');
    try {
      const r = await axios.post(base, { message, photos }, auth);
      setResult(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('pageEditor.askFailed', 'That did not go through. Try again in a minute.'));
    } finally {
      setBusy('');
    }
  };
  const apply = async () => {
    if (dirty && !window.confirm(t('pageEditor.unsavedLost', 'You have changes you have not saved. Applying this replaces them. Go ahead?'))) return;
    setBusy('apply');
    try {
      await axios.post(`${base}/${result.id}/apply`, {}, auth);
      setApplied(result.id);
      setResult(null);
      setMessage('');
      setPhotos([]);
      toast.success(t('pageEditor.applied', 'Done. Your page shows the changes now.'));
      onApplied();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('pageEditor.saveFailed', 'Could not save. Try again.'));
    } finally {
      setBusy('');
    }
  };
  const discard = async () => {
    if (result?.id) axios.post(`${base}/${result.id}/discard`, {}, auth).catch(() => {});
    setResult(null);
  };
  const undo = async () => {
    setBusy('undo');
    try {
      await axios.post(`${base}/${applied}/undo`, {}, auth);
      setApplied(null);
      toast.success(t('pageEditor.undone', 'Undone. Your page is back as it was.'));
      onApplied();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('pageEditor.saveFailed', 'Could not save. Try again.'));
    } finally {
      setBusy('');
    }
  };
  const plan = result?.plan;
  const count = plan ? plan.text.length + plan.img.length + plan.gallery.length + plan.faq.length + (plan.faq_remove || []).length : 0;
  return (
    <aside className="pe-gal" aria-label={t('pageEditor.ask', 'Ask for a change')}>
      <div className="pe-gal-head">
        <strong>{t('pageEditor.ask', 'Ask for a change')}</strong>
        <button type="button" className="pe-icon" onClick={onClose} aria-label={t('pageEditor.close', 'Close')}><X size={18} /></button>
      </div>
      {!plan && (
        <>
          <p className="pe-gal-help">{t('pageEditor.askHelp', 'Tell us what to add or change, in your own words, and attach photos if they go with it. You see every change before it goes on your page.')}</p>
          <textarea className="pe-ask" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} rows={6}
            placeholder={t('pageEditor.askPlaceholder', 'For example: add these photos of our new box, and add a question: Do you deliver on Friday? Yes, until 1pm.')} />
          {!!photos.length && (
            <ul className="pe-gal-list">
              {photos.map((u) => (
                <li key={u}>
                  <div className="pe-gal-pic"><img src={u} alt="" /></div>
                  <div className="pe-gal-acts"><button type="button" className="pe-icon" onClick={() => setPhotos((l) => l.filter((x) => x !== u))} aria-label={t('pageEditor.remove', 'Remove')}><Trash2 size={16} /></button></div>
                </li>
              ))}
            </ul>
          )}
          <div className="pe-gal-foot">
            <button type="button" className="pe-btn pe-ghost" onClick={() => input.current?.click()} disabled={!!busy || photos.length >= 8}>
              {busy === 'photos' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t('pageEditor.attach', 'Attach photos')}
            </button>
            <button type="button" className="pe-btn pe-save" onClick={send} disabled={!!busy || (!message.trim() && !photos.length)}>
              {busy === 'send' ? <><Loader2 size={15} className="animate-spin" /> {t('pageEditor.reading', 'Reading…')}</> : t('pageEditor.send', 'Send')}
            </button>
          </div>
          {applied && (
            <button type="button" className="pe-btn pe-ghost" onClick={undo} disabled={!!busy}>
              <Undo2 size={15} className="pe-flip" /> {t('pageEditor.undoLast', 'Undo the last change')}
            </button>
          )}
        </>
      )}
      {plan && (
        <div className="pe-plan">
          {plan.reply && <p className="pe-plan-reply">{plan.reply}</p>}
          {!count && !plan.design_request && <p className="pe-gal-help">{t('pageEditor.nothing', 'Nothing on the page needs to change for that.')}</p>}
          {plan.text.map((c) => (
            <div key={c.key} className="pe-plan-row"><span className="pe-plan-k">{t('pageEditor.wording', 'Wording')}</span><s>{c.old}</s><b>{c.new.replace(/<[^>]+>/g, ' ')}</b></div>
          ))}
          {plan.img.map((c) => (
            <div key={c.key} className="pe-plan-row"><span className="pe-plan-k">{t('pageEditor.photoSwap', 'Photo swapped')}</span><span>{c.alt}</span><img src={c.url} alt="" /></div>
          ))}
          {!!plan.gallery.length && (
            <div className="pe-plan-row"><span className="pe-plan-k">{t('pageEditor.toGallery', 'Added to your photos')}</span>
              <div className="pe-plan-pics">{plan.gallery.map((g) => <img key={g.url} src={g.url} alt="" />)}</div></div>
          )}
          {plan.faq.map((f) => (
            <div key={f.q} className="pe-plan-row"><span className="pe-plan-k">{t('pageEditor.newQuestion', 'New question')}</span><b>{f.q}</b><span>{f.a}</span></div>
          ))}
          {(plan.faq_remove || []).map((q) => (
            <div key={q} className="pe-plan-row"><span className="pe-plan-k">{t('pageEditor.removeQuestion', 'Question removed')}</span><s>{q}</s></div>
          ))}
          {plan.design_request && (
            <div className="pe-plan-row pe-plan-design"><span className="pe-plan-k">{t('pageEditor.forDesigners', 'For our designers')}</span><span>{plan.design_request}</span>
              <span className="pe-gal-help">{t('pageEditor.designNote', 'This needs a designer, so it is passed on to us. We will be in touch.')}</span></div>
          )}
          <div className="pe-gal-foot">
            <button type="button" className="pe-btn pe-ghost" onClick={discard} disabled={!!busy}>{t('pageEditor.discard', 'Discard')}</button>
            {!!count && (
              <button type="button" className="pe-btn pe-save" onClick={apply} disabled={!!busy}>
                {busy === 'apply' ? <Loader2 size={15} className="animate-spin" /> : null} {t('pageEditor.apply', 'Apply to my page')}
              </button>
            )}
          </div>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
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
.pe-ask { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid var(--brand-border); font: inherit; resize: vertical; background: var(--surface); color: var(--ink); }
.pe-ask:focus-visible { outline: 3px solid var(--gold); outline-offset: 1px; }
.pe-plan { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.pe-plan-reply { margin: 0; font-weight: 600; color: var(--ink); }
.pe-plan-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 12px; background: var(--surface-muted); font-size: .9rem; }
.pe-plan-row s { color: var(--brand-muted); }
.pe-plan-row img { width: 100%; max-height: 140px; object-fit: cover; border-radius: 8px; }
.pe-plan-k { font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--brand-muted); }
.pe-plan-pics { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pe-plan-pics img { aspect-ratio: 4 / 3; height: auto; }
.pe-plan-design { background: var(--surface); box-shadow: inset 0 0 0 1px var(--brand-border); }
.pe-gal-foot { margin-top: auto; display: flex; justify-content: space-between; gap: 8px; position: sticky; bottom: 0; background: var(--surface); padding-top: 8px; }
.pe-field { display: flex; flex-direction: column; gap: 6px; font-weight: 600; font-size: .9rem; color: var(--ink); }
.pe-field input { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--brand-border); background: var(--surface); font: inherit; font-weight: 500; }
.pe-field input:focus-visible { outline: 3px solid var(--gold); outline-offset: 1px; }
.pe-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pe-links button { width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: start; padding: 12px; border-radius: 12px; background: var(--surface-muted); color: var(--ink); min-height: 44px; }
.pe-links button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px var(--brand-border); }
.pe-links button.on { box-shadow: inset 0 0 0 2px var(--gold); }
.pe-links button:disabled { opacity: .5; }
.pe-links button:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.pe-links span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pe-links small { color: var(--brand-muted); font-size: .82rem; }
@media (max-width: 760px) { .pe-hide-sm { display: none; } .pe-title { width: 100%; order: -1; } }
`;
