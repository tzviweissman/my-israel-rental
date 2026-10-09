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
import { ArrowLeft, Laptop, Smartphone, Undo2, Redo2, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
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
  const [box, setBox] = useState({ w: 1200, h: 800 });
  const frame = useRef(null);
  const stage = useRef(null);
  const fileInput = useRef(null);
  const picking = useRef(null);
  const auth = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const dirty = !same(hist.now, saved);

  useEffect(() => {
    axios.get(`${API}/marketplace/business/${businessId}`)
      .then((r) => setBiz(r.data.business || r.data))
      .catch(() => toast.error(t('pageEditor.notFound', 'This page could not be opened')));
  }, [businessId, t]);

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
          <button type="button" className="pe-btn pe-ghost" onClick={resetAll} title={t('pageEditor.reset', 'Original design')}>
            <RotateCcw size={15} /> <span className="pe-hide-sm">{t('pageEditor.reset', 'Original design')}</span>
          </button>
          <a className="pe-btn pe-ghost" href={`/business/${slug}?fresh=1`} target="_blank" rel="noreferrer">
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
            src={`/business/${slug}?mir-edit=1`}
            className={`pe-frame${device === 'm' ? ' phone' : ''}`}
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          />
          {!ready && <div className="pe-cover"><Loader2 className="animate-spin" size={22} /></div>}
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

const CSS = `
.pe { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: #F9FAFB; }
.pe-loading { min-height: 100vh; display: grid; place-items: center; color: var(--brand-muted); }
.pe-bar { user-select: none; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #E3E3E3; flex-wrap: wrap; }
.pe-title { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; margin-inline-end: auto; }
.pe-title strong { font-size: 1rem; color: var(--ink); }
.pe-title span { font-size: .85rem; color: var(--brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pe-group { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: #F3F4F6; }
.pe-seg, .pe-icon { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 12px; border-radius: 9px; font-weight: 600; font-size: .9rem; color: var(--ink); background: transparent; transition: background 150ms ease-out; }
.pe-icon { padding: 0 10px; }
.pe-seg.on { background: #fff; box-shadow: 0 1px 2px rgb(17 24 39 / .12); }
.pe-icon:disabled { opacity: .35; }
.pe-seg:hover:not(.on), .pe-icon:hover:not(:disabled) { background: #E9EAEE; }
.pe-end { display: flex; align-items: center; gap: 8px; }
.pe-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 999px; font-weight: 600; font-size: .9rem; text-decoration: none; transition: background 150ms ease-out, transform 150ms ease-out; }
.pe-ghost { color: var(--ink); background: transparent; border: 1px solid #E3E3E3; }
.pe-ghost:hover { background: #F3F4F6; }
.pe-save { background: #000; color: #fff; padding: 0 22px; }
.pe-save:disabled { background: #E5E7EB; color: #6B7280; }
.pe-save:active:not(:disabled) { transform: translateY(1px); }
.pe-btn:focus-visible, .pe-seg:focus-visible, .pe-icon:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.pe-help { user-select: none; margin: 0; padding: 8px 16px; font-size: .88rem; color: var(--brand-muted); background: #fff; border-bottom: 1px solid #E3E3E3; }
.pe-stage { flex: 1; min-height: 0; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 16px; }
.pe-frame-wrap { position: relative; flex: none; }
.pe-frame { border: 0; background: #fff; transform-origin: 0 0; display: block; box-shadow: 0 1px 2px rgb(17 24 39 / .06), 0 18px 40px -20px rgb(17 24 39 / .3); }
.pe-frame.phone { border-radius: 28px; }
.pe-cover { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(249 250 251 / .85); color: var(--brand-muted); }
[dir="rtl"] .pe-flip { transform: scaleX(-1); }
@media (max-width: 760px) { .pe-hide-sm { display: none; } .pe-title { width: 100%; order: -1; } }
`;
